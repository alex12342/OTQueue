import { Router, type IRouter } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, eventsTable, eventEntriesTable, employeesTable, eventEditHistoryTable, type EventEditChange } from "@workspace/db";
import { getRosterSeniorityMode, seniorityOrderBy } from "../lib/seniority";
import { AuthRequest } from "../middlewares/auth";
import {
  CreateEventBody,
  UpdateEventBody,
  GetEventParams,
  DeleteEventParams,
  ListEventsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getEventWithEntries(id: number) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
  if (!event) return null;

  const seniorityMode = await getRosterSeniorityMode(event.rosterId);

  const entries = await db
    .select({
      id: eventEntriesTable.id,
      employeeId: eventEntriesTable.employeeId,
      employeeName: employeesTable.name,
      offered: eventEntriesTable.offered,
      worked: eventEntriesTable.worked,
      hoursOverride: eventEntriesTable.hoursOverride,
    })
    .from(eventEntriesTable)
    .innerJoin(employeesTable, eq(eventEntriesTable.employeeId, employeesTable.id))
    .where(eq(eventEntriesTable.eventId, id))
    .orderBy(...seniorityOrderBy(seniorityMode));

  const defaultHours = Number(event.defaultHours);

  return {
    id: event.id,
    rosterId: event.rosterId,
    date: event.date,
    description: event.description,
    defaultHours,
    dayType: event.dayType,
    multiplier: Number(event.multiplier),
    // Audit fields. createdAt always exists (column predates the audit feature);
    // author info is null for events recorded before it was introduced.
    createdAt: event.createdAt ? event.createdAt.toISOString() : null,
    createdBy: event.createdBy ?? null,
    createdByName: event.createdByName ?? null,
    updatedAt: event.updatedAt ? event.updatedAt.toISOString() : null,
    updatedBy: event.updatedBy ?? null,
    updatedByName: event.updatedByName ?? null,
    entries: entries.map((e: { id: number; employeeId: number | null; employeeName: string | null; offered: boolean; worked: boolean; hoursOverride: string | null }) => {
      const override = e.hoursOverride ? Number(e.hoursOverride) : null;
      const hoursOffered = e.offered ? (override ?? defaultHours) : 0;
      const hoursAwarded = e.worked ? (override ?? defaultHours) : 0;
      return {
        id: e.id,
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        offered: e.offered,
        worked: e.worked,
        hoursOverride: override,
        hoursOffered,
        hoursAwarded,
      };
    }),
  };
}

// ── Edit-history diffing ──────────────────────────────────────────────────────
// A PATCH replaces the whole entry list and may change any subset of scalar
// fields. We compare old vs new state and record one EventEditChange per
// changed field / employee so the UI can render "old → new" without knowing
// anything about storage details.

function formatHours(hours: number | null): string {
  return hours == null ? "-" : `${hours}h`;
}

function entryStatus(offered: boolean, worked: boolean, hoursOverride: number | null): string {
  const label = worked ? "Worked" : offered ? "Offered" : "None";
  return `${label} ${hoursOverride == null ? "(default)" : formatHours(hoursOverride)}`;
}

interface EntrySnapshot {
  employeeId: number;
  employeeName: string;
  offered: boolean;
  worked: boolean;
  hoursOverride: number | null;
}

function diffEntries(oldEntries: EntrySnapshot[], newEntries: EntrySnapshot[]): EventEditChange[] {
  const changes: EventEditChange[] = [];
  const oldById = new Map(oldEntries.map((e) => [e.employeeId, e]));
  const newById = new Map(newEntries.map((e) => [e.employeeId, e]));

  for (const [employeeId, next] of newById) {
    const prev = oldById.get(employeeId);
    if (!prev) {
      changes.push({
        field: `entry:${employeeId}`,
        label: next.employeeName,
        from: null,
        to: entryStatus(next.offered, next.worked, next.hoursOverride),
      });
    } else if (
      prev.offered !== next.offered ||
      prev.worked !== next.worked ||
      prev.hoursOverride !== next.hoursOverride
    ) {
      changes.push({
        field: `entry:${employeeId}`,
        label: prev.employeeName,
        from: entryStatus(prev.offered, prev.worked, prev.hoursOverride),
        to: entryStatus(next.offered, next.worked, next.hoursOverride),
      });
    }
  }

  for (const [employeeId, prev] of oldById) {
    if (!newById.has(employeeId)) {
      changes.push({
        field: `entry:${employeeId}`,
        label: prev.employeeName,
        from: entryStatus(prev.offered, prev.worked, prev.hoursOverride),
        to: null,
      });
    }
  }

  return changes;
}

