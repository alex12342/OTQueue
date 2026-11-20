-- 0002 event audit trail (created-by / created-at exposure + edit history).
-- Idempotent by design: safe to re-run over a push-era deployment whose schema
-- was only partially synced (objects are created only if missing; existing
-- columns, values, and data are never touched). Pre-existing events keep NULL
-- audit fields — the API treats them as "unknown author" rather than backfilling.
-- Do NOT regenerate this file with `drizzle-kit generate` — the generated
-- (non-idempotent) form would break partially-migrated databases on re-run.
CREATE TABLE IF NOT EXISTS "event_edit_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" varchar(36),
	"user_name" text,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "created_by" varchar(36);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "created_by_name" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "updated_by" varchar(36);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "updated_by_name" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_edit_history_event_id_events_id_fk'
      AND conrelid = 'event_edit_history'::regclass
  ) THEN
    ALTER TABLE "event_edit_history" ADD CONSTRAINT "event_edit_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_edit_history_user_id_users_id_fk'
      AND conrelid = 'event_edit_history'::regclass
  ) THEN
    ALTER TABLE "event_edit_history" ADD CONSTRAINT "event_edit_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_edit_history_event_id_idx" ON "event_edit_history" USING btree ("event_id");--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_created_by_users_id_fk'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_updated_by_users_id_fk'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
