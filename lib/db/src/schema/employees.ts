import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { rostersTable } from "./rosters";
import { rolesTable, subclassesTable } from "./classifications";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().references(() => rostersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  seniority: integer("seniority").notNull(),
  category: text("category").notNull().default("full_time").$type<"four_hour" | "full_time">(),
  roleId: integer("role_id").references(() => rolesTable.id, { onDelete: "set null" }),
  subclassId: integer("subclass_id").references(() => subclassesTable.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  startingNormalizedHours: numeric("starting_normalized_hours").default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeSchema = z.object({
  name: z.string(),
  rosterId: z.number(),
  subclassId: z.number().nullish(),
  seniority: z.number(),
  category: z.enum(["four_hour", "full_time"]).optional(),
  roleId: z.number().nullish(),
  active: z.boolean().optional(),
  startingNormalizedHours: z.number().optional(),
});
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
