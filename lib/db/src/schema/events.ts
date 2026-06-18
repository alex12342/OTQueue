import { pgTable, text, serial, numeric, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { rostersTable } from "./rosters";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().references(() => rostersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  defaultHours: numeric("default_hours", { precision: 5, scale: 2 }).notNull(),
  dayType: text("day_type").notNull().default("weekday").$type<"weekday" | "weekend" | "holiday">(),
  multiplier: numeric("multiplier", { precision: 5, scale: 2 }).notNull().default("1.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
