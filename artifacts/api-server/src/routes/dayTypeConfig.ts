import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, dayTypeConfigTable } from "@workspace/db";
import {
  ListDayTypeConfigParams,
  UpsertDayTypeConfigParams,
  UpsertDayTypeConfigBody,
  CreateDayTypeConfigParams,
  CreateDayTypeConfigBody,
  DeleteDayTypeConfigParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeConfig(c: typeof dayTypeConfigTable.$inferSelect) {
  return {
    rosterId: c.rosterId,
    dayType: c.dayType,
    name: c.name,
    enabled: c.enabled,
    multiplier: c.multiplier != null ? Number(c.multiplier) : null,
    sortOrder: c.sortOrder,
  };
}

router.get("/rosters/:id/day-type-config", async (req, res): Promise<void> => {
  const params = ListDayTypeConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const configs = await db
    .select()
    .from(dayTypeConfigTable)
    .where(eq(dayTypeConfigTable.rosterId, params.data.id))
    .orderBy(dayTypeConfigTable.sortOrder);

  res.json(configs.map(serializeConfig));
});

router.post("/rosters/:id/day-type-config", async (req, res): Promise<void> => {
  const params = CreateDayTypeConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateDayTypeConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dayType, name, enabled = true, multiplier, sortOrder = 0 } = parsed.data;

  // Check for duplicate dayType in this roster
  const [existing] = await db
    .select()
    .from(dayTypeConfigTable)
    .where(and(eq(dayTypeConfigTable.rosterId, params.data.id), eq(dayTypeConfigTable.dayType, dayType)));

  if (existing) {
    res.status(409).json({ error: `Day type "${dayType}" already exists in this roster` });
    return;
  }

  const [created] = await db
    .insert(dayTypeConfigTable)
    .values({
      rosterId: params.data.id,
      dayType,
      name,
      enabled,
      multiplier: multiplier != null ? String(multiplier) : null,
      sortOrder,
    })
    .returning();

  res.status(201).json(serializeConfig(created));
});

router.put("/rosters/:id/day-type-config/:dayType", async (req, res): Promise<void> => {
  const params = UpsertDayTypeConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpsertDayTypeConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { id: rosterId, dayType } = params.data;
  const { name, enabled = true, multiplier, sortOrder } = parsed.data;

  const [existing] = await db
    .select()
    .from(dayTypeConfigTable)
    .where(and(eq(dayTypeConfigTable.rosterId, rosterId), eq(dayTypeConfigTable.dayType, dayType)));

  let result;
  if (existing) {
    [result] = await db
      .update(dayTypeConfigTable)
      .set({
        ...(name !== undefined ? { name } : {}),
        enabled,
        multiplier: multiplier != null ? String(multiplier) : null,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(dayTypeConfigTable.rosterId, rosterId), eq(dayTypeConfigTable.dayType, dayType)))
      .returning();
  } else {
    [result] = await db
      .insert(dayTypeConfigTable)
      .values({
        rosterId,
        dayType,
        name: name ?? dayType,
        enabled,
        multiplier: multiplier != null ? String(multiplier) : null,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
  }

  res.json(serializeConfig(result));
});

router.delete("/rosters/:id/day-type-config/:dayType", async (req, res): Promise<void> => {
  const params = DeleteDayTypeConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(dayTypeConfigTable)
    .where(
      and(
        eq(dayTypeConfigTable.rosterId, params.data.id),
        eq(dayTypeConfigTable.dayType, params.data.dayType)
      )
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Day type config not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
