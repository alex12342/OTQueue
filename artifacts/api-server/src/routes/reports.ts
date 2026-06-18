import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import {
  db,
  employeesTable,
  eventEntriesTable,
  eventsTable,
  rosterSettingsTable,
  subclassesTable,
} from "@workspace/db";
import { GetUpNextQueryParams, GetStatsQueryParams, SuggestDayTypeQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// US federal holidays by month-day (MM-DD) — fixed-date ones
const FIXED_HOLIDAYS = new Set([
  "01-01", // New Year's Day
  "07-04", // Independence Day
  "11-11", // Veterans Day
  "12-25", // Christmas
  "12-24", // Christmas Eve (common in shift work)
]);

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === weekday) {
      count++;
      if (count === n) return d;
    }
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const d = new Date(year, month, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return d;
}

function isHoliday(date: Date): { isHoliday: boolean; name: string | null } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  if (FIXED_HOLIDAYS.has(`${mm}-${dd}`)) {
    const names: Record<string, string> = {
      "01-01": "New Year's Day",
      "07-04": "Independence Day",
      "11-11": "Veterans Day",
      "12-25": "Christmas Day",
      "12-24": "Christmas Eve",
    };
    return { isHoliday: true, name: names[`${mm}-${dd}`] ?? "Holiday" };
  }

  // MLK Day: 3rd Monday of January
  const mlk = getNthWeekdayOfMonth(year, 1, 1, 3);
  if (mlk.getDate() === day && month === 1) return { isHoliday: true, name: "MLK Day" };

  // Presidents' Day: 3rd Monday of February
  const pres = getNthWeekdayOfMonth(year, 2, 1, 3);
  if (pres.getDate() === day && month === 2) return { isHoliday: true, name: "Presidents' Day" };

  // Memorial Day: last Monday of May
  const mem = getLastWeekdayOfMonth(year, 5, 1);
  if (mem.getDate() === day && month === 5) return { isHoliday: true, name: "Memorial Day" };

  // Labor Day: 1st Monday of September
  const labor = getNthWeekdayOfMonth(year, 9, 1, 1);
  if (labor.getDate() === day && month === 9) return { isHoliday: true, name: "Labor Day" };

  // Thanksgiving: 4th Thursday of November
  const thanks = getNthWeekdayOfMonth(year, 11, 4, 4);
  if (thanks.getDate() === day && month === 11) return { isHoliday: true, name: "Thanksgiving" };

  return { isHoliday: false, name: null };
}

router.get("/suggest-day-type", (req, res): void => {
  const parsed = SuggestDayTypeQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const date = new Date(parsed.data.date + "T12:00:00Z");
  const dayOfWeek = date.getUTCDay(); // 0=Sunday, 6=Saturday
  const holidayCheck = isHoliday(date);

  if (holidayCheck.isHoliday) {
    res.json({
      date: parsed.data.date,
      suggestedDayType: "holiday",
      reason: holidayCheck.name ?? "Holiday",
      isHoliday: true,
      holidayName: holidayCheck.name,
    });
    return;
  }

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    res.json({
      date: parsed.data.date,
      suggestedDayType: "weekend",
      reason: dayOfWeek === 0 ? "Sunday" : "Saturday",
      isHoliday: false,
      holidayName: null,
    });
    return;
  }

  res.json({
    date: parsed.data.date,
    suggestedDayType: "weekday",
    reason: "Regular weekday",
    isHoliday: false,
    holidayName: null,
  });
});

