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

async function selectRoster(page: Page, name: string, path = "/employees"): Promise<void> {
  const rosters = await api(page, "/rosters");
  const match = rosters.find((r: { name: string }) => r.name === name);
  if (!match) throw new Error(`Roster "${name}" not found`);
  // Navigate first so the document is on the app origin (about:blank denies
  // localStorage), then persist the roster id and reload for a clean mount.
  await page.goto(path);
  await page.evaluate((id) => localStorage.setItem("otqueue_active_roster_id", String(id)), match.id);
  await page.reload();
}

async function addEmployeeViaUi(page: Page, fields: { name: string; hireDate?: string; priority?: string; seniority?: string }) {
  await page.getByRole("button", { name: /add employee/i }).click();
  // Use stable name-attribute locators (labels carry mode-dependent "(optional)" text).
  await page.locator('input[name="name"]').first().fill(fields.name);
  if (fields.seniority !== undefined) await page.locator('input[name="seniority"]').first().fill(fields.seniority);
  if (fields.hireDate !== undefined) await page.locator('input[name="hireDate"]').first().fill(fields.hireDate);
  if (fields.priority !== undefined) await page.locator('input[name="priorityRank"]').first().fill(fields.priority);
  await page.getByRole("button", { name: /save employee/i }).click();
  await page.getByText("Employee created").waitFor({ timeout: 10000 });
}

const empRow = (page: Page, name: string) => page.locator("tr", { hasText: name });

