#!/bin/bash
set -e

# Define where PostgreSQL will store data inside your persistent volume
PGDATA="/app/data/postgres"
mkdir -p "$PGDATA"

# Ensure the system runtime directories and data directories are owned by the postgres user
mkdir -p /var/run/postgresql && chown -R postgres:postgres /var/run/postgresql
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

# Generate JWT_SECRET if not provided or still the default dev value
JWT_SECRET_FILE="/app/data/.jwt-secret"
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "dev-secret-key-change-in-production-do-not-use" ]; then
    if [ ! -f "$JWT_SECRET_FILE" ]; then
        openssl rand -hex 32 > "$JWT_SECRET_FILE"
        chmod 600 "$JWT_SECRET_FILE"
        echo "Generated new JWT_SECRET"
    fi
    export JWT_SECRET=$(cat "$JWT_SECRET_FILE")
fi

# 1. Initialize Postgres if the directory is empty
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "First run detected: Initializing PostgreSQL database engine..."
    sudo -u postgres /usr/lib/postgresql/*/bin/initdb -D "$PGDATA"
    echo "listen_addresses = 'localhost'" >> "$PGDATA/postgresql.conf"
fi

# 2. Start the PostgreSQL engine
echo "Starting embedded PostgreSQL daemon..."
sudo -u postgres /usr/lib/postgresql/*/bin/pg_ctl -D "$PGDATA" -l "$PGDATA/postgres.log" start

