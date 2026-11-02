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

function isoDate(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().split("T")[0];
}

async function setupRoster(page: Page, name: string) {
  const roster = await api(page, "/rosters", { method: "POST", data: { name: `${name}-${SUFFIX}` } });
  createdRosters.push(roster.id);
  const alice = await api(page, "/employees", {
    method: "POST",
    data: { rosterId: roster.id, name: `Alice-${SUFFIX}`, hireDate: "2020-01-01" },
  });
  const bob = await api(page, "/employees", {
    method: "POST",
    data: { rosterId: roster.id, name: `Bob-${SUFFIX}`, hireDate: "2019-01-01" },
  });
  return { roster, alice, bob };
}

async function setActiveRoster(page: Page, rosterId: number, path = "/log") {
  await page.goto(path);
  await page.evaluate((id) => localStorage.setItem("otqueue_active_roster_id", String(id)), rosterId);
  await page.reload();
}

interface RankedEmployee {
  id: number;
  rank: number;
  fairnessScore: number;
  totalOfferedHours: number;
}

async function upNext(page: Page, rosterId: number): Promise<RankedEmployee[]> {
  const data = await api(page, `/up-next?rosterId=${rosterId}`);
  return data.employees.map((e: RankedEmployee) => ({ id: e.id, rank: e.rank, fairnessScore: e.fairnessScore, totalOfferedHours: e.totalOfferedHours }));
}

async function employeeTotals(page: Page, rosterId: number) {
  const list = await api(page, `/employees?rosterId=${rosterId}`);
  return Object.fromEntries(
    list.map((e: { id: number; totalOfferedHours: number; fairnessScore: number }) => [e.id, { totalOfferedHours: e.totalOfferedHours, fairnessScore: e.fairnessScore }]),
  );
}

test.describe("scheduled (upcoming) events", () => {
  test("future-dated event does not affect totals or rotation until its date", async ({ page }) => {
    const { roster, alice, bob } = await setupRoster(page, "UpcomingPlan");

    const beforeTotals = await employeeTotals(page, roster.id);
    const beforeRanking = await upNext(page, roster.id);

    await api(page, "/events", {
      method: "POST",
      data: {
        rosterId: roster.id,
        date: isoDate(1),
        description: `Planned line cleanup ${SUFFIX}`,
        defaultHours: 8,
        dayType: "weekday",
        multiplier: 1,
        entries: [
          { employeeId: alice.id, offered: true, worked: true },
          { employeeId: bob.id, offered: true, worked: false },
        ],
      },
    });

    const afterTotals = await employeeTotals(page, roster.id);
    expect(afterTotals).toEqual(beforeTotals);

    const afterRanking = await upNext(page, roster.id);
    expect(afterRanking).toEqual(beforeRanking);

    // The scheduled event is still visible in the log data.
    const events = await api(page, `/events?rosterId=${roster.id}`);
    const planned = events.find((e: { description: string }) => e.description === `Planned line cleanup ${SUFFIX}`);
    expect(planned).toBeTruthy();
  });

  test("same-day event counts immediately (date reached)", async ({ page }) => {
    const { roster, alice } = await setupRoster(page, "UpcomingToday");

    const beforeTotals = await employeeTotals(page, roster.id);

    await api(page, "/events", {
      method: "POST",
      data: {
        rosterId: roster.id,
        date: isoDate(0),
        description: `Today coverage ${SUFFIX}`,
        defaultHours: 6,
        dayType: "weekday",
        multiplier: 1,
        entries: [{ employeeId: alice.id, offered: true, worked: true }],
      },
    });

    const afterTotals = await employeeTotals(page, roster.id);
    expect(afterTotals[alice.id].totalOfferedHours).toBe(beforeTotals[alice.id].totalOfferedHours + 6);
    expect(afterTotals[alice.id].fairnessScore).toBeGreaterThan(beforeTotals[alice.id].fairnessScore);

    const ranking = await upNext(page, roster.id);
    const aliceRow = ranking.find((e) => e.id === alice.id)!;
    const bobRow = ranking.find((e) => e.id !== alice.id)!;
    expect(aliceRow.fairnessScore).toBeGreaterThan(bobRow.fairnessScore);
  });

  test("log shows Upcoming badge and Agreed labels for scheduled events", async ({ page }) => {
    const { roster, alice } = await setupRoster(page, "UpcomingUI");

    const ev = await api(page, "/events", {
      method: "POST",
      data: {
        rosterId: roster.id,
        date: isoDate(1),
        description: `Scheduled deep clean ${SUFFIX}`,
        defaultHours: 4,
        dayType: "weekday",
        multiplier: 1,
        entries: [{ employeeId: alice.id, offered: true, worked: true }],
      },
    });

    await setActiveRoster(page, roster.id);
    await expect(page.getByTestId(`badge-upcoming-${ev.id}`)).toBeVisible();
    const row = page.locator("tr").filter({ hasText: `Alice-${SUFFIX}` });
    await expect(row.getByText("Agreed")).toBeVisible();

    await page.goto(`/events/${ev.id}/edit`);
    await expect(page.getByTestId("worked-column-header")).toHaveText("Agreed");
    await expect(page.getByTestId("scheduled-banner")).toBeVisible();
  });
});
