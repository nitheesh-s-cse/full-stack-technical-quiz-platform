import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import dns from "node:dns";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore in environments where not supported
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === "production" || databaseUrl.includes("neon.tech")
        ? { rejectUnauthorized: false }
        : undefined,
  });

// Handle idle connection errors gracefully so Neon compute sleep doesn't crash the server
pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err);
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