test.describe("seniority modes", () => {
  test("new rosters default to hire_date and compute ranks", async ({ page }) => {
    const rosterName = `E2E Hire ${SUFFIX}`;
    const roster = await createRoster(page, rosterName);

    expect((await api(page, `/rosters/${roster.id}/settings`)).seniorityMode).toBe("hire_date");

    await page.goto("/employees");
    await selectRoster(page, rosterName);
    await expect(page.locator("span", { hasText: new RegExp(`^${rosterName}$`) })).toBeVisible();

    await addEmployeeViaUi(page, { name: `Oldest ${SUFFIX}`, hireDate: "2020-01-15" });
    await addEmployeeViaUi(page, { name: `Middle ${SUFFIX}`, hireDate: "2023-06-01" });
    await addEmployeeViaUi(page, { name: `Newest ${SUFFIX}`, hireDate: "2024-11-30", priority: "2" });

    await expect(empRow(page, `Oldest ${SUFFIX}`).locator("td").nth(1)).toHaveText("#1");
    await expect(empRow(page, `Oldest ${SUFFIX}`).locator("td").nth(2)).toContainText("2020-01-15");
    await expect(empRow(page, `Middle ${SUFFIX}`).locator("td").nth(1)).toHaveText("#2");
    await expect(empRow(page, `Newest ${SUFFIX}`).locator("td").nth(1)).toHaveText("#3");
    await expect(empRow(page, `Newest ${SUFFIX}`).locator("td").nth(2)).toContainText("P2");

    const list = await api(page, `/employees?rosterId=${roster.id}`);
    expect(list.map((e: { name: string }) => e.name)).toEqual([`Oldest ${SUFFIX}`, `Middle ${SUFFIX}`, `Newest ${SUFFIX}`]);
    expect(list[0].effectiveSeniority).toBe(1);
    expect(list[2].effectiveSeniority).toBe(3);
    expect(list[2].priorityRank).toBe(2);

    const upNext = await api(page, `/up-next?rosterId=${roster.id}&dayType=weekday`);
    expect(upNext.seniorityMode).toBe("hire_date");
    expect(upNext.employees.map((e: { effectiveSeniority: number }) => e.effectiveSeniority)).toEqual([1, 2, 3]);
    expect(upNext.employees[0].name).toBe(`Oldest ${SUFFIX}`);
  });

  test("priority rank breaks ties for same-day hires", async ({ page }) => {
    const rosterName = `E2E Tie ${SUFFIX}`;
    const roster = await createRoster(page, rosterName);

    await createEmployee(page, { rosterId: roster.id, name: `Tie High ${SUFFIX}`, hireDate: "2021-03-03", priorityRank: 5 });
    await createEmployee(page, { rosterId: roster.id, name: `Tie Low ${SUFFIX}`, hireDate: "2021-03-03", priorityRank: 1 });
    await createEmployee(page, { rosterId: roster.id, name: `Tie None ${SUFFIX}`, hireDate: "2021-03-03" });

    const list = await api(page, `/employees?rosterId=${roster.id}`);
    expect(list.map((e: { name: string }) => e.name)).toEqual([`Tie Low ${SUFFIX}`, `Tie High ${SUFFIX}`, `Tie None ${SUFFIX}`]);
    expect(list.map((e: { effectiveSeniority: number }) => e.effectiveSeniority)).toEqual([1, 2, 3]);

    await page.goto("/employees");
    await selectRoster(page, rosterName);
    await expect(empRow(page, `Tie Low ${SUFFIX}`).locator("td").nth(1)).toHaveText("#1");
    await expect(empRow(page, `Tie Low ${SUFFIX}`).locator("td").nth(2)).toContainText("P1");
    await expect(empRow(page, `Tie High ${SUFFIX}`).locator("td").nth(1)).toHaveText("#2");
    await expect(empRow(page, `Tie None ${SUFFIX}`).locator("td").nth(1)).toHaveText("#3");
  });

  test("manual mode passes stored seniority through, hire-date fields hidden", async ({ page }) => {
    const rosterName = `E2E Manual ${SUFFIX}`;
    const roster = await createRoster(page, rosterName);

    await api(page, `/rosters/${roster.id}/settings`, { method: "PUT", data: { seniorityMode: "manual" } });

    const rejected = await page.request.fetch("/api/employees", { method: "POST", data: { rosterId: roster.id, name: `No Seniority ${SUFFIX}` } });
    expect(rejected.status()).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: expect.stringContaining("Seniority number is required") });

    const first = await createEmployee(page, { rosterId: roster.id, name: `Manual A ${SUFFIX}`, seniority: 2 });
    const second = await createEmployee(page, { rosterId: roster.id, name: `Manual B ${SUFFIX}`, seniority: 1 });

    const list = await api(page, `/employees?rosterId=${roster.id}`);
    expect(list.map((e: { id: number }) => e.id)).toEqual([second.id, first.id]);
    expect(list.map((e: { effectiveSeniority: number }) => e.effectiveSeniority)).toEqual([1, 2]);

    await page.goto("/employees");
    await selectRoster(page, rosterName);
    // The Hired column is now always shown (hire date is a first-class field).
    await expect(page.locator("th", { hasText: /^Hired$/i })).toHaveCount(1);
    await expect(empRow(page, `Manual B ${SUFFIX}`).locator("td").nth(1)).toHaveText("#1");
    await expect(empRow(page, `Manual A ${SUFFIX}`).locator("td").nth(1)).toHaveText("#2");

    const upNext = await api(page, `/up-next?rosterId=${roster.id}&dayType=weekday`);
    expect(upNext.seniorityMode).toBe("manual");
    expect(upNext.employees[0].id).toBe(second.id);
  });

  test("switching to hire_date is blocked until every active employee has a hire date", async ({ page }) => {
    const rosterName = `E2E Guard ${SUFFIX}`;
    const roster = await createRoster(page, rosterName);
    await api(page, `/rosters/${roster.id}/settings`, { method: "PUT", data: { seniorityMode: "manual" } });

    const alice = await createEmployee(page, { rosterId: roster.id, name: `Alice ${SUFFIX}`, seniority: 1 });
    const bob = await createEmployee(page, { rosterId: roster.id, name: `Bob ${SUFFIX}`, seniority: 2 });

    const toGuard = async () => {
      await selectRoster(page, rosterName, "/settings");
      await page.getByRole("tab", { name: /criteria/i }).click();
      const select = page.getByTestId("seniority-mode-select");
      await expect(select).toContainText(/manual/i, { timeout: 10000 });
      await select.click();
      await page.getByRole("option", { name: /hire date/i }).click();
    };

    await toGuard();
    await page.getByText("Cannot enable hire-date seniority").waitFor({ timeout: 10000 });
    await page.getByText(`Alice ${SUFFIX}`).first().waitFor();
    await page.getByText(`Bob ${SUFFIX}`).first().waitFor();

    expect((await api(page, `/rosters/${roster.id}/settings`)).seniorityMode).toBe("manual");

    // In manual mode the UI hides the hire-date field, so backfill via the API
    // (the realistic "import hire dates" admin path). PATCH accepts hireDate
    // regardless of mode.
    const backfill = async (id: number, date: string) => {
      const res = await page.request.fetch(`/api/employees/${id}`, { method: "PATCH", data: { hireDate: date } });
      expect(res.status()).toBe(200);
    };
    await backfill(alice.id, "2022-01-10");
    await backfill(bob.id, "2021-05-05");

    await toGuard();
    await expect(page.getByText("Error saving settings")).toHaveCount(0, { timeout: 2000 });
    await expect(page.getByTestId("seniority-mode-select")).toContainText(/hire date/i);

    expect((await api(page, `/rosters/${roster.id}/settings`)).seniorityMode).toBe("hire_date");

    const list = await api(page, `/employees?rosterId=${roster.id}`);
    expect(list.map((e: { id: number }) => e.id)).toEqual([bob.id, alice.id]);
    expect(list.map((e: { effectiveSeniority: number }) => e.effectiveSeniority)).toEqual([1, 2]);

    await page.goto("/employees");
    await selectRoster(page, rosterName);
    await expect(empRow(page, `Bob ${SUFFIX}`).locator("td").nth(1)).toHaveText("#1");
    await expect(empRow(page, `Alice ${SUFFIX}`).locator("td").nth(1)).toHaveText("#2");
    await expect(empRow(page, `Bob ${SUFFIX}`).locator("td").nth(2)).toContainText("2021-05-05");
  });

  test("flipping back to manual keeps stored seniority values", async ({ page }) => {
    const rosterName = `E2E Flip ${SUFFIX}`;
    const roster = await createRoster(page, rosterName);

    await createEmployee(page, { rosterId: roster.id, name: `Flip A ${SUFFIX}`, hireDate: "2020-02-02", seniority: 5 });
    await createEmployee(page, { rosterId: roster.id, name: `Flip B ${SUFFIX}`, hireDate: "2019-01-01", seniority: 9 });

    let list = await api(page, `/employees?rosterId=${roster.id}`);
    expect(list[0].name).toBe(`Flip B ${SUFFIX}`);

    await api(page, `/rosters/${roster.id}/settings`, { method: "PUT", data: { seniorityMode: "manual" } });

    list = await api(page, `/employees?rosterId=${roster.id}`);
    expect(list[0].name).toBe(`Flip A ${SUFFIX}`);
    expect(list.map((e: { effectiveSeniority: number }) => e.effectiveSeniority).sort()).toEqual([5, 9]);
  });

  test("hire date is settable in manual mode via the UI, then switching to hire_date succeeds", async ({ page }) => {
    const rosterName = `E2E Hired ${SUFFIX}`;
    const roster = await createRoster(page, rosterName);
    await api(page, `/rosters/${roster.id}/settings`, { method: "PUT", data: { seniorityMode: "manual" } });

    await page.goto("/employees");
    await selectRoster(page, rosterName);

    // In manual mode the Add Employee form now shows BOTH Seniority # (required)
    // and Hire Date (optional) — the previously-missing field is present.
    await page.getByRole("button", { name: /add employee/i }).click();
    await page.locator('input[name="name"]').first().fill(`Hired One ${SUFFIX}`);
    await page.locator('input[name="seniority"]').first().fill("1");
    await expect(page.locator('input[name="hireDate"]').first()).toBeVisible();
    await page.locator('input[name="hireDate"]').first().fill("2020-05-05");

    const responsePromise = page.waitForResponse((res) => res.url().includes("/api/employees") && res.request().method() === "POST");
    await page.getByRole("button", { name: /save employee/i }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const created = await response.json();
    createdEmployees.push(created.id);
    expect(created.seniority).toBe(1);
    expect(created.hireDate).toBe("2020-05-05");

    // Because the active employee now has a hire date, switching to the
    // automatic (hire_date) mode succeeds where it was previously blocked.
    await selectRoster(page, rosterName, "/settings");
    await page.getByRole("tab", { name: /criteria/i }).click();
    const select = page.getByTestId("seniority-mode-select");
    await expect(select).toContainText(/manual/i, { timeout: 10000 });
    await select.click();
    await page.getByRole("option", { name: /hire date/i }).click();
    await expect(select).toContainText(/hire date/i);
    expect((await api(page, `/rosters/${roster.id}/settings`)).seniorityMode).toBe("hire_date");
  });
});
