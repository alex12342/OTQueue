import { pgTable, text, serial, numeric, date, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { rostersTable } from "./rosters";
import { usersTable } from "./users";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().references(() => rostersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  defaultHours: numeric("default_hours", { precision: 5, scale: 2 }).notNull(),
  dayType: text("day_type").notNull().default("weekday"),
  multiplier: numeric("multiplier", { precision: 5, scale: 2 }).notNull().default("1.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Audit fields (nullable: rows created before this feature have no author info).
  // Name snapshots survive user renames and hard deletes; the FK keeps userIds valid.
  createdBy: varchar("created_by", { length: 36 }).references(() => usersTable.id, { onDelete: "set null" }),
  createdByName: text("created_by_name"),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => usersTable.id, { onDelete: "set null" }),
  updatedByName: text("updated_by_name"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const insertEventSchema = z.object({
  date: z.string(),
  description: z.string(),
  rosterId: z.number(),
  dayType: z.string().optional(),
  multiplier: z.string().optional(),
  defaultHours: z.string(),
  createdBy: z.string().nullish(),
  createdByName: z.string().nullish(),
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
