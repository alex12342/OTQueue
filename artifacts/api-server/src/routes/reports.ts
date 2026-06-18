import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, employeesTable, eventEntriesTable, eventsTable } from "@workspace/db";
import { GetUpNextQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function buildEventWithEntries(event: typeof eventsTable.$inferSelect) {
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
    .where(eq(eventEntriesTable.eventId, event.id));

  const defaultHours = Number(event.defaultHours);
  return {
    id: event.id,
    date: event.date,
    description: event.description,
    defaultHours,
    dayType: event.dayType,
    entries: entries.map((e) => {
      const override = e.hoursOverride ? Number(e.hoursOverride) : null;
      return {
        id: e.id,
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        offered: e.offered,
        worked: e.worked,
        hoursOverride: override,
        hoursOffered: e.offered ? (override ?? defaultHours) : 0,
        hoursAwarded: e.worked ? (override ?? defaultHours) : 0,
      };
    }),
  };
}

router.get("/up-next", async (req, res): Promise<void> => {
  const parsed = GetUpNextQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dayType = parsed.data.dayType ?? "weekday";

  const employees = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.active, true));

  const withHours = await Promise.all(
    employees.map(async (emp) => {
      const hrs = await db
        .select({
          totalOfferedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
        })
        .from(eventEntriesTable)
        .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
        .where(eq(eventEntriesTable.employeeId, emp.id));

      return {
        ...emp,
        totalOfferedHours: Number(hrs[0]?.totalOfferedHours ?? 0),
      };
    })
  );

  const categoryOrder = (cat: string) => {
    if (dayType === "weekday") return cat === "four_hour" ? 0 : 1;
    return cat === "full_time" ? 0 : 1;
  };

  const sorted = withHours.sort((a, b) => {
    const catDiff = categoryOrder(a.category) - categoryOrder(b.category);
    if (catDiff !== 0) return catDiff;
    const hoursDiff = a.totalOfferedHours - b.totalOfferedHours;
    if (hoursDiff !== 0) return hoursDiff;
    return a.seniority - b.seniority;
  });

  const ranked = sorted.map((emp, idx) => ({
    id: emp.id,
    name: emp.name,
    category: emp.category,
    seniority: emp.seniority,
    totalOfferedHours: emp.totalOfferedHours,
    rank: idx + 1,
  }));

  res.json({ dayType, employees: ranked });
});

router.get("/stats", async (_req, res): Promise<void> => {
  const [eventCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(eventsTable);

  const [hourTotals] = await db
    .select({
      totalOfferedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
      totalWorkedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.worked} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
    })
    .from(eventEntriesTable)
    .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id));

  const [empCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(employeesTable)
    .where(eq(employeesTable.active, true));

  const allEmployees = await db.select().from(employeesTable);
  const topWorkers = await Promise.all(
    allEmployees.map(async (emp) => {
      const hrs = await db
        .select({
          totalWorkedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.worked} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
          totalOfferedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
        })
        .from(eventEntriesTable)
        .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
        .where(eq(eventEntriesTable.employeeId, emp.id));

      return {
        id: emp.id,
        name: emp.name,
        totalWorkedHours: Number(hrs[0]?.totalWorkedHours ?? 0),
        totalOfferedHours: Number(hrs[0]?.totalOfferedHours ?? 0),
      };
    })
  );

  const sortedTopWorkers = topWorkers
    .sort((a, b) => b.totalWorkedHours - a.totalWorkedHours)
    .slice(0, 5);

  const recentEventsRaw = await db
    .select()
    .from(eventsTable)
    .orderBy(desc(eventsTable.date), desc(eventsTable.createdAt))
    .limit(5);

  const recentEventsWithEntries = await Promise.all(
    recentEventsRaw.map((event) => buildEventWithEntries(event))
  );

  res.json({
    totalEvents: Number(eventCount?.count ?? 0),
    totalOfferedHours: Number(hourTotals?.totalOfferedHours ?? 0),
    totalWorkedHours: Number(hourTotals?.totalWorkedHours ?? 0),
    employeeCount: Number(empCount?.count ?? 0),
    topWorkers: sortedTopWorkers,
    recentEvents: recentEventsWithEntries,
  });
});

export default router;
