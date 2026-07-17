import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, rolesTable, subclassesTable, subclassDayTypeSortTable } from "@workspace/db";
import {
  ListRolesParams,
  CreateRoleParams,
  CreateRoleBody,
  UpdateRoleParams,
  UpdateRoleBody,
  DeleteRoleParams,
  ListSubclassesParams,
  CreateSubclassParams,
  CreateSubclassBody,
  UpdateSubclassParams,
  UpdateSubclassBody,
  DeleteSubclassParams,
  ListSubclassDayTypeSortParams,
  PutSubclassDayTypeSortParams,
  PutSubclassDayTypeSortBody,
  DeleteSubclassDayTypeSortParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Roles ──────────────────────────────────────────────────────────────────

router.get("/rosters/:rosterId/roles", async (req, res): Promise<void> => {
  const params = ListRolesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const roles = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.rosterId, params.data.rosterId))
    .orderBy(rolesTable.name);

  res.json(roles.map((r: typeof rolesTable.$inferSelect) => ({ id: r.id, rosterId: r.rosterId, name: r.name })));
});

router.post("/rosters/:rosterId/roles", async (req, res): Promise<void> => {
  const params = CreateRoleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [role] = await db
    .insert(rolesTable)
    .values({ rosterId: params.data.rosterId, name: parsed.data.name })
    .returning();

  res.status(201).json({ id: role.id, rosterId: role.rosterId, name: role.name });
});

router.patch("/rosters/:rosterId/roles/:id", async (req, res): Promise<void> => {
  const params = UpdateRoleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(rolesTable)
    .set({ name: parsed.data.name })
    .where(and(eq(rolesTable.id, params.data.id), eq(rolesTable.rosterId, params.data.rosterId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  res.json({ id: updated.id, rosterId: updated.rosterId, name: updated.name });
});

router.delete("/rosters/:rosterId/roles/:id", async (req, res): Promise<void> => {
  const params = DeleteRoleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(rolesTable)
    .where(and(eq(rolesTable.id, params.data.id), eq(rolesTable.rosterId, params.data.rosterId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  res.sendStatus(204);
});

// ── Subclasses ─────────────────────────────────────────────────────────────

router.get("/rosters/:rosterId/subclasses", async (req, res): Promise<void> => {
  const params = ListSubclassesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const subclasses = await db
    .select()
    .from(subclassesTable)
    .where(eq(subclassesTable.rosterId, params.data.rosterId))
    .orderBy(subclassesTable.sortOrder);

  res.json(
    subclasses.map((s: typeof subclassesTable.$inferSelect) => ({
      id: s.id,
      rosterId: s.rosterId,
      name: s.name,
      sortOrder: s.sortOrder,
    }))
  );
});

router.post("/rosters/:rosterId/subclasses", async (req, res): Promise<void> => {
  const params = CreateSubclassParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateSubclassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [subclass] = await db
    .insert(subclassesTable)
    .values({
      rosterId: params.data.rosterId,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  res.status(201).json({
    id: subclass.id,
    rosterId: subclass.rosterId,
    name: subclass.name,
    sortOrder: subclass.sortOrder,
  });
});

router.patch("/rosters/:rosterId/subclasses/:id", async (req, res): Promise<void> => {
  const params = UpdateSubclassParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSubclassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof subclassesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;

  const [updated] = await db
    .update(subclassesTable)
    .set(updateData)
    .where(and(eq(subclassesTable.id, params.data.id), eq(subclassesTable.rosterId, params.data.rosterId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Subclass not found" });
    return;
  }

  res.json({
    id: updated.id,
    rosterId: updated.rosterId,
    name: updated.name,
    sortOrder: updated.sortOrder,
  });
});

router.delete("/rosters/:rosterId/subclasses/:id", async (req, res): Promise<void> => {
  const params = DeleteSubclassParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(subclassesTable)
    .where(and(eq(subclassesTable.id, params.data.id), eq(subclassesTable.rosterId, params.data.rosterId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Subclass not found" });
    return;
  }

  res.sendStatus(204);
});

// ── Per-day-type subclass sort ─────────────────────────────────────────────

async function buildDayTypeSortResult(rosterId: number, dayType: string) {
  const subclasses = await db
    .select()
    .from(subclassesTable)
    .where(eq(subclassesTable.rosterId, rosterId));

  const overrides = await db
    .select()
    .from(subclassDayTypeSortTable)
    .where(
      and(
        eq(subclassDayTypeSortTable.rosterId, rosterId),
        eq(subclassDayTypeSortTable.dayType, dayType),
      ),
    );

  const overrideMap = new Map<number, number>(overrides.map((o: typeof subclassDayTypeSortTable.$inferSelect) => [o.subclassId, o.sortOrder]));

  return subclasses
    .map((s: typeof subclassesTable.$inferSelect) => ({
      subclassId: s.id,
      name: s.name,
      sortOrder: overrideMap.has(s.id) ? overrideMap.get(s.id)! : s.sortOrder,
      isOverride: overrideMap.has(s.id),
    }))
    .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder);
}

router.get("/rosters/:id/subclass-day-type-sort/:dayType", async (req, res): Promise<void> => {
  const params = ListSubclassDayTypeSortParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await buildDayTypeSortResult(params.data.id, params.data.dayType);
  res.json(result);
});

router.put("/rosters/:id/subclass-day-type-sort/:dayType", async (req, res): Promise<void> => {
  const params = PutSubclassDayTypeSortParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = PutSubclassDayTypeSortBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { id: rosterId, dayType } = params.data;

  await db
    .delete(subclassDayTypeSortTable)
    .where(
      and(
        eq(subclassDayTypeSortTable.rosterId, rosterId),
        eq(subclassDayTypeSortTable.dayType, dayType),
      ),
    );

  if (body.data.length > 0) {
    await db.insert(subclassDayTypeSortTable).values(
      body.data.map((item) => ({
        rosterId,
        subclassId: item.subclassId,
        dayType,
        sortOrder: item.sortOrder,
      })),
    );
  }

  const result = await buildDayTypeSortResult(rosterId, dayType);
  res.json(result);
});

router.delete("/rosters/:id/subclass-day-type-sort/:dayType", async (req, res): Promise<void> => {
  const params = DeleteSubclassDayTypeSortParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id: rosterId, dayType } = params.data;

  await db
    .delete(subclassDayTypeSortTable)
    .where(
      and(
        eq(subclassDayTypeSortTable.rosterId, rosterId),
        eq(subclassDayTypeSortTable.dayType, dayType),
      ),
    );

  res.sendStatus(204);
});

export default router;
