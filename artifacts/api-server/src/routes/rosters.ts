import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rostersTable, rosterSettingsTable } from "@workspace/db";
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

  await db.insert(rosterSettingsTable).values({
    rosterId: roster.id,
    useOfferedHours: true,
    useSeniority: true,
    useSubclassOrdering: true,
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

  const [updated] = await db
    .update(rosterSettingsTable)
    .set({
      ...(parsed.data.useOfferedHours !== undefined && { useOfferedHours: parsed.data.useOfferedHours }),
      ...(parsed.data.useSeniority !== undefined && { useSeniority: parsed.data.useSeniority }),
      ...(parsed.data.useSubclassOrdering !== undefined && { useSubclassOrdering: parsed.data.useSubclassOrdering }),
      updatedAt: new Date(),
    })
    .where(eq(rosterSettingsTable.rosterId, params.data.id))
    .returning();

  res.json({
    rosterId: updated.rosterId,
    useOfferedHours: updated.useOfferedHours,
    useSeniority: updated.useSeniority,
    useSubclassOrdering: updated.useSubclassOrdering,
  });
});

export default router;
