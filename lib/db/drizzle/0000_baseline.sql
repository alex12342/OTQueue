CREATE TABLE "admin_sessions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"session_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_change_required" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"google_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "rosters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"roster_id" integer NOT NULL,
	"use_offered_hours" boolean DEFAULT true NOT NULL,
	"use_seniority" boolean DEFAULT true NOT NULL,
	"use_subclass_ordering" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_settings_roster_id_unique" UNIQUE("roster_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"roster_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subclass_day_type_sort" (
	"roster_id" integer NOT NULL,
	"subclass_id" integer NOT NULL,
	"day_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "subclass_day_type_sort_roster_id_subclass_id_day_type_pk" PRIMARY KEY("roster_id","subclass_id","day_type")
);
--> statement-breakpoint
CREATE TABLE "subclasses" (
	"id" serial PRIMARY KEY NOT NULL,
	"roster_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"roster_id" integer NOT NULL,
	"name" text NOT NULL,
	"seniority" integer NOT NULL,
	"category" text DEFAULT 'full_time' NOT NULL,
	"role_id" integer,
	"subclass_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"starting_normalized_hours" numeric DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"roster_id" integer NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"default_hours" numeric(5, 2) NOT NULL,
	"day_type" text DEFAULT 'weekday' NOT NULL,
	"multiplier" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"employee_id" integer,
	"offered" boolean DEFAULT false NOT NULL,
	"worked" boolean DEFAULT false NOT NULL,
	"hours_override" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_day_type_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"roster_id" integer NOT NULL,
	"day_type" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"multiplier" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_settings" ADD CONSTRAINT "roster_settings_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subclass_day_type_sort" ADD CONSTRAINT "subclass_day_type_sort_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subclass_day_type_sort" ADD CONSTRAINT "subclass_day_type_sort_subclass_id_subclasses_id_fk" FOREIGN KEY ("subclass_id") REFERENCES "public"."subclasses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_subclass_id_subclasses_id_fk" FOREIGN KEY ("subclass_id") REFERENCES "public"."subclasses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_day_type_config" ADD CONSTRAINT "roster_day_type_config_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roster_day_type_config_unique" ON "roster_day_type_config" USING btree ("roster_id","day_type");