import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const rostersTable = pgTable("rosters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRosterSchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
});
export type InsertRoster = z.infer<typeof insertRosterSchema>;
export type Roster = typeof rostersTable.$inferSelect;
