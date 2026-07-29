import { pgTable, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const systemSettingsTable = pgTable("system_settings", {
  key: varchar("key", { length: 100 }).notNull().primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
