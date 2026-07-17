import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { rostersTable } from "./rosters";

export const rosterSettingsTable = pgTable("roster_settings", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().unique().references(() => rostersTable.id, { onDelete: "cascade" }),
  useOfferedHours: boolean("use_offered_hours").notNull().default(true),
  useSeniority: boolean("use_seniority").notNull().default(true),
  useSubclassOrdering: boolean("use_subclass_ordering").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRosterSettingsSchema = z.object({
  rosterId: z.number(),
  useOfferedHours: z.boolean().optional(),
  useSeniority: z.boolean().optional(),
  useSubclassOrdering: z.boolean().optional(),
});
export type InsertRosterSettings = z.infer<typeof insertRosterSettingsSchema>;
export type RosterSettings = typeof rosterSettingsTable.$inferSelect;
