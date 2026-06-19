import { pgTable, text, serial, integer, timestamp, primaryKey, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { rostersTable } from "./rosters";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().references(() => rostersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subclassesTable = pgTable("subclasses", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().references(() => rostersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subclassDayTypeSortTable = pgTable(
  "subclass_day_type_sort",
  {
    rosterId: integer("roster_id").notNull().references(() => rostersTable.id, { onDelete: "cascade" }),
    subclassId: integer("subclass_id").notNull().references(() => subclassesTable.id, { onDelete: "cascade" }),
    dayType: text("day_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.rosterId, t.subclassId, t.dayType] }),
  ]
);

export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, createdAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof rolesTable.$inferSelect;

export const insertSubclassSchema = createInsertSchema(subclassesTable).omit({ id: true, createdAt: true });
export type InsertSubclass = z.infer<typeof insertSubclassSchema>;
export type Subclass = typeof subclassesTable.$inferSelect;

export const insertSubclassDayTypeSortSchema = createInsertSchema(subclassDayTypeSortTable);
export type InsertSubclassDayTypeSort = z.infer<typeof insertSubclassDayTypeSortSchema>;
export type SubclassDayTypeSort = typeof subclassDayTypeSortTable.$inferSelect;
