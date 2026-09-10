import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, rostersTable, rosterSettingsTable, employeesTable } from "@workspace/db";
import {
  CreateRosterBody,
  GetRosterParams,
  UpdateRosterParams,
  UpdateRosterBody,
  DeleteRosterParams,
  GetRosterSettingsParams,
  UpdateRosterSettingsParams,
  UpdateRosterSettingsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/rosters", async (_req, res): Promise<void> => {
  const rosters = await db.select().from(rostersTable).orderBy(rostersTable.id);
  res.json(rosters);
});

router.post("/rosters", async (req, res): Promise<void> => {
  const parsed = CreateRosterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [roster] = await db
    .insert(rostersTable)
    .values({ name: parsed.data.name, description: parsed.data.description ?? null })
    .returning();

  // New rosters default to hire-date seniority (computed rank, oldest first).
  await db.insert(rosterSettingsTable).values({
    rosterId: roster.id,
    useOfferedHours: true,
    useSeniority: true,
    useSubclassOrdering: true,
    seniorityMode: "hire_date",
  });

  res.status(201).json(roster);
});

router.get("/rosters/:id", async (req, res): Promise<void> => {
  const params = GetRosterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [roster] = await db.select().from(rostersTable).where(eq(rostersTable.id, params.data.id));
  if (!roster) {
    res.status(404).json({ error: "Roster not found" });
    return;
  }
  res.json(roster);
});

router.patch("/rosters/:id", async (req, res): Promise<void> => {
  const params = UpdateRosterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRosterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(rostersTable)
    .set({ name: parsed.data.name, description: parsed.data.description ?? null })
    .where(eq(rostersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Roster not found" });
    return;
  }
  res.json(updated);
});

router.delete("/rosters/:id", async (req, res): Promise<void> => {
  const params = DeleteRosterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(rostersTable)
    .where(eq(rostersTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Roster not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/rosters/:id/settings", async (req, res): Promise<void> => {
  const params = GetRosterSettingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [settings] = await db
    .select()
    .from(rosterSettingsTable)
    .where(eq(rosterSettingsTable.rosterId, params.data.id));

  if (!settings) {
    res.status(404).json({ error: "Roster settings not found" });
    return;
  }

  res.json({
    rosterId: settings.rosterId,
    useOfferedHours: settings.useOfferedHours,
    useSeniority: settings.useSeniority,
    useSubclassOrdering: settings.useSubclassOrdering,
    seniorityMode: settings.seniorityMode,
  });
});

router.put("/rosters/:id/settings", async (req, res): Promise<void> => {
  const params = UpdateRosterSettingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRosterSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(rosterSettingsTable)
    .where(eq(rosterSettingsTable.rosterId, params.data.id));

  if (!existing.length) {
    res.status(404).json({ error: "Roster not found" });
    return;
  }

  // Guard: switching to hire-date seniority requires every active employee
  // to have a hire date, otherwise they would all sort last.
  if (
    parsed.data.seniorityMode === "hire_date" &&
    existing[0].seniorityMode !== "hire_date"
  ) {
    const missing = await db
      .select({ name: employeesTable.name })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.rosterId, params.data.id),
          eq(employeesTable.active, true),
          sql`${employeesTable.hireDate} IS NULL`,
        ),
      )
      .orderBy(employeesTable.name);

    if (missing.length > 0) {
      res.status(400).json({
        error: `Cannot enable hire-date seniority: ${missing.map((m: { name: string }) => m.name).join(", ")} have no hire date`,
      });
      return;
    }
  }

  const [updated] = await db
    .update(rosterSettingsTable)
    .set({
      ...(parsed.data.useOfferedHours !== undefined && { useOfferedHours: parsed.data.useOfferedHours }),
      ...(parsed.data.useSeniority !== undefined && { useSeniority: parsed.data.useSeniority }),
      ...(parsed.data.useSubclassOrdering !== undefined && { useSubclassOrdering: parsed.data.useSubclassOrdering }),
      ...(parsed.data.seniorityMode !== undefined && { seniorityMode: parsed.data.seniorityMode }),
      updatedAt: new Date(),
    })
    .where(eq(rosterSettingsTable.rosterId, params.data.id))
    .returning();

  res.json({
    rosterId: updated.rosterId,
    useOfferedHours: updated.useOfferedHours,
    useSeniority: updated.useSeniority,
    useSubclassOrdering: updated.useSubclassOrdering,
    seniorityMode: updated.seniorityMode,
  });
});

export default router;
