import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, eventsTable, eventEntriesTable, employeesTable } from "@workspace/db";
import {
  CreateEventBody,
  GetEventParams,
  DeleteEventParams,
  ListEventsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getEventWithEntries(id: number) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
  if (!event) return null;

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
    .orderBy(employeesTable.seniority);

  const defaultHours = Number(event.defaultHours);

  return {
    id: event.id,
    rosterId: event.rosterId,
    date: event.date,
    description: event.description,
    defaultHours,
    dayType: event.dayType,
    entries: entries.map((e) => {
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
  const withEntries = await Promise.all(events.map((e) => getEventWithEntries(e.id)));
  res.json(withEntries.filter(Boolean));
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rosterId, date, description, defaultHours, dayType, entries } = parsed.data;
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

router.patch("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, description, defaultHours, dayType, entries } = parsed.data;
  const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : String(date);

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

  await db
    .update(eventsTable)
    .set({
      date: dateStr,
      description,
      defaultHours: String(defaultHours),
      dayType: dayType ?? "weekday",
    })
    .where(eq(eventsTable.id, params.data.id));

  await db.delete(eventEntriesTable).where(eq(eventEntriesTable.eventId, params.data.id));

  const filteredEntries = entries.filter((e) => e.offered || e.worked);
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

  const result = await getEventWithEntries(params.data.id);
  res.json(result);
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
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
