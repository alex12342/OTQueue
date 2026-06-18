import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, dayTypeConfigTable } from "@workspace/db";
import { ListDayTypeConfigParams, UpsertDayTypeConfigParams, UpsertDayTypeConfigBody } from "@workspace/api-zod";

const router: IRouter = Router();

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
    .orderBy(dayTypeConfigTable.dayType);

  res.json(
    configs.map((c) => ({
      rosterId: c.rosterId,
      dayType: c.dayType,
      enabled: c.enabled,
      multiplier: c.multiplier != null ? Number(c.multiplier) : null,
    }))
  );
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
  const { enabled = true, multiplier } = parsed.data;

  const [existing] = await db
    .select()
    .from(dayTypeConfigTable)
    .where(and(eq(dayTypeConfigTable.rosterId, rosterId), eq(dayTypeConfigTable.dayType, dayType)));

  let result;
  if (existing) {
    [result] = await db
      .update(dayTypeConfigTable)
      .set({
        enabled,
        multiplier: multiplier != null ? String(multiplier) : null,
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
        enabled,
        multiplier: multiplier != null ? String(multiplier) : null,
      })
      .returning();
  }

  res.json({
    rosterId: result.rosterId,
    dayType: result.dayType,
    enabled: result.enabled,
    multiplier: result.multiplier != null ? Number(result.multiplier) : null,
  });
});

export default router;