router.get("/events", async (req, res): Promise<void> => {
  const parsedQ = ListEventsQueryParams.safeParse(req.query);
  if (!parsedQ.success) {
    res.status(400).json({ error: parsedQ.error.message });
    return;
  }

  let query = db.select().from(eventsTable).$dynamic();
  if (parsedQ.data.rosterId !== undefined) {
    query = query.where(eq(eventsTable.rosterId, parsedQ.data.rosterId));
  }

  const events = await query.orderBy(desc(eventsTable.date), desc(eventsTable.createdAt));
  const withEntries = await Promise.all(events.map((e: typeof eventsTable.$inferSelect) => getEventWithEntries(e.id)));
  res.json(withEntries.filter(Boolean));
});

router.post("/events", async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rosterId, date, description, defaultHours, dayType, multiplier, entries } = parsed.data;
  const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : String(date);

  const hasAnySelected = entries.some((e) => e.offered || e.worked);
  if (!hasAnySelected) {
    res.status(400).json({ error: "At least one employee must be marked as offered or worked" });
    return;
  }

  const [event] = await db
    .insert(eventsTable)
    .values({
      rosterId,
      date: dateStr,
      description,
      defaultHours: String(defaultHours),
      dayType: dayType ?? "weekday",
      multiplier: String(multiplier ?? 1),
      createdBy: req.userId ?? null,
      createdByName: req.userName ?? null,
    })
    .returning();

  const filteredEntries = entries.filter((e) => e.offered || e.worked);
  if (filteredEntries.length > 0) {
    await db.insert(eventEntriesTable).values(
      filteredEntries.map((e) => ({
        eventId: event.id,
        employeeId: e.employeeId,
        offered: e.worked ? true : e.offered,
        worked: e.worked,
        hoursOverride: e.hoursOverride != null ? String(e.hoursOverride) : null,
      }))
    );
  }

  const result = await getEventWithEntries(event.id);
  res.status(201).json(result);
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const event = await getEventWithEntries(params.data.id);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(event);
});

router.get("/events/:id/history", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, params.data.id));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const history = await db
    .select()
    .from(eventEditHistoryTable)
    .where(eq(eventEditHistoryTable.eventId, params.data.id))
    .orderBy(desc(eventEditHistoryTable.createdAt), desc(eventEditHistoryTable.id));

  res.json(
    history.map((h: typeof eventEditHistoryTable.$inferSelect) => ({
      id: h.id,
      eventId: h.eventId,
      userId: h.userId ?? null,
      userName: h.userName ?? null,
      changes: Array.isArray(h.changes) ? h.changes : [],
      createdAt: h.createdAt.toISOString(),
    })),
  );
});

