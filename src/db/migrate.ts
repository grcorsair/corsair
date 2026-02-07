/**
 * Migration Runner
 *
 * Reads SQL migration files from a directory, tracks which have been
 * applied in a _migrations table, and applies new ones in order.
 *
 * Idempotent — safe to run multiple times. Each migration runs inside
 * a transaction so partial failures don't corrupt state.
 *
 * Usage:
 *   import { getDb } from "./connection";
 *   import { migrate } from "./migrate";
 *   await migrate(getDb());
 */
import * as fs from "fs";
import * as path from "path";

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, "migrations");

/**
 * Get sorted list of .sql migration filenames from a directory.
 * Returns empty array if directory does not exist.
 */
export function getMigrationFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Read the SQL content of a migration file.
 */
export function readMigrationSQL(dir: string, filename: string): string {
  return fs.readFileSync(path.join(dir, filename), "utf-8");
}

/**
 * Run all pending migrations against the database.
 *
 * 1. Creates _migrations table if it does not exist
 * 2. Reads all .sql files from the migrations directory
 * 3. Checks which are already applied
 * 4. Applies unapplied ones in sorted order within a transaction
 * 5. Records each applied migration in _migrations
 */
export async function migrate(
  db: DatabaseLike,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR,
): Promise<MigrateResult> {
  // Create _migrations tracking table (idempotent)
  await db`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Get already-applied migration names
  const applied = await db`SELECT name FROM _migrations ORDER BY name`;
  const appliedSet = new Set(
    (applied as Array<{ name: string }>).map((r) => r.name),
  );

  // Get migration files and filter to unapplied
  const allFiles = getMigrationFiles(migrationsDir);
  const pending = allFiles.filter((f) => !appliedSet.has(f));

  if (pending.length === 0) {
    return { applied: 0, total: allFiles.length, files: [] };
  }

  // Apply each pending migration in a transaction
  await db.begin(async (tx: TransactionLike) => {
    for (const file of pending) {
      const sql = readMigrationSQL(migrationsDir, file);
      await tx.unsafe(sql);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    }
  });

  return {
    applied: pending.length,
    total: allFiles.length,
    files: pending,
  };
}

/** Result of running migrations */
export interface MigrateResult {
  applied: number;
  total: number;
  files: string[];
}

/**
 * Minimal DB interface matching Bun.sql tagged template + begin/unsafe.
 * Used for type safety and testability.
 */
export interface TransactionLike {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  unsafe(sql: string): Promise<unknown[]>;
}

export interface DatabaseLike {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  begin(fn: (tx: TransactionLike) => Promise<void>): Promise<void>;
}
