-- 0001 seniority mode (0.3.4 → 0.4.0).
-- Idempotent by design: safe to re-run over a push-era deployment whose schema
-- was only partially synced (objects are created only if missing; existing
-- columns, values, and data are never touched).
-- Do NOT regenerate this file with `drizzle-kit generate` — the generated
-- (non-idempotent) form would break partially-migrated databases on re-run.
ALTER TABLE "employees" ALTER COLUMN "seniority" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roster_settings" ADD COLUMN IF NOT EXISTS "seniority_mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "hire_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "priority_rank" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "linked_employee_id" integer;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_linked_employee_id_employees_id_fk'
      AND conrelid = 'employees'::regclass
  ) THEN
    ALTER TABLE "employees" ADD CONSTRAINT "employees_linked_employee_id_employees_id_fk" FOREIGN KEY ("linked_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
