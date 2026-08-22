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

# 5. Run Drizzle schema push (adds missing columns, does not drop data).
#    drizzle-kit ships in the self-contained /app/db package.
echo "Running database schema sync..."
(cd /app/db && node_modules/.bin/drizzle-kit push --force --config ./drizzle.config.ts)

# 6. Ensure google_id column exists on existing users tables.
#    drizzle-kit push adds the column definition but some legacy deployments
#    may predate it. This SQL is idempotent — safe to run on fresh or existing DBs.
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