router.patch("/events/:id", async (req: AuthRequest, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, description, defaultHours, dayType, multiplier, entries } = parsed.data;

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const hasAnySelected = entries.some((e) => e.offered || e.worked);
  if (!hasAnySelected) {
    res.status(400).json({ error: "At least one employee must be marked as offered or worked" });
    return;
  }

  // Snapshot the old entry list (with names) before it is replaced, so the
  // edit-history diff can describe what changed per employee.
  const oldEntryRows = await db
    .select({
      employeeId: eventEntriesTable.employeeId,
      employeeName: employeesTable.name,
      offered: eventEntriesTable.offered,
      worked: eventEntriesTable.worked,
      hoursOverride: eventEntriesTable.hoursOverride,
    })
    .from(eventEntriesTable)
    .innerJoin(employeesTable, eq(eventEntriesTable.employeeId, employeesTable.id))
    .where(eq(eventEntriesTable.eventId, params.data.id));

  const oldDefaultHours = Number(existing.defaultHours);
  const toSnapshot = (e: { employeeId: number | null; employeeName: string | null; offered: boolean; worked: boolean; hoursOverride: string | null }): EntrySnapshot | null =>
    e.employeeId == null
      ? null
      : {
          employeeId: e.employeeId,
          employeeName: e.employeeName ?? `Employee #${e.employeeId}`,
          offered: e.offered,
          worked: e.worked,
          hoursOverride: e.hoursOverride != null ? Number(e.hoursOverride) : null,
        };

  const oldSnapshots = oldEntryRows.map(toSnapshot).filter((s: EntrySnapshot | null): s is EntrySnapshot => s !== null);

  // Partial update: only fields present in the payload are written; omitted
  // fields keep their stored value (day_type/multiplier clobber regression fix).
  const updates: Partial<typeof eventsTable.$inferInsert> = {};
  if (date !== undefined) updates.date = date.toISOString().split("T")[0];
  if (description !== undefined) updates.description = description;
  if (defaultHours !== undefined) updates.defaultHours = String(defaultHours);
  if (dayType !== undefined) updates.dayType = dayType;
  if (multiplier != null) updates.multiplier = String(multiplier);

  // Build the edit-history diff from old vs resulting state. Only fields that
  // actually change are recorded, so a no-op re-save leaves no history entry.
  const changes: EventEditChange[] = [];
  if (updates.date !== undefined && updates.date !== existing.date) {
    changes.push({ field: "date", label: "Date", from: existing.date, to: updates.date });
  }
  if (updates.description !== undefined && updates.description !== existing.description) {
    changes.push({ field: "description", label: "Description", from: existing.description, to: updates.description });
  }
  if (updates.defaultHours !== undefined && Number(updates.defaultHours) !== oldDefaultHours) {
    changes.push({ field: "defaultHours", label: "Default hours", from: formatHours(oldDefaultHours), to: formatHours(Number(updates.defaultHours)) });
  }
  if (updates.dayType !== undefined && updates.dayType !== existing.dayType) {
    changes.push({ field: "dayType", label: "Day type", from: existing.dayType, to: updates.dayType });
  }
  if (updates.multiplier !== undefined && Number(updates.multiplier) !== Number(existing.multiplier)) {
    changes.push({ field: "multiplier", label: "Multiplier", from: `×${Number(existing.multiplier)}`, to: `×${Number(updates.multiplier)}` });
  }

  const filteredEntries = entries.filter((e) => e.offered || e.worked);
  // Resolve employee names for the diff labels (the request only carries ids).
  const nameById = new Map<number, string>(oldSnapshots.map((s: EntrySnapshot) => [s.employeeId, s.employeeName]));
  const missingIds = [...new Set(filteredEntries.map((e) => e.employeeId))].filter((id) => !nameById.has(id));
  if (missingIds.length > 0) {
    const rows = await db
      .select({ id: employeesTable.id, name: employeesTable.name })
      .from(employeesTable)
      .where(inArray(employeesTable.id, missingIds));
    for (const r of rows) nameById.set(r.id, r.name);
  }
  const newSnapshots: EntrySnapshot[] = filteredEntries.map((e) => ({
    employeeId: e.employeeId,
    employeeName: nameById.get(e.employeeId) ?? `Employee #${e.employeeId}`,
    offered: e.worked ? true : e.offered,
    worked: e.worked,
    hoursOverride: e.hoursOverride != null ? Number(e.hoursOverride) : null,
  }));

  changes.push(...diffEntries(oldSnapshots, newSnapshots));

  if (changes.length > 0) {
    updates.updatedBy = req.userId ?? null;
    updates.updatedByName = req.userName ?? null;
    updates.updatedAt = new Date();
  }

  if (Object.keys(updates).length > 0) {
    await db.update(eventsTable).set(updates).where(eq(eventsTable.id, params.data.id));
  }

  await db.delete(eventEntriesTable).where(eq(eventEntriesTable.eventId, params.data.id));

  if (filteredEntries.length > 0) {
    await db.insert(eventEntriesTable).values(
      filteredEntries.map((e) => ({
        eventId: params.data.id,
        employeeId: e.employeeId,
        offered: e.worked ? true : e.offered,
        worked: e.worked,
        hoursOverride: e.hoursOverride != null ? String(e.hoursOverride) : null,
      }))
    );
  }

  if (changes.length > 0) {
    await db.insert(eventEditHistoryTable).values({
      eventId: params.data.id,
      userId: req.userId ?? null,
      userName: req.userName ?? null,
      changes,
    });
  }

  const result = await getEventWithEntries(params.data.id);
  res.json(result);
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(eventsTable)
    .where(eq(eventsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
