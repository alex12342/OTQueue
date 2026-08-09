# OTQueue

A web application for tracking and fairly distributing overtime at shift-based jobs. Supports multiple rosters, role/subclass classification, holiday day types, and weighted fairness hours.

---

## Quick Start (Docker)

The simplest way to run OTQueue is with Docker. A single container bundles Node.js, PostgreSQL, Nginx, and the Express API.

### Minimum viable setup

```yaml
# docker-compose.yml
services:
  otqueue-app:
    image: alex12342/otqueue
    container_name: otqueue
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - ./data:/app/data
```

```bash
mkdir -p data
docker compose up -d
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Build from source

```yaml
# docker-compose.yml
services:
  otqueue-app:
    build: .
    container_name: otqueue
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - ./data:/app/data
```

```bash
mkdir -p data
docker compose up -d --build
```

### Default credentials

| Field    | Value            |
|----------|------------------|
| Email    | `admin@otqueue.local` |
| Password | `Admin@123!`     |

> **Important:** The admin user is created automatically on first run. You will be prompted to change the password after logging in.

---

## Full Configuration (with SSO)

For production use, create a `.env` file alongside your `docker-compose.yml`:

```env
# ── SSO / Google OAuth ──────────────────────────────────────────────
SSO_ENABLED=true
SSO_PROVIDER=google
SSO_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
SSO_CLIENT_SECRET=your-google-oauth-client-secret
SSO_ALLOWED_DOMAIN=yourcompany.com          # optional: restrict to a domain

# ── App URL (used for password-reset links, OAuth redirects) ────────
APP_URL=https://otqueue.yourcompany.com

# ── CORS ────────────────────────────────────────────────────────────
CORS_ORIGIN=https://otqueue.yourcompany.com

# ── Logging ─────────────────────────────────────────────────────────
LOG_LEVEL=warn
```

Then update your `docker-compose.yml`:

```yaml
services:
  otqueue-app:
    image: alex12342/otqueue
    container_name: otqueue
    restart: unless-stopped
    ports:
      - "8080:80"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
```

### SSO setup notes

1. Register a Google OAuth 2.0 client at [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Set the **Authorized redirect URI** to:
   ```
   https://otqueue.yourcompany.com/api/auth/google/callback
   ```
3. If you want to restrict login to specific emails, create `/app/data/sso-whitelist.json` inside the container (mapped from `./data/sso-whitelist.json` on the host):
   ```json
   ["alice@yourcompany.com", "bob@yourcompany.com"]
   ```
   Then set `SSO_ALLOW_WHITELIST=true`.

---

## Environment Variables Reference

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP listener port (internal) | `8080` |
| `NODE_ENV` | `production` or `development` | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/otqueue` |
| `JWT_SECRET` | Signed session tokens (auto-generated on first run) | auto-generated |
| `SSO_ENABLED` | Enable SSO login | `false` |
| `SSO_PROVIDER` | OAuth provider (`google`) | `google` |
| `SSO_CLIENT_ID` | Google OAuth client ID | — |
| `SSO_CLIENT_SECRET` | Google OAuth client secret | — |
| `SSO_ALLOWED_DOMAIN` | Restrict login to a domain | — |
| `SSO_ALLOW_WHITELIST` | Require explicit email whitelist | `false` |
| `SSO_WHITELIST_FILE` | Path to whitelist JSON file | `/app/data/sso-whitelist.json` |
| `CORS_ORIGIN` | Allowed frontend origins (`*` for dev) | `*` |
| `EMAIL_HOST` | SMTP host (enables email) | — |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | SMTP username | — |
| `EMAIL_PASS` | SMTP password | — |
| `EMAIL_FROM` | Sender address for emails | — |
| `LOG_LEVEL` | Log verbosity (`debug` → `error`) | `info` |
| `APP_URL` | Public application URL | `http://localhost` |
| `DEFAULT_ADMIN_EMAIL` | Override default admin email | `admin@otqueue.local` |
| `DEFAULT_ADMIN_PASSWORD` | Override default admin password | `Admin@123!` |

See `.env.example` for the complete list with comments.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     otqueue-app (single container)      │
│                                                         │
│  ┌──────────┐    /api     ┌──────────┐                  │
│  │  Nginx   │ ──────────► │ Express  │ ──► PostgreSQL   │
│  │  :80     │  reverse    │  :8080   │   :5432          │
│  │          │  proxy      │          │                  │
│  │ Frontend │             │  API     │                  │
│  │ (React)  │             │  Server  │                  │
│  └──────────┘             └──────────┘                  │
└─────────────────────────────────────────────────────────┘
```

- **Frontend**: React 19 + Vite 7 + Tailwind 4 + shadcn/ui + TanStack Query
- **Backend**: Express 5 + esbuild + pino logger
- **Database**: PostgreSQL 17 (embedded, managed by entrypoint.sh)
- **ORM**: Drizzle ORM with idempotent schema migrations at every startup

---

## Data Persistence

All persistent data lives in the mounted `./data` volume:

| Path | Contents |
|---|---|
| `/app/data/postgres/` | PostgreSQL WAL and data files |
| `/app/data/.jwt-secret` | Generated JWT signing secret (persisted across restarts) |
| `/app/data/sso-whitelist.json` | Optional SSO email whitelist |

---

## Development (local)

Requires **pnpm** — npm and yarn are explicitly blocked.

```bash
pnpm install
pnpm run build          # typecheck → build all packages
pnpm run typecheck      # run typecheck only
```

### Per-package dev servers

```bash
# Frontend (Vite dev server)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/overtime-tracker dev

# Backend (Express + esbuild)
PORT=3000 DATABASE_URL=postgresql://user:pass@localhost:5432/otqueue pnpm --filter @workspace/api-server dev
```

### Database

```bash
pnpm --filter db push           # safe schema push
pnpm --filter db push-force     # force schema push (idempotent)
```

### Codegen (after editing `lib/api-spec/openapi.yaml`)

```bash
pnpm --filter @workspace/api-spec codegen
pnpm run typecheck:libs         # validate generated code
```

---

## Useful Commands

```bash
# Stop / restart
docker compose down
docker compose up -d

# View logs
docker compose logs -f otqueue-app

# Rebuild after Dockerfile changes
docker compose up -d --build

# Reset everything (destroys all data!)
docker compose down -v
mkdir -p data
docker compose up -d
```

---

## Build Artifacts (git-ignored)

- `dist/`, `*.tsbuildinfo` — regenerated
- `lib/*/src/generated/` — Orval codegen output
- `.playwright-mcp/` — MCP runtime cache

---

## License

GPL 3.0
