import { pgTable, serial, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { eventsTable } from "./events";
import { employeesTable } from "./employees";

export const eventEntriesTable = pgTable("event_entries", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").references(() => employeesTable.id, { onDelete: "set null" }),
  offered: boolean("offered").notNull().default(false),
  worked: boolean("worked").notNull().default(false),
  hoursOverride: numeric("hours_override", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventEntrySchema = z.object({
  eventId: z.number(),
  employeeId: z.number().nullish(),
  offered: z.boolean().optional(),
  worked: z.boolean().optional(),
  hoursOverride: z.number().nullish(),
});
export type InsertEventEntry = z.infer<typeof insertEventEntrySchema>;
export type EventEntry = typeof eventEntriesTable.$inferSelect & { employeeId: number | null };
