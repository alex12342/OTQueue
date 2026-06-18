import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, employeesTable, eventEntriesTable, eventsTable, rolesTable, subclassesTable, rosterSettingsTable } from "@workspace/db";
import {
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
  GetEmployeeReportParams,
  ListEmployeesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function computeFairnessScore(
  employeeId: number,
  subclassId: number | null,
  rosterId: number
): Promise<number> {
  const [settings] = await db
    .select()
    .from(rosterSettingsTable)
    .where(eq(rosterSettingsTable.rosterId, rosterId));

  const [hrs] = await db
    .select({
      total: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) * ${eventsTable.multiplier}::numeric ELSE 0 END), 0)`,
    })
    .from(eventEntriesTable)
    .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
    .where(eq(eventEntriesTable.employeeId, employeeId));

  return Number(hrs?.total ?? 0);
}

async function getEmployeeWithHours(id: number) {
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!employee) return null;

  const [role] = employee.roleId
    ? await db.select().from(rolesTable).where(eq(rolesTable.id, employee.roleId))
    : [null];
  const [subclass] = employee.subclassId
    ? await db.select().from(subclassesTable).where(eq(subclassesTable.id, employee.subclassId))
    : [null];

  const [hrs] = await db
    .select({
      totalOfferedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
      totalWorkedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.worked} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
    })
    .from(eventEntriesTable)
    .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
    .where(eq(eventEntriesTable.employeeId, id));

  const fairnessScore = await computeFairnessScore(id, employee.subclassId, employee.rosterId);

  return {
    id: employee.id,
    rosterId: employee.rosterId,
    name: employee.name,
    seniority: employee.seniority,
    roleId: employee.roleId,
    roleName: role?.name ?? null,
    subclassId: employee.subclassId,
    subclassName: subclass?.name ?? null,
    active: employee.active,
    totalOfferedHours: Number(hrs?.totalOfferedHours ?? 0),
    totalWorkedHours: Number(hrs?.totalWorkedHours ?? 0),
    fairnessScore,
  };
}

router.get("/employees", async (req, res): Promise<void> => {
  const parsed = ListEmployeesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let query = db.select().from(employeesTable).$dynamic();
  if (parsed.data.rosterId !== undefined) {
    query = query.where(eq(employeesTable.rosterId, parsed.data.rosterId));
  }

  const employees = await query.orderBy(employeesTable.seniority);

  const withHours = await Promise.all(employees.map((emp) => getEmployeeWithHours(emp.id)));
  res.json(withHours.filter(Boolean));
});

router.post("/employees", async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [employee] = await db
    .insert(employeesTable)
    .values({
      rosterId: parsed.data.rosterId,
      name: parsed.data.name,
      seniority: parsed.data.seniority,
      roleId: parsed.data.roleId ?? null,
      subclassId: parsed.data.subclassId ?? null,
      active: parsed.data.active ?? true,
    })
    .returning();

  const withHours = await getEmployeeWithHours(employee.id);
  res.status(201).json(withHours);
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const employee = await getEmployeeWithHours(params.data.id);
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json(employee);
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof employeesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.seniority !== undefined) updateData.seniority = parsed.data.seniority;
  if (parsed.data.roleId !== undefined) updateData.roleId = parsed.data.roleId;
  if (parsed.data.subclassId !== undefined) updateData.subclassId = parsed.data.subclassId;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

  const [updated] = await db
    .update(employeesTable)
    .set(updateData)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const withHours = await getEmployeeWithHours(updated.id);
  res.json(withHours);
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/employees/:id/report", async (req, res): Promise<void> => {
  const params = GetEmployeeReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const employee = await getEmployeeWithHours(params.data.id);
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const entries = await db
    .select({
      eventId: eventsTable.id,
      date: eventsTable.date,
      description: eventsTable.description,
      defaultHours: eventsTable.defaultHours,
      dayType: eventsTable.dayType,
      offered: eventEntriesTable.offered,
      worked: eventEntriesTable.worked,
      hoursOverride: eventEntriesTable.hoursOverride,
    })
    .from(eventEntriesTable)
    .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
    .where(eq(eventEntriesTable.employeeId, params.data.id))
    .orderBy(eventsTable.date);

  const eventRecords = entries.map((e) => {
    const defaultHours = Number(e.defaultHours);
    const override = e.hoursOverride ? Number(e.hoursOverride) : null;
    return {
      eventId: e.eventId,
      date: e.date,
      description: e.description,
      dayType: e.dayType,
      offered: e.offered,
      worked: e.worked,
      hoursOverride: override,
      hoursOffered: e.offered ? (override ?? defaultHours) : 0,
      hoursAwarded: e.worked ? (override ?? defaultHours) : 0,
    };
  });

  const totalOfferedCount = eventRecords.filter((e) => e.offered).length;
  const totalWorkedCount = eventRecords.filter((e) => e.worked).length;
  const acceptanceRate = totalOfferedCount > 0
    ? Math.round((totalWorkedCount / totalOfferedCount) * 100)
    : 0;

  res.json({
    employee,
    totalOfferedHours: employee.totalOfferedHours,
    totalWorkedHours: employee.totalWorkedHours,
    acceptanceRate,
    events: eventRecords,
  });
});

export default router;
