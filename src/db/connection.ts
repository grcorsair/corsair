/**
 * Database Connection Manager
 *
 * Provides a singleton Bun.sql connection pool for Postgres.
 * Uses DATABASE_URL from environment for configuration.
 *
 * Usage:
 *   import { getDb } from "./connection";
 *   const db = getDb();
 *   const rows = await db`SELECT * FROM table`;
 */
import { SQL } from "bun";

let singleton: InstanceType<typeof SQL> | null = null;

/**
 * Create a new Bun.SQL instance for a given database URL.
 * Does not cache — each call returns a new instance.
 */
export function createDb(url: string): InstanceType<typeof SQL> {
  return new SQL({ url });
}

/**
 * Get the singleton database connection.
 * Reads DATABASE_URL from environment on first call.
 * Throws if DATABASE_URL is not set.
 */
export function getDb(): InstanceType<typeof SQL> {
  if (singleton) return singleton;

  const url = Bun.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Set it to a Postgres connection string, e.g. postgres://user:pass@localhost:5432/corsair",
    );
  }

  singleton = createDb(url);
  return singleton;
}

/**
 * Close the singleton connection and reset it.
 * Safe to call multiple times.
 */
export function closeDb(): void {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}
