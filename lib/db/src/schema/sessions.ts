import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sessionsTable = pgTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
