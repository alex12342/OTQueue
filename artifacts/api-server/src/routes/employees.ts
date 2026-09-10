import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, employeesTable, eventEntriesTable, eventsTable, rolesTable, subclassesTable, rosterSettingsTable, rostersTable } from "@workspace/db";
import {
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
  GetEmployeeReportParams,
  ListEmployeesQueryParams,
} from "@workspace/api-zod";
import {
  assignEffectiveSeniority,
  getRosterSeniorityMode,
  isValidHireDate,
  seniorityOrderBy,
} from "../lib/seniority";

const router: IRouter = Router();

async function computeFairnessScore(
  employeeId: number,
  subclassId: number | null,
  rosterId: number
): Promise<number> {
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId));

  const [settings] = await db
    .select()
    .from(rosterSettingsTable)
    .where(eq(rosterSettingsTable.rosterId, rosterId));

  // Find the most recent "Reset Hours" event to use as a time cutoff
  const [resetEvent] = await db
    .select({ createdAt: eventsTable.createdAt })
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.rosterId, rosterId),
        sql`${eventsTable.description} = 'Reset Hours'`,
      ),
    )
    .orderBy(sql`${eventsTable.createdAt} DESC`)
    .limit(1);

  const baseWhere = eq(eventEntriesTable.employeeId, employeeId);
  const timeWhere = resetEvent ? and(baseWhere, sql`${eventsTable.createdAt} > ${resetEvent.createdAt}`) : baseWhere;

  const [hrs] = await db
    .select({
      total: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) * ${eventsTable.multiplier}::numeric ELSE 0 END), 0)`,
    })
    .from(eventEntriesTable)
    .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
    .where(timeWhere);

  const rawScore = Number(hrs?.total ?? 0);
  const baseline = Number((employee?.startingNormalizedHours as number | null | undefined) ?? 0);
  return Math.max(0, rawScore - baseline);
}

async function getEmployeeWithHours(id: number) {
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!employee) return null;

  const [roster] = await db
    .select()
    .from(rostersTable)
    .where(eq(rostersTable.id, employee.rosterId));
  const [role] = employee.roleId
    ? await db.select().from(rolesTable).where(eq(rolesTable.id, employee.roleId))
    : [null];
  const [subclass] = employee.subclassId
    ? await db.select().from(subclassesTable).where(eq(subclassesTable.id, employee.subclassId))
    : [null];

  // Find the most recent "Reset Hours" event for time-window filtering
  const [resetEvent] = await db
    .select({ createdAt: eventsTable.createdAt })
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.rosterId, employee.rosterId),
        sql`${eventsTable.description} = 'Reset Hours'`,
      ),
    )
    .orderBy(sql`${eventsTable.createdAt} DESC`)
    .limit(1);

  const baseWhere = eq(eventEntriesTable.employeeId, id);
  const timeWhere = resetEvent ? and(baseWhere, sql`${eventsTable.createdAt} > ${resetEvent.createdAt}`) : baseWhere;

  const [hrs] = await db
    .select({
      totalOfferedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
      totalWorkedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.worked} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
    })
    .from(eventEntriesTable)
    .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
    .where(timeWhere);

  const fairnessScore = await computeFairnessScore(id, employee.subclassId, employee.rosterId);

  return {
    id: employee.id,
    rosterId: employee.rosterId,
    rosterName: roster?.name ?? null,
    name: employee.name,
    seniority: employee.seniority,
    hireDate: employee.hireDate,
    priorityRank: employee.priorityRank,
    linkedEmployeeId: employee.linkedEmployeeId,
    roleId: employee.roleId,
    roleName: role?.name ?? null,
    subclassId: employee.subclassId,
    subclassName: subclass?.name ?? null,
    active: employee.active,
    startingNormalizedHours: Number((employee.startingNormalizedHours as number | null | undefined) ?? 0),
    totalOfferedHours: Number(hrs?.totalOfferedHours ?? 0),
    totalWorkedHours: Number(hrs?.totalWorkedHours ?? 0),
    fairnessScore: fairnessScore,
  };
}

type EmployeeWithHours = NonNullable<Awaited<ReturnType<typeof getEmployeeWithHours>>>;

/**
 * Attach the mode-aware effective seniority (display rank) for a single employee.
 * manual mode: stored seniority passes through; hire_date mode: computed 1-based rank.
 */
async function withEffectiveSeniority(id: number): Promise<(EmployeeWithHours & { effectiveSeniority: number | null }) | null> {
  const employee = await getEmployeeWithHours(id);
  if (!employee) return null;
  const mode = await getRosterSeniorityMode(employee.rosterId);
  const rosterRows = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.rosterId, employee.rosterId));
  const map = assignEffectiveSeniority(rosterRows, mode);
  return { ...employee, effectiveSeniority: map.get(id) ?? null };
}

/** Attach effective seniority for a batch of employees (may span multiple rosters). */
async function attachEffectiveSeniority(
  rows: EmployeeWithHours[]
): Promise<(EmployeeWithHours & { effectiveSeniority: number | null })[]> {
  const byRoster = new Map<number, EmployeeWithHours[]>();
  for (const row of rows) {
    const list = byRoster.get(row.rosterId) ?? [];
    list.push(row);
    byRoster.set(row.rosterId, list);
  }
  const effective = new Map<number, number | null>();
  for (const [rosterId] of byRoster) {
    const mode = await getRosterSeniorityMode(rosterId);
    const rosterRows = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.rosterId, rosterId));
    const map = assignEffectiveSeniority(rosterRows, mode);
    for (const [id, value] of map) effective.set(id, value);
  }
  return rows.map((row) => ({ ...row, effectiveSeniority: effective.get(row.id) ?? null }));
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
  if (parsed.data.search !== undefined && parsed.data.search !== "") {
    query = query.where(sql`${employeesTable.name} ILIKE ${`%${parsed.data.search}%`}`);
  }

  // Roster-scoped lists order by the roster's active seniority mode; the
  // global (directory) list orders alphabetically by name.
  let employees;
  if (parsed.data.rosterId !== undefined) {
    const mode = await getRosterSeniorityMode(parsed.data.rosterId);
    employees = await query.orderBy(...seniorityOrderBy(mode));
  } else {
    employees = await query.orderBy(employeesTable.name);
  }

  const withHours = await Promise.all(employees.map((emp: typeof employeesTable.$inferSelect) => getEmployeeWithHours(emp.id)));
  const withRank = await attachEffectiveSeniority(withHours.filter((e) => e !== null));
  res.json(withRank);
});

router.post("/employees", async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Mode-conditional validation: manual mode needs a seniority number,
  // hire-date mode needs a hire date.
  const mode = await getRosterSeniorityMode(parsed.data.rosterId);
  if (mode === "manual" && parsed.data.seniority == null) {
    res.status(400).json({ error: "Seniority number is required for rosters using manual seniority" });
    return;
  }
  if (mode === "hire_date" && !isValidHireDate(parsed.data.hireDate)) {
    res.status(400).json({ error: "Hire date is required for rosters using hire-date seniority" });
    return;
  }

  // A directory link must point at an existing employee in another roster.
  if (parsed.data.linkedEmployeeId != null) {
    const [source] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, parsed.data.linkedEmployeeId));
    if (!source || source.rosterId === parsed.data.rosterId) {
      res.status(400).json({ error: "linkedEmployeeId must reference an employee in a different roster" });
      return;
    }
  }

  // Use manual startingNormalizedHours if provided, otherwise compute from peers
  const manualStartingHours = parsed.data.startingNormalizedHours;
  const useManualStartingHours = manualStartingHours !== undefined && manualStartingHours !== null;

  const [employee] = await db
    .insert(employeesTable)
    .values({
      rosterId: parsed.data.rosterId,
      name: parsed.data.name,
      seniority: parsed.data.seniority ?? null,
      hireDate: parsed.data.hireDate ?? null,
      priorityRank: parsed.data.priorityRank ?? null,
      linkedEmployeeId: parsed.data.linkedEmployeeId ?? null,
      roleId: parsed.data.roleId ?? null,
      subclassId: parsed.data.subclassId ?? null,
      active: parsed.data.active ?? true,
      startingNormalizedHours: useManualStartingHours ? String(manualStartingHours) : "0",
    })
    .returning();

  // Compute fairness baseline from peers only if not manually specified
  let withHours: Awaited<ReturnType<typeof getEmployeeWithHours>> | null = null;
  if (!useManualStartingHours) {
    const [settings] = await db
      .select()
      .from(rosterSettingsTable)
      .where(eq(rosterSettingsTable.rosterId, parsed.data.rosterId));

    const subclasses = await db
      .select()
      .from(subclassesTable)
      .where(eq(subclassesTable.rosterId, parsed.data.rosterId));
    const subclassesInUse = subclasses.length > 0;

    const targetSubclass = parsed.data.subclassId ?? null;

    // Find the most recent "Reset Hours" event for time-window filtering
    const [resetEvent] = await db
      .select({ createdAt: eventsTable.createdAt })
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.rosterId, parsed.data.rosterId),
          sql`${eventsTable.description} = 'Reset Hours'`,
        ),
      )
      .orderBy(sql`${eventsTable.createdAt} DESC`)
      .limit(1);

    // Build where clauses for peer filtering
    const baseWhere = and(
      eq(employeesTable.rosterId, parsed.data.rosterId),
      eq(employeesTable.active, true),
    );
    const subclassWhere = subclassesInUse && targetSubclass !== null
      ? and(baseWhere, eq(employeesTable.subclassId, targetSubclass))
      : subclassesInUse
        ? and(baseWhere, sql`${employeesTable.subclassId} IS NULL`)
        : baseWhere;

    const timeWhere = resetEvent
      ? and(subclassWhere, sql`${eventsTable.createdAt} > ${resetEvent.createdAt}`)
      : subclassWhere;

    const [peerTotals] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) * ${eventsTable.multiplier}::numeric ELSE 0 END), 0)`,
        count: sql<number>`COUNT(DISTINCT ${employeesTable.id})`,
      })
      .from(employeesTable)
      .leftJoin(eventEntriesTable, eq(employeesTable.id, eventEntriesTable.employeeId))
      .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
      .where(timeWhere);

    const avgScore = (Number(peerTotals?.total ?? 0) / (Number(peerTotals?.count ?? 0) || 1));

    if (avgScore > 0) {
      const today = new Date().toISOString().split("T")[0];
      const [baselineEvent] = await db
        .insert(eventsTable)
        .values({
          rosterId: parsed.data.rosterId,
          date: today,
          description: "Fairness Baseline",
          defaultHours: String(avgScore),
          dayType: "system",
          multiplier: "1",
        })
        .returning();

      await db.insert(eventEntriesTable).values({
        eventId: baselineEvent.id,
        employeeId: employee.id,
        hoursOverride: String(avgScore),
        offered: true,
        worked: false,
      });

      await db
        .update(employeesTable)
        .set({ startingNormalizedHours: String(avgScore) })
        .where(eq(employeesTable.id, employee.id));
    } else {
      await db
        .update(employeesTable)
        .set({ startingNormalizedHours: "0" })
        .where(eq(employeesTable.id, employee.id));
    }
  }

  // Always emit a Fairness Baseline event for the final starting value
  {
    const today = new Date().toISOString().split("T")[0];
    const finalHours = Number(manualStartingHours ?? (useManualStartingHours ? manualStartingHours : 0));
    const [baselineEvent] = await db
      .insert(eventsTable)
      .values({
        rosterId: parsed.data.rosterId,
        date: today,
        description: "Fairness Baseline",
        defaultHours: String(finalHours),
        dayType: "system",
        multiplier: "1",
      })
      .returning();

    await db.insert(eventEntriesTable).values({
      eventId: baselineEvent.id,
      employeeId: employee.id,
      hoursOverride: String(finalHours),
      offered: true,
      worked: false,
    });
  }

  withHours = await withEffectiveSeniority(employee.id);

  res.status(201).json(withHours);
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const employee = await withEffectiveSeniority(params.data.id);
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

  // Get current employee to detect subclass change
  const [current] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, params.data.id));

  if (!current) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  // Mode-conditional validation against the current stored values.
  const mode = await getRosterSeniorityMode(current.rosterId);
  if (parsed.data.hireDate != null && !isValidHireDate(parsed.data.hireDate)) {
    res.status(400).json({ error: "hireDate must be a valid YYYY-MM-DD date" });
    return;
  }
  if (mode === "manual" && current.seniority == null && parsed.data.seniority == null) {
    res.status(400).json({ error: "Seniority number is required for rosters using manual seniority" });
    return;
  }
  if (mode === "hire_date" && current.hireDate == null && !isValidHireDate(parsed.data.hireDate)) {
    res.status(400).json({ error: "Hire date is required for rosters using hire-date seniority" });
    return;
  }

  // A directory link must point at an existing employee in another roster.
  if (parsed.data.linkedEmployeeId != null && parsed.data.linkedEmployeeId !== current.linkedEmployeeId) {
    const [source] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, parsed.data.linkedEmployeeId));
    if (!source || source.rosterId === current.rosterId) {
      res.status(400).json({ error: "linkedEmployeeId must reference an employee in a different roster" });
      return;
    }
  }

  const updateData: Partial<typeof employeesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.seniority !== undefined) updateData.seniority = parsed.data.seniority;
  if (parsed.data.hireDate !== undefined) updateData.hireDate = parsed.data.hireDate;
  if (parsed.data.priorityRank !== undefined) updateData.priorityRank = parsed.data.priorityRank;
  if (parsed.data.linkedEmployeeId !== undefined) updateData.linkedEmployeeId = parsed.data.linkedEmployeeId;
  if (parsed.data.roleId !== undefined) updateData.roleId = parsed.data.roleId;
  if (parsed.data.subclassId !== undefined) updateData.subclassId = parsed.data.subclassId;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  if (parsed.data.startingNormalizedHours !== undefined) updateData.startingNormalizedHours = String(parsed.data.startingNormalizedHours);

  const subclassChanged = parsed.data.subclassId !== undefined && parsed.data.subclassId !== current.subclassId;
  const manualHoursChanged =
    parsed.data.startingNormalizedHours !== undefined &&
    parsed.data.startingNormalizedHours !== null &&
    Number(parsed.data.startingNormalizedHours) !== Number(current.startingNormalizedHours ?? 0);

  const [updated] = await db
    .update(employeesTable)
    .set(updateData)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  // Emit synthetic Fairness Baseline event when manual starting hours are changed
  if (manualHoursChanged) {
    const rosterId = updated.rosterId;
    const today = new Date().toISOString().split("T")[0];
    const newHours = Number(parsed.data.startingNormalizedHours);

    const [baselineEvent] = await db
      .insert(eventsTable)
      .values({
        rosterId,
        date: today,
        description: "Fairness Baseline",
        defaultHours: String(newHours),
        dayType: "system",
        multiplier: "1",
      })
      .returning();

    await db.insert(eventEntriesTable).values({
      eventId: baselineEvent.id,
      employeeId: updated.id,
      hoursOverride: String(newHours),
      offered: true,
      worked: false,
    });
  }

  // Handle subclass change: reset baseline and recompute
  if (subclassChanged) {
    const rosterId = updated.rosterId;
    const newSubclassId = updated.subclassId;

    // Find the most recent "Reset Hours" event for time-window filtering
    const [resetEvent] = await db
      .select({ createdAt: eventsTable.createdAt })
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.rosterId, rosterId),
          sql`${eventsTable.description} = 'Reset Hours'`,
        ),
      )
      .orderBy(sql`${eventsTable.createdAt} DESC`)
      .limit(1);

    // Check if subclasses are in use for this roster
    const subclasses = await db
      .select()
      .from(subclassesTable)
      .where(eq(subclassesTable.rosterId, rosterId));
    const subclassesInUse = subclasses.length > 0;

    // Determine peer filter for new subclass
    const baseWhere = and(
      eq(employeesTable.rosterId, rosterId),
      eq(employeesTable.active, true),
    );
    const subclassWhere = subclassesInUse && newSubclassId !== null
      ? and(baseWhere, eq(employeesTable.subclassId, newSubclassId))
      : subclassesInUse
        ? and(baseWhere, sql`${employeesTable.subclassId} IS NULL`)
        : baseWhere;

    const timeWhere = resetEvent
      ? and(subclassWhere, sql`${eventsTable.createdAt} > ${resetEvent.createdAt}`)
      : subclassWhere;

    // First reset the employee's baseline to 0
    await db
      .update(employeesTable)
      .set({ startingNormalizedHours: "0" })
      .where(eq(employeesTable.id, updated.id));

    // Create a "Subclass Changed" marker event
    const today = new Date().toISOString().split("T")[0];
    const [markerEvent] = await db
      .insert(eventsTable)
      .values({
        rosterId,
        date: today,
        description: "Subclass Changed",
        defaultHours: "0",
        dayType: "system",
        multiplier: "1",
      })
      .returning();

    await db.insert(eventEntriesTable).values({
      eventId: markerEvent.id,
      employeeId: updated.id,
      hoursOverride: "0",
      offered: false,
      worked: false,
    });

    // Compute new average from peers in the new subclass
    const [peerTotals] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) * ${eventsTable.multiplier}::numeric ELSE 0 END), 0)`,
        count: sql<number>`COUNT(DISTINCT ${employeesTable.id})`,
      })
      .from(employeesTable)
      .leftJoin(eventEntriesTable, eq(employeesTable.id, eventEntriesTable.employeeId))
      .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
      .where(timeWhere);

    const avgScore = (Number(peerTotals?.total ?? 0) / (Number(peerTotals?.count ?? 0) || 1));

    if (avgScore > 0) {
      const [baselineEvent] = await db
        .insert(eventsTable)
        .values({
          rosterId,
          date: today,
          description: "Fairness Baseline",
          defaultHours: String(avgScore),
          dayType: "system",
          multiplier: "1",
        })
        .returning();

      await db.insert(eventEntriesTable).values({
        eventId: baselineEvent.id,
        employeeId: updated.id,
        hoursOverride: String(avgScore),
        offered: true,
        worked: false,
      });

      await db
        .update(employeesTable)
        .set({ startingNormalizedHours: String(avgScore) })
        .where(eq(employeesTable.id, updated.id));
    }
  }

  const withHours = await withEffectiveSeniority(updated.id);
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

  // Task 21: Employee deleted successfully.
  // Event entries referencing this employee have employee_id set to NULL (onDelete: "set null").
  // Historical event records remain intact with null employee_id for audit purposes.
  res.sendStatus(204);
});

router.get("/employees/:id/report", async (req, res): Promise<void> => {
  const params = GetEmployeeReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const employee = await withEffectiveSeniority(params.data.id);
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
      multiplier: eventsTable.multiplier,
      offered: eventEntriesTable.offered,
      worked: eventEntriesTable.worked,
      hoursOverride: eventEntriesTable.hoursOverride,
    })
    .from(eventEntriesTable)
    .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
    .where(eq(eventEntriesTable.employeeId, params.data.id))
    .orderBy(eventsTable.date);

  const eventRecords = entries.map((e: { eventId: number; date: string; description: string; dayType: string; multiplier: string; offered: boolean; worked: boolean; hoursOverride: string | null; defaultHours: string }) => {
    const defaultHours = Number(e.defaultHours);
    const override = e.hoursOverride ? Number(e.hoursOverride) : null;
    const multiplier = Number(e.multiplier ?? 1);
    return {
      eventId: e.eventId,
      date: e.date,
      description: e.description,
      dayType: e.dayType,
      multiplier,
      offered: e.offered,
      worked: e.worked,
      hoursOverride: override,
      hoursOffered: e.offered ? (override ?? defaultHours) : 0,
      hoursAwarded: e.worked ? (override ?? defaultHours) : 0,
    };
  });

  const totalOfferedCount = eventRecords.filter((e: { offered: boolean; worked: boolean }) => e.offered).length;
  const totalWorkedCount = eventRecords.filter((e: { offered: boolean; worked: boolean }) => e.worked).length;
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

// ── Normalize hours for all employees in a roster ─────────────────────────────

router.post("/rosters/:id/normalize-hours", async (req, res): Promise<void> => {
  const rosterId = Number(req.params.id);
  if (isNaN(rosterId)) {
    res.status(400).json({ error: "Invalid roster ID" });
    return;
  }

  const employees: typeof employeesTable.$inferSelect[] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.rosterId, rosterId))
    .orderBy(employeesTable.seniority);

  // Reset startingNormalizedHours for all employees in the roster
  await db
    .update(employeesTable)
    .set({ startingNormalizedHours: "0" })
    .where(eq(employeesTable.rosterId, rosterId));

  const resetDate = req.body.date || new Date().toISOString().split("T")[0];

  // Parse the local date string (YYYY-MM-DD) as UTC to avoid timezone shift.
  const [year, month, day] = resetDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .split("T")[0];

  const [event] = await db
    .insert(eventsTable)
    .values({
      rosterId,
      date: utcDate,
      description: "Reset Hours",
      defaultHours: "0",
      dayType: "system",
      multiplier: "1",
    })
    .returning();

  res.json({
    message: `Hours reset for ${employees.length} employees`,
    eventId: event.id,
  });
});

export default router;
