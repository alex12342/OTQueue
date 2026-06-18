import { pgTable, serial, integer, boolean, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { rostersTable } from "./rosters";

export const dayTypeConfigTable = pgTable(
  "roster_day_type_config",
  {
    id: serial("id").primaryKey(),
    rosterId: integer("roster_id")
      .notNull()
      .references(() => rostersTable.id, { onDelete: "cascade" }),
    dayType: text("day_type").notNull(),
    name: text("name").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    multiplier: text("multiplier"),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("roster_day_type_config_unique").on(t.rosterId, t.dayType)]
);

export const insertDayTypeConfigSchema = createInsertSchema(dayTypeConfigTable).omit({ id: true, updatedAt: true });
export type InsertDayTypeConfig = z.infer<typeof insertDayTypeConfigSchema>;
export type DayTypeConfig = typeof dayTypeConfigTable.$inferSelect;
