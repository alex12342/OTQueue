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
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw otqueue; then
    echo "Creating system database: otqueue..."
    sudo -u postgres createdb otqueue
fi

# 5. Automatically push database schema changes using Drizzle
echo "Running database schema sync..."
pnpm --filter @workspace/db run push-force

# 6. Seed default admin user if no users exist
echo "Checking for default admin user..."
ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-admin@otqueue.local}"
ADMIN_NAME="${DEFAULT_ADMIN_NAME:-Admin}"
ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-Admin@123!}"

# Create seeding script inside api-server workspace so pnpm workspace deps resolve
cat > /app/artifacts/api-server/seed-admin.ts << 'SEEDSCRIPT'
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { usersTable } from "@workspace/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log("DATABASE_URL not set, skipping admin seed.");
  process.exit(0);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function seed() {
  const db = drizzle(pool);
  
  try {
    const [existingUser] = await db.select().from(usersTable).limit(1);
    
    if (existingUser) {
      console.log("Users already exist, skipping admin seed.");
      await pool.end();
      process.exit(0);
    }

    const passwordToHash = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123!";
    console.log(`DEBUG: Hashing password: "${passwordToHash}"`);

    const passwordHash = await bcrypt.hash(passwordToHash, 10);

    const [admin] = await db.insert(usersTable).values({
      email: process.env.DEFAULT_ADMIN_EMAIL || "admin@otqueue.local",
      passwordHash,
      name: process.env.DEFAULT_ADMIN_NAME || "Admin",
      role: "admin",
      passwordChangeRequired: true,
    }).returning();

    console.log("Default admin user created:", admin.email);
    console.log("Password:", process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123!");
    console.log("Please change this password after first login.");
  } catch (err) {
    console.error("Failed to seed admin user:", err.message);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

seed();
SEEDSCRIPT

# Explicitly export them so node sees them
export DEFAULT_ADMIN_EMAIL="$ADMIN_EMAIL"
export DEFAULT_ADMIN_PASSWORD="$ADMIN_PASSWORD"
export DEFAULT_ADMIN_NAME="$ADMIN_NAME"

# Run the seed script via tsx from workspace root so pnpm can resolve all deps
echo "DEBUG: DATABASE_URL=$DATABASE_URL"
echo "DEBUG: DEFAULT_ADMIN_EMAIL=$DEFAULT_ADMIN_EMAIL"
echo "DEBUG: DEFAULT_ADMIN_PASSWORD=$DEFAULT_ADMIN_PASSWORD"
cd /app && pnpm exec tsx artifacts/api-server/seed-admin.ts || echo "Note: Admin seed skipped (will be created via /api/auth/admin-setup endpoint)"

# 7. Verify frontend build files and configure Nginx permissions
echo "--- DIAGNOSTIC RUNTIME CHECK ---"
TARGET_DIR="/app/artifacts/overtime-tracker/dist/public"
if [ -d "$TARGET_DIR" ]; then
    echo "Frontend build public directory found! Mapping folder layout:"
    ls -la "$TARGET_DIR"
    
    # Allow Nginx to traverse parent folders
    chmod +x /app /app/artifacts /app/artifacts/overtime-tracker /app/artifacts/overtime-tracker/dist
    
    # Hand full read ownership of the built assets over to Nginx's native account
    chown -R www-data:www-data /app/artifacts/overtime-tracker/dist
    chmod -R 755 /app/artifacts/overtime-tracker/dist
else
    echo "WARNING: $TARGET_DIR directory was NOT found."
fi
echo "--------------------------------"

# Revert Nginx back to running as standard www-data to avoid master process rejection
if [ -f /etc/nginx/nginx.conf ]; then
    sed -i 's/user root;/user www-data;/' /etc/nginx/nginx.conf
fi

echo "Configuring internal Nginx routing proxy..."
cat << 'EOF' > /etc/nginx/sites-available/default
server {
    listen 80;
    server_name localhost;

    # Serve the built production React frontend application out of the public subfolder
    location / {
        root /app/artifacts/overtime-tracker/dist/public;
        try_files $uri $uri/ /index.html;
    }

    # Proxy backend data API requests to the Express application running on 8080
    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
EOF

echo "Starting Nginx routing service..."
service nginx start

# 7. Hands execution off to your Replit web application backend on port 8080
echo "Launching OTQue backend API server internally..."
exec pnpm --filter @workspace/api-server run dev
