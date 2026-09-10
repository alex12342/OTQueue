import { expect, test, type Page } from "@playwright/test";

const SUFFIX = Date.now().toString(36);

let createdRosters: number[] = [];
let createdEmployees: number[] = [];

async function api(page: Page, path: string, init?: { method?: string; data?: unknown }) {
  const res = await page.request.fetch("/api" + path, { method: init?.method ?? "GET", data: init?.data });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok()) throw new Error(`${res.status()} ${path}: ${text}`);
  return body;
}

async function createRoster(page: Page, name: string) {
  const roster = await api(page, "/rosters", { method: "POST", data: { name } });
  createdRosters.push(roster.id);
  return roster;
}

interface NewEmployee {
  rosterId: number;
  name: string;
  seniority?: number | null;
  hireDate?: string | null;
  priorityRank?: number | null;
  linkedEmployeeId?: number | null;
}

async function createEmployee(page: Page, entry: NewEmployee) {
  const emp = await api(page, "/employees", { method: "POST", data: entry });
  createdEmployees.push(emp.id);
  return emp;
}

test.afterEach(async ({ page }) => {
  for (const id of createdEmployees.splice(0)) {
    await page.request.fetch(`/api/employees/${id}`, { method: "DELETE" }).catch(() => {});
  }
  for (const id of createdRosters.splice(0)) {
    await page.request.fetch(`/api/rosters/${id}`, { method: "DELETE" }).catch(() => {});
  }
});

