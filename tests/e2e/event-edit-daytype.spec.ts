import { expect, test, type Page } from "@playwright/test";

const SUFFIX = Date.now().toString(36);

let createdRosters: number[] = [];

async function api(page: Page, path: string, init?: { method?: string; data?: unknown }) {
  const res = await page.request.fetch("/api" + path, { method: init?.method ?? "GET", data: init?.data });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok()) throw new Error(`${res.status()} ${path}: ${text}`);
  return body;
}

test.afterEach(async ({ page }) => {
  for (const id of createdRosters.splice(0)) {
    await page.request.fetch(`/api/rosters/${id}`, { method: "DELETE" }).catch(() => {});
  }
});

async function setupRoster(page: Page) {
  const roster = await api(page, "/rosters", { method: "POST", data: { name: `DayTypeFix-${SUFFIX}` } });
  createdRosters.push(roster.id);
  await api(page, `/rosters/${roster.id}/day-type-config/weekday`, {
    method: "PUT",
    data: { name: "Weekday", enabled: true, multiplier: 1 },
  });
  await api(page, `/rosters/${roster.id}/day-type-config/weekend`, {
    method: "PUT",
    data: { name: "Weekend", enabled: true, multiplier: 1.5 },
  });
  const emp = await api(page, "/employees", {
    method: "POST",
    data: { rosterId: roster.id, name: `Alice-${SUFFIX}`, hireDate: "2020-01-01" },
  });
  return { roster, emp };
}

async function setActiveRoster(page: Page, rosterId: number, path = "/log") {
  await page.goto(path);
  await page.evaluate((id) => localStorage.setItem("otqueue_active_roster_id", String(id)), rosterId);
  await page.reload();
}

test.describe("edit event preserves day type", () => {
  test("untouched save keeps weekend type and multiplier, field shows the value", async ({ page }) => {
    const { roster, emp } = await setupRoster(page);
    const ev = await api(page, "/events", {
      method: "POST",
      data: {
        rosterId: roster.id,
        date: "2026-10-31",
        description: `Halloween cleanup ${SUFFIX}`,
        defaultHours: 4,
        dayType: "weekend",
        multiplier: 1.5,
        entries: [{ employeeId: emp.id, offered: true, worked: true }],
      },
    });

    await setActiveRoster(page, roster.id);
    await page.goto(`/events/${ev.id}/edit`);

    const dayTypeSelect = page.getByTestId("select-event-day-type");
    await expect(dayTypeSelect).toBeVisible();
    await expect(dayTypeSelect).toContainText("Weekend");

    for (const [headerName, testid] of [["Offered", `checkbox-offered-${emp.id}`], ["Worked", `checkbox-worked-${emp.id}`]] as const) {
      const header = await page.getByRole("columnheader", { name: headerName }).boundingBox();
      const box = await page.getByTestId(testid).boundingBox();
      expect(header && box).toBeTruthy();
      expect(Math.abs(header!.x + header!.width / 2 - (box!.x + box!.width / 2))).toBeLessThanOrEqual(2);
    }

    await page.locator("#description").fill(`Halloween cleanup edited ${SUFFIX}`);
    await page.getByTestId("button-submit-edit-event").click();

    await expect(page).toHaveURL(/\/log$/);
    const after = await api(page, `/events/${ev.id}`);
    expect(after.dayType).toBe("weekend");
    expect(after.multiplier).toBe(1.5);
    await expect(page.getByText(`Halloween cleanup edited ${SUFFIX}`)).toBeVisible();
    await expect(page.getByText("×1.5")).toBeVisible();
  });

  test("day type with disabled config still shows in the select and survives a save", async ({ page }) => {
    const { roster, emp } = await setupRoster(page);
    const ev = await api(page, "/events", {
      method: "POST",
      data: {
        rosterId: roster.id,
        date: "2026-10-31",
        description: `Disabled type event ${SUFFIX}`,
        defaultHours: 4,
        dayType: "weekend",
        multiplier: 1.5,
        entries: [{ employeeId: emp.id, offered: true, worked: true }],
      },
    });
    await api(page, `/rosters/${roster.id}/day-type-config/weekend`, {
      method: "PUT",
      data: { name: "Weekend", enabled: false, multiplier: 1.5 },
    });

    await setActiveRoster(page, roster.id);
    await page.goto(`/events/${ev.id}/edit`);

    const dayTypeSelect = page.getByTestId("select-event-day-type");
    await expect(dayTypeSelect).toContainText("Weekend");

    await page.getByTestId("button-submit-edit-event").click();
    await expect(page).toHaveURL(/\/log$/);

    const after = await api(page, `/events/${ev.id}`);
    expect(after.dayType).toBe("weekend");
    expect(after.multiplier).toBe(1.5);
  });

  test("system baseline event shows System (locked) and stays system on save", async ({ page }) => {
    const roster = await api(page, "/rosters", { method: "POST", data: { name: `DayTypeSys-${SUFFIX}` } });
    createdRosters.push(roster.id);

    const emp = await api(page, "/employees", {
      method: "POST",
      data: { rosterId: roster.id, name: `Bob-${SUFFIX}`, hireDate: "2019-01-01", startingNormalizedHours: 5 },
    });
    const events = await api(page, `/events?rosterId=${roster.id}`);
    const sysEvent = events.find((e: { dayType: string }) => e.dayType === "system");
    expect(sysEvent, `no system baseline event for ${emp.name}`).toBeTruthy();

    await setActiveRoster(page, roster.id);
    await page.goto(`/events/${sysEvent.id}/edit`);

    const dayTypeSelect = page.getByTestId("select-event-day-type");
    await expect(dayTypeSelect).toContainText("System");
    await expect(dayTypeSelect).toBeDisabled();

    await page.getByTestId("button-submit-edit-event").click();
    await expect(page).toHaveURL(/\/log$/);

    const after = await api(page, `/events/${sysEvent.id}`);
    expect(after.dayType).toBe("system");
  });
});
