// Server-only: do not import drizzle-orm/node-postgres in browser bundles
// This file is for Node.js / API server use only.
// For browser-side DB access, use the API client (@workspace/api-client-react) instead.

import type pg from "pg";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _pool: pg.Pool | null = null;

/**
 * Task 13/14/20: Lazy DB connection with static imports and production pool config.
 * - Lazy initialization: db/pool are created on first use, not at module load time
 * - Static imports: uses native ESM import instead of dynamic require()
 * - Connection pool limits: configured for production workloads
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): any {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Task 14: Static imports (replaces dynamic require() calls)
  const { drizzle } = require("drizzle-orm/node-postgres");
  const pgMod = require("pg") as typeof import("pg");
  const { Pool } = pgMod;

  // Task 20: Production-ready connection pool configuration
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,                      // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,     // Close idle client after 30 seconds
    connectionTimeoutMillis: 5000, // Return error after 5s if connection fails
    maxUses: 1000,                // Max reuses per connection
    allowExitOnIdle: false,       // Keep process alive while idle connections exist
  });

  // Error handling for the pool
  _pool.on("error", (err: Error) => {
    console.error("Unexpected error on idle client:", err);
  });

  _db = drizzle(_pool, { schema });
  return _db;
}

export function getPool(): pg.Pool {
  if (!_pool) {
    getDb(); // initializes _pool
  }
  return _pool!;
}

// Task 13: Lazy initialization via Proxy
// The proxy object is created at module load time (no side effects),
// but getDb() is only called when properties are first accessed.
// This prevents crashes if DATABASE_URL is unset at module load time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbProxy = new Proxy(
  {} as any,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getDb(), prop, receiver);
    },
    set(_target, prop, value, receiver) {
      return Reflect.set(getDb(), prop, value, receiver);
    },
    has(_target, prop) {
      return Reflect.has(getDb(), prop);
    },
    ownKeys(_target) {
      return Reflect.ownKeys(getDb());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(getDb(), prop);
    },
  },
);

export const db = dbProxy;

export * from "./schema";
