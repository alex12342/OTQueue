import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, rolesTable, subclassesTable } from "@workspace/db";
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

  res.json(roles.map((r) => ({ id: r.id, rosterId: r.rosterId, name: r.name })));
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
    .orderBy(subclassesTable.weekdayPriority);

  res.json(
    subclasses.map((s) => ({
      id: s.id,
      rosterId: s.rosterId,
      name: s.name,
      weekdayPriority: s.weekdayPriority,
      weekendPriority: s.weekendPriority,
      holidayPriority: s.holidayPriority,
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
      weekdayPriority: parsed.data.weekdayPriority ?? 1,
      weekendPriority: parsed.data.weekendPriority ?? 1,
      holidayPriority: parsed.data.holidayPriority ?? 1,
    })
    .returning();

  res.status(201).json({
    id: subclass.id,
    rosterId: subclass.rosterId,
    name: subclass.name,
    weekdayPriority: subclass.weekdayPriority,
    weekendPriority: subclass.weekendPriority,
    holidayPriority: subclass.holidayPriority,
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
  if (parsed.data.weekdayPriority !== undefined) updateData.weekdayPriority = parsed.data.weekdayPriority;
  if (parsed.data.weekendPriority !== undefined) updateData.weekendPriority = parsed.data.weekendPriority;
  if (parsed.data.holidayPriority !== undefined) updateData.holidayPriority = parsed.data.holidayPriority;

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
    weekdayPriority: updated.weekdayPriority,
    weekendPriority: updated.weekendPriority,
    holidayPriority: updated.holidayPriority,
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

export default router;
