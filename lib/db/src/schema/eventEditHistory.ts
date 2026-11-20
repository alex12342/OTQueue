import { pgTable, serial, integer, text, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { eventsTable } from "./events";
import { usersTable } from "./users";

// One change recorded inside an edit (e.g. one field or one employee's entry).
export const eventEditChangeSchema = z.object({
  field: z.string(),
  label: z.string(),
  // Human-readable before/after values; null means "not applicable"
  // (e.g. an employee added to the roster has no previous value).
  from: z.string().nullable(),
  to: z.string().nullable(),
});
export type EventEditChange = z.infer<typeof eventEditChangeSchema>;

// Append-only audit trail of edits made to an event via PATCH /events/:id.
// Rows are removed only when the event itself is deleted (cascade).
export const eventEditHistoryTable = pgTable(
  "event_edit_history",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
    // Nullable + name snapshot so history survives user deletion/renames.
    userId: varchar("user_id", { length: 36 }).references(() => usersTable.id, { onDelete: "set null" }),
    userName: text("user_name"),
    changes: jsonb("changes").notNull().default(sql`'[]'::jsonb`).$type<EventEditChange[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("event_edit_history_event_id_idx").on(table.eventId)],
);

export type EventEditHistory = typeof eventEditHistoryTable.$inferSelect;
