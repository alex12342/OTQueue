import { sql, type SQL } from "drizzle-orm";
import { db, employeesTable, rosterSettingsTable, type SeniorityMode } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface SeniorityComparable {
  seniority: number | null;
  hireDate: string | null;
  priorityRank: number | null;
  name: string;
}

/**
 * Mode-aware seniority comparator.
 * manual:    stored seniority ASC (nulls last), then name ASC
 * hire_date: hireDate ASC (nulls last, oldest = highest seniority),
 *            priorityRank ASC (nulls last), then name ASC
 */
export function compareSeniority(
  a: SeniorityComparable,
  b: SeniorityComparable,
  mode: SeniorityMode
): number {
  if (mode === "hire_date") {
    const ah = a.hireDate;
    const bh = b.hireDate;
    if (ah !== null && bh !== null && ah !== bh) return ah < bh ? -1 : 1;
    if (ah === null && bh !== null) return 1;
    if (ah !== null && bh === null) return -1;
    const ap = a.priorityRank;
    const bp = b.priorityRank;
    if (ap !== null && bp !== null && ap !== bp) return ap - bp;
    if (ap === null && bp !== null) return 1;
    if (ap !== null && bp === null) return -1;
    return a.name.localeCompare(b.name);
  }
  const as = a.seniority;
  const bs = b.seniority;
  if (as !== null && bs !== null && as !== bs) return as - bs;
  if (as === null && bs !== null) return 1;
  if (as !== null && bs === null) return -1;
  return a.name.localeCompare(b.name);
}

/**
 * SQL ORDER BY fragments for sorting employees rows by the active seniority mode.
 * Spread into drizzle orderBy: `.orderBy(...seniorityOrderBy(mode))`.
 */
export function seniorityOrderBy(mode: SeniorityMode): SQL[] {
  if (mode === "hire_date") {
    return [
      sql`${employeesTable.hireDate} ASC NULLS LAST`,
      sql`${employeesTable.priorityRank} ASC NULLS LAST`,
      sql`${employeesTable.name} ASC`,
    ];
  }
  return [
    sql`${employeesTable.seniority} ASC NULLS LAST`,
    sql`${employeesTable.name} ASC`,
  ];
}

export interface SeniorityComparableRow extends SeniorityComparable {
  id: number;
}

/**
 * Effective seniority (display rank) per employee id.
 * manual mode: the stored seniority number passes through unchanged.
 * hire_date mode: computed 1-based rank over all provided rows (oldest hire date = 1).
 */
export function assignEffectiveSeniority(
  rows: SeniorityComparableRow[],
  mode: SeniorityMode
): Map<number, number | null> {
  if (mode === "manual") {
    return new Map(rows.map((row) => [row.id, row.seniority]));
  }
  const sorted = [...rows].sort((a, b) => compareSeniority(a, b, mode));
  return new Map(sorted.map((row, idx) => [row.id, idx + 1]));
}

/** Fetch the roster's seniority mode, defaulting to "manual" when no settings row exists. */
export async function getRosterSeniorityMode(rosterId: number): Promise<SeniorityMode> {
  const [settings] = await db
    .select({ seniorityMode: rosterSettingsTable.seniorityMode })
    .from(rosterSettingsTable)
    .where(eq(rosterSettingsTable.rosterId, rosterId));
  return settings?.seniorityMode ?? "manual";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidHireDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().split("T")[0] === value;
}
