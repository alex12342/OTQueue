import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const usersTable = pgTable("users", {
  id: varchar("id", { length: 36 }).notNull().default(sql`gen_random_uuid()::text`).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 })
    .notNull()
    .default("user")
    .$type<"user" | "admin" | "viewer">(),
  isActive: boolean("is_active").notNull().default(true),
  passwordChangeRequired: boolean("password_change_required").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Admin sessions table for secure admin access control
export const adminSessionsTable = pgTable("admin_sessions", {
  id: varchar("id", { length: 36 }).notNull().default(sql`gen_random_uuid()::text`).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Password reset tokens table
export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: varchar("id", { length: 36 }).notNull().default(sql`gen_random_uuid()::text`).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Schemas for validation
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string(),
  role: z.enum(["user", "admin", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  passwordChangeRequired: z.boolean().optional(),
  lastLoginAt: z.date().nullish(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;

export const selectUserSchema = createSelectSchema(usersTable);
export type User = typeof usersTable.$inferSelect;
export type NewUser = z.infer<typeof insertUserSchema>;

export const insertAdminSessionSchema = z.object({
  userId: z.string(),
  sessionToken: z.string(),
  expiresAt: z.date(),
});
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;

export const insertPasswordResetTokenSchema = z.object({
  userId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
});
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