router.get("/up-next", async (req, res): Promise<void> => {
  const parsed = GetUpNextQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rosterId, dayType = "weekday" } = parsed.data;

  const [settings] = await db
    .select()
    .from(rosterSettingsTable)
    .where(eq(rosterSettingsTable.rosterId, rosterId));

  const useOfferedHours = settings?.useOfferedHours ?? true;
  const useSeniority = settings?.useSeniority ?? true;
  const useSubclassOrdering = settings?.useSubclassOrdering ?? true;
  const useWeightedHours = settings?.useWeightedHours ?? false;

  const employees = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.active, true), eq(employeesTable.rosterId, rosterId)));

  const subclasses = await db
    .select()
    .from(subclassesTable)
    .where(eq(subclassesTable.rosterId, rosterId));

  const subclassMap = new Map(subclasses.map((s) => [s.id, s]));

  const withData = await Promise.all(
    employees.map(async (emp) => {
      const [hrs] = await db
        .select({
          totalOfferedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
        })
        .from(eventEntriesTable)
        .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
        .where(eq(eventEntriesTable.employeeId, emp.id));

      const rawOfferedHours = Number(hrs?.totalOfferedHours ?? 0);
      const subclass = emp.subclassId ? subclassMap.get(emp.subclassId) : null;
      const offeredMult = useWeightedHours ? Number(subclass?.offeredMultiplier ?? 1) : 1;
      const fairnessScore = rawOfferedHours * offeredMult;

      const priorityField =
        dayType === "weekday"
          ? "weekdayPriority"
          : dayType === "weekend"
          ? "weekendPriority"
          : "holidayPriority";

      const subclassPriority = subclass?.[priorityField] ?? 999;

      return {
        id: emp.id,
        name: emp.name,
        subclassId: emp.subclassId,
        subclassName: subclass?.name ?? null,
        seniority: emp.seniority,
        totalOfferedHours: rawOfferedHours,
        fairnessScore,
        subclassPriority,
      };
    })
  );

  const sorted = withData.sort((a, b) => {
    if (useSubclassOrdering) {
      const classDiff = a.subclassPriority - b.subclassPriority;
      if (classDiff !== 0) return classDiff;
    }
    if (useOfferedHours) {
      const hoursDiff = a.fairnessScore - b.fairnessScore;
      if (hoursDiff !== 0) return hoursDiff;
    }
    if (useSeniority) {
      return a.seniority - b.seniority;
    }
    return 0;
  });

  const ranked = sorted.map((emp, idx) => ({
    id: emp.id,
    name: emp.name,
    subclassId: emp.subclassId,
    subclassName: emp.subclassName,
    roleName: null as string | null,
    seniority: emp.seniority,
    totalOfferedHours: emp.totalOfferedHours,
    fairnessScore: emp.fairnessScore,
    rank: idx + 1,
  }));

  res.json({ rosterId, dayType, employees: ranked });
});

router.get("/stats", async (req, res): Promise<void> => {
  const parsed = GetStatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rosterId = parsed.data.rosterId;

  const [eventCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(eventsTable)
    .$dynamic()
    .where(rosterId !== undefined ? eq(eventsTable.rosterId, rosterId) : sql`true`);

  const [hourTotals] = await db
    .select({
      totalOfferedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.offered} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
      totalWorkedHours: sql<number>`COALESCE(SUM(CASE WHEN ${eventEntriesTable.worked} = true THEN COALESCE(${eventEntriesTable.hoursOverride}::numeric, ${eventsTable.defaultHours}) ELSE 0 END), 0)`,
    })
    .from(eventEntriesTable)
    .innerJoin(eventsTable, eq(eventEntriesTable.eventId, eventsTable.id))
    .$dynamic()
    .where(rosterId !== undefined ? eq(eventsTable.rosterId, rosterId) : sql`true`);

  const [empCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(employeesTable)
    .$dynamic()
    .where(
      rosterId !== undefined
        ? sql`${employeesTable.active} = true AND ${employeesTable.rosterId} = ${rosterId}`
        : eq(employeesTable.active, true)
    );

  const allEmployees = await db
    .select()
    .from(employeesTable)
    .$dynamic()
    .where(rosterId !== undefined ? eq(employeesTable.rosterId, rosterId) : sql`true`);

  const topWorkers = await Promise.all(
    allEmployees.map(async (emp) => {
      const [hrs] = await db
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
        totalWorkedHours: Number(hrs?.totalWorkedHours ?? 0),
        totalOfferedHours: Number(hrs?.totalOfferedHours ?? 0),
      };
    })
  );

  const sortedTopWorkers = topWorkers
    .sort((a, b) => b.totalWorkedHours - a.totalWorkedHours)
    .slice(0, 5);

  const recentEventsRaw = await db
    .select()
    .from(eventsTable)
    .$dynamic()
    .where(rosterId !== undefined ? eq(eventsTable.rosterId, rosterId) : sql`true`)
    .orderBy(desc(eventsTable.date), desc(eventsTable.createdAt))
    .limit(5);
  const recentEventsWithEntries = await Promise.all(
    recentEventsRaw.map(async (event) => {
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
        rosterId: event.rosterId,
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
    })
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
