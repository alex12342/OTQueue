import { lte } from "drizzle-orm";
import { eventsTable } from "@workspace/db";

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// Future-dated ("scheduled") events are planning-only: their hours must not
// flow into fairness, rotation, or stats totals until the event date has been
// reached. Evaluated at query time, so totals self-correct as days pass.
export function activeEventWhere(today = todayStr()) {
  return lte(eventsTable.date, today);
}