# 3. Wait until Postgres is fully awake and accepting connections
echo "Waiting for database to accept connections..."
until sudo -u postgres /usr/lib/postgresql/*/bin/pg_isready -h localhost; do
  sleep 1
done

# 4. Create the 'otqueue' database if it doesn't exist yet
if ! sudo -u postgres psql -lqt | cut -d '|' -f 1 | grep -qw otqueue; then
    echo "Creating system database: otqueue..."
    sudo -u postgres createdb otqueue
fi

# 5. Apply Drizzle migrations (version-controlled, non-interactive, transactional).
#    Migrations are committed SQL in /app/db/drizzle/, applied in journal order
#    inside a single transaction — a failed run rolls back completely, so a
#    `migrate` crash can never leave a partial schema.
#    Applied state is tracked in drizzle.__drizzle_migrations (hash + the
#    journal timestamp), so reboots are idempotent and a missing migration
#    fails loudly (non-zero exit) instead of silently no-op'ing like `push`.
#
#    5a. Baseline pre-migration databases. 0.3.x deployments already have the
#        base tables but no migration history, so record the 0000 baseline as
#        already-applied (hash = SHA-256 of 0000, created_at = its journal
#        timestamp — exactly what `migrate` would record itself).
#        0001 is deliberately NOT baselined: it is written idempotently, so
#        `migrate` converges any push-era partial state — adding only the
#        objects that are missing and never touching existing data — and then
#        records it as applied.
#        No-op on fresh DBs (no base tables yet) and on already-migrated DBs
#        (the drizzle schema already exists).
echo "Checking for a pre-migration (0.3.x) database..."
if [ -z "$(sudo -u postgres psql -d otqueue -tAc "SELECT 1 FROM information_schema.schemata WHERE schema_name='drizzle'")" ] \
   && [ -n "$(sudo -u postgres psql -d otqueue -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rosters'")" ]; then
  echo "Existing (pre-migration) database detected — baselining migration 0000..."
  # Node emits the full baseline SQL. If it fails, the command substitution
  # fails and `set -e` aborts BEFORE anything is written to the database.
  BASELINE_SQL="$(node -e '
    const fs = require("fs"), p = require("path"), c = require("crypto");
    const d = "/app/db/drizzle";
    const e = JSON.parse(fs.readFileSync(p.join(d, "meta/_journal.json"), "utf8")).entries[0];
    const h = c.createHash("sha256").update(fs.readFileSync(p.join(d, e.tag + ".sql"))).digest("hex");
    process.stdout.write(
      "CREATE SCHEMA IF NOT EXISTS drizzle;\n"
      + "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);\n"
      + "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) SELECT \x27" + h + "\x27, " + e.when
      + " WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = \x27" + h + "\x27);\n"
    );
  ')"
  printf '%s\n' "$BASELINE_SQL" | sudo -u postgres psql -d otqueue -v ON_ERROR_STOP=1
  echo "Baseline recorded."
fi

# 5b. Apply pending migrations (0000 + 0001 on fresh DBs; 0001 on baselined DBs).
echo "Running database migrations..."
(cd /app/db && node_modules/.bin/drizzle-kit migrate --config ./drizzle.config.ts)

# 5c. Verify the 0.4.0 seniority schema landed — refuse to start if not.
#     Checks existence AND shape (type / nullability / default) of the 0001
#     columns plus the self-referencing FK, so a drifted hand-edit fails loud
#     at boot instead of surfacing as 500s at runtime.
echo "Verifying required schema objects..."
MISSING="$(sudo -u postgres psql -d otqueue -tAc "
SELECT string_agg(item, ', ' ORDER BY item) FROM (
  SELECT v.object || ' [' ||
    CASE
      WHEN c.object IS NULL THEN 'missing'
      WHEN c.data_type <> v.type THEN 'type is ' || c.data_type || ', want ' || v.type
      WHEN c.is_nullable <> v.nullable THEN 'nullability is ' || c.is_nullable || ', want ' || v.nullable
      WHEN v.def IS NOT NULL AND c.column_default IS DISTINCT FROM v.def THEN 'default is ' || c.column_default || ', want ' || v.def
      ELSE 'ok'
    END || ']' AS item
  FROM (VALUES
      ('roster_settings.seniority_mode', 'text', 'NO', '''manual''::text'),
      ('employees.hire_date', 'date', 'YES', NULL),
      ('employees.priority_rank', 'integer', 'YES', NULL),
      ('employees.linked_employee_id', 'integer', 'YES', NULL)
  ) AS v(object, type, nullable, def)
  LEFT JOIN (
    SELECT table_name || '.' || column_name AS object, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'roster_settings' AND column_name = 'seniority_mode')
        OR (table_name = 'employees' AND column_name IN ('hire_date', 'priority_rank', 'linked_employee_id')))
  ) AS c ON c.object = v.object
  WHERE c.object IS NULL
     OR c.data_type <> v.type
     OR c.is_nullable <> v.nullable
     OR (v.def IS NOT NULL AND c.column_default IS DISTINCT FROM v.def)
  UNION ALL
  SELECT 'employees.linked_employee_id FK [missing]'
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_linked_employee_id_employees_id_fk'
      AND conrelid = 'employees'::regclass
  )
) AS items
")"
if [ -n "$MISSING" ]; then
  echo "CRITICAL: schema verification failed after migration: $MISSING" >&2
  echo "CRITICAL: refusing to start with an invalid schema. Review the migration output above." >&2
  exit 1
fi
echo "Schema verification passed."

# 6. Legacy safety net: ensure google_id column exists on very old users tables.
#    Migrations already provide this column; this idempotent no-op covers
#    deployments that predate it. Safe on fresh or existing DBs.
echo "Ensuring google_id column exists on users table..."
sudo -u postgres psql -d otqueue -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
" || echo "WARNING: Could not ensure google_id column — check database connectivity"

# 7. Seed default admin user if no users exist
echo "Checking for default admin user..."
export DEFAULT_ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-admin@otqueue.local}"
export DEFAULT_ADMIN_NAME="${DEFAULT_ADMIN_NAME:-Admin}"
export DEFAULT_ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-Admin@123!}"

# The seed script is pre-bundled into the API dist at build time
node /app/artifacts/api-server/dist/seed-admin.mjs \
  || echo "Note: Admin seed skipped (will be created via /api/auth/admin-setup endpoint)"

# 8. Start Nginx (site config is baked into the image at /etc/nginx/sites-available/default)
echo "Starting Nginx routing service..."
service nginx start

# 9. Launch the backend API server on $PORT (default 8080)
echo "Launching OTQueue backend API server on port ${PORT:-8080}..."
exec node /app/artifacts/api-server/dist/index.mjs