test.describe("employee directory", () => {
  test("linked employees appear in both directions and keep independent values", async ({ page }) => {
    const sourceName = `E2E Dir A ${SUFFIX}`;
    const targetName = `E2E Dir B ${SUFFIX}`;
    const source = await createRoster(page, sourceName);
    const target = await createRoster(page, targetName);

    const original = await createEmployee(page, { rosterId: source.id, name: `Zoe ${SUFFIX}`, hireDate: "2021-07-04", seniority: 3 });

    const rejected = await page.request.fetch("/api/employees", {
      method: "POST",
      // Supply a hire date so manual/hire-date validation passes; the failure
      // under test is the cross-roster link check.
      data: { rosterId: source.id, name: `Self Link ${SUFFIX}`, hireDate: "2020-01-01", linkedEmployeeId: original.id },
    });
    expect(rejected.status()).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: expect.stringContaining("different roster") });

    await page.goto("/directory");
    await page.getByTestId("directory-search").fill(`Zoe ${SUFFIX}`);
    const row = page.locator("tr", { hasText: `Zoe ${SUFFIX}` }).first();
    await expect(row.getByText(targetName)).toHaveCount(0);

    await row.getByRole("button", { name: /add to roster/i }).click();
    await page.getByTestId("target-roster-select").click();
    // Zoe is already in the source roster, so that option is marked and disabled.
    await expect(page.getByRole("option", { name: /already in/i })).toBeDisabled();
    await expect(page.getByRole("option", { name: targetName, exact: false })).toBeEnabled();
    await page.getByRole("option", { name: targetName, exact: false }).click();
    await page.getByLabel("Hire Date").fill("2021-07-04");
    const responsePromise = page.waitForResponse((res) => res.url().includes("/api/employees") && res.request().method() === "POST");
    await page.getByRole("button", { name: /add to roster/i }).last().click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const copy = await response.json();
    createdEmployees.push(copy.id);

    expect(copy.linkedEmployeeId).toBe(original.id);
    expect(copy.rosterId).toBe(target.id);
    expect(copy.name).toBe(`Zoe ${SUFFIX}`);
    expect(copy.hireDate).toBe("2021-07-04");

    await page.getByText("Employee added to roster").waitFor({ timeout: 10000 });

    // Deduped: one person row now shows both rosters as chips.
    const zoeRow = page.locator("tr", { hasText: `Zoe ${SUFFIX}` }).first();
    await expect(zoeRow.getByText(sourceName)).toBeVisible();
    await expect(zoeRow.getByText(targetName)).toBeVisible();

    // API rows: the copy links back to the original; the original has no link.
    const all = await api(page, `/employees?search=Zoe ${encodeURIComponent(SUFFIX)}`);
    expect(all).toHaveLength(2);
    expect(all.every((e: { name: string }) => e.name === `Zoe ${SUFFIX}`)).toBeTruthy();
    const linked = all.filter((e: { id: number; linkedEmployeeId: number | null }) => e.linkedEmployeeId === original.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].id).toBe(copy.id);

    // Independent per-roster fields: edit the copy's seniority (manual target mode) — original unchanged.
    await api(page, `/rosters/${target.id}/settings`, { method: "PUT", data: { seniorityMode: "manual", useSeniority: true } });
    await api(page, `/employees/${copy.id}`, { method: "PATCH", data: { seniority: 7 } });
    await api(page, `/rosters/${source.id}/settings`, { method: "PUT", data: { seniorityMode: "manual" } });

    const after = (await api(page, `/employees?search=Zoe ${encodeURIComponent(SUFFIX)}`)) as {
      id: number; linkedEmployeeId: number | null; seniority: number | null;
    }[];
    const orig = after.find((e) => e.id === original.id)!;
    const dup = after.find((e) => e.id === copy.id)!;
    expect(orig.seniority).toBe(3);
    expect(dup.seniority).toBe(7);
    expect(dup.linkedEmployeeId).toBe(original.id);
    expect(orig.linkedEmployeeId).toBeNull();
  });

  test("directory search filters across all rosters", async ({ page }) => {
    const rosterA = await createRoster(page, `E2E Search A ${SUFFIX}`);
    const rosterB = await createRoster(page, `E2E Search B ${SUFFIX}`);

    await createEmployee(page, { rosterId: rosterA.id, name: `Filter Alpha ${SUFFIX}`, hireDate: "2020-01-01" });
    await createEmployee(page, { rosterId: rosterB.id, name: `Filter Beta ${SUFFIX}`, hireDate: "2020-02-02" });

    await page.goto("/directory");
    await page.getByTestId("directory-search").fill(`Alpha ${SUFFIX}`);
    await expect(page.locator("tr", { hasText: `Alpha ${SUFFIX}` })).toBeVisible();
    await expect(page.locator("tr", { hasText: `Beta ${SUFFIX}` })).toHaveCount(0);

    await page.getByTestId("directory-search").fill(`Gamma ${SUFFIX}`);
    await expect(page.getByText("No employees match your search.")).toBeVisible();
  });

  test("deleting a source leaves the copy intact", async ({ page }) => {
    const source = await createRoster(page, `E2E Del A ${SUFFIX}`);
    const target = await createRoster(page, `E2E Del B ${SUFFIX}`);

    const original = await createEmployee(page, { rosterId: source.id, name: `Dora ${SUFFIX}`, hireDate: "2019-04-01", seniority: 2 });
    const copy = await createEmployee(page, {
      rosterId: target.id,
      name: `Dora ${SUFFIX}`,
      hireDate: "2019-04-01",
      seniority: 8,
      linkedEmployeeId: original.id,
    });

    await page.request.fetch(`/api/employees/${original.id}`, { method: "DELETE" });
    createdEmployees = createdEmployees.filter((id) => id !== original.id);

    const [remaining] = (await api(page, `/employees?search=Dora ${encodeURIComponent(SUFFIX)}`)) as { id: number; name: string; active: boolean }[];
    expect(remaining.id).toBe(copy.id);
    expect(remaining.active).toBe(true);
    expect(remaining.name).toBe(`Dora ${SUFFIX}`);

    await page.goto("/directory");
    await page.getByTestId("directory-search").fill(`Dora ${SUFFIX}`);
    await expect(page.locator("tr", { hasText: `Dora ${SUFFIX}` })).toHaveCount(1);
  });
});
