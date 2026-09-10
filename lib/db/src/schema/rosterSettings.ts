import { pgTable, serial, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { rostersTable } from "./rosters";

export type SeniorityMode = "manual" | "hire_date";

export const rosterSettingsTable = pgTable("roster_settings", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().unique().references(() => rostersTable.id, { onDelete: "cascade" }),
  useOfferedHours: boolean("use_offered_hours").notNull().default(true),
  useSeniority: boolean("use_seniority").notNull().default(true),
  useSubclassOrdering: boolean("use_subclass_ordering").notNull().default(true),
  seniorityMode: text("seniority_mode").notNull().default("manual").$type<SeniorityMode>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRosterSettingsSchema = z.object({
  rosterId: z.number(),
  useOfferedHours: z.boolean().optional(),
  useSeniority: z.boolean().optional(),
  useSubclassOrdering: z.boolean().optional(),
  seniorityMode: z.enum(["manual", "hire_date"]).optional(),
});
export type InsertRosterSettings = z.infer<typeof insertRosterSettingsSchema>;
export type RosterSettings = typeof rosterSettingsTable.$inferSelect;
