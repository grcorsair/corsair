/**
 * Migration Runner Tests
 *
 * Tests migration file discovery, SQL parsing, and idempotent behavior
 * against LIVE Railway Postgres.
 */
import { describe, test, expect, afterAll } from "bun:test";
import { SQL } from "bun";
import * as path from "path";
import { migrate, getMigrationFiles, readMigrationSQL } from "../../src/db/migrate";

const MIGRATIONS_DIR = path.join(
  "/Users/ayoubfandi/projects/corsair",
  "src",
  "db",
  "migrations",
);

describe("Migration Runner", () => {
  describe("file discovery", () => {
    test("getMigrationFiles returns sorted SQL files from migrations directory", () => {
      const files = getMigrationFiles(MIGRATIONS_DIR);

      expect(files.length).toBeGreaterThanOrEqual(4);

      // Files should be sorted by name
      for (let i = 1; i < files.length; i++) {
        expect(files[i] > files[i - 1]).toBe(true);
      }

      // All files should end in .sql
      for (const file of files) {
        expect(file.endsWith(".sql")).toBe(true);
      }

      // Expected files present
      expect(files[0]).toBe("001_foundation.sql");
      expect(files).toContain("002_ssf_streams.sql");
      expect(files).toContain("003_scitt_entries.sql");
      expect(files).toContain("004_signing_keys.sql");
    });

    test("getMigrationFiles returns empty array for nonexistent directory", () => {
      const files = getMigrationFiles("/nonexistent/path");
      expect(files).toEqual([]);
    });

    test("migration files contain valid SQL", () => {
      const files = getMigrationFiles(MIGRATIONS_DIR);

      for (const file of files) {
        const sql = readMigrationSQL(MIGRATIONS_DIR, file);
        expect(typeof sql).toBe("string");
        expect(sql.length).toBeGreaterThan(0);
        expect(
          sql.toUpperCase().includes("CREATE") ||
            sql.toUpperCase().includes("INSERT") ||
            sql.toUpperCase().includes("ALTER"),
        ).toBe(true);
      }
    });
  });

  describe("live Postgres migration", () => {
    let db: InstanceType<typeof SQL>;

    afterAll(async () => {
      if (db) db.close();
    });

    test("migrate is idempotent against live Postgres (all already applied)", async () => {
      db = new SQL({ url: process.env.DATABASE_URL });

      // All 4 migrations are already applied on Railway
      const result = await migrate(db as never, MIGRATIONS_DIR);

      // Should report 0 newly applied
      expect(result.applied).toBe(0);
      expect(result.total).toBeGreaterThanOrEqual(4);
      expect(result.files).toEqual([]);
    });

    test("_migrations table has all 4 migrations recorded", async () => {
      db = new SQL({ url: process.env.DATABASE_URL });

      const rows = await db`SELECT name FROM _migrations ORDER BY name`;
      const names = (rows as Array<{ name: string }>).map((r) => r.name);

      expect(names).toContain("001_foundation.sql");
      expect(names).toContain("002_ssf_streams.sql");
      expect(names).toContain("003_scitt_entries.sql");
      expect(names).toContain("004_signing_keys.sql");
    });

    test("all expected tables exist in the database", async () => {
      db = new SQL({ url: process.env.DATABASE_URL });

      const rows = await db`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `;
      const tables = (rows as Array<{ tablename: string }>).map(
        (r) => r.tablename,
      );

      expect(tables).toContain("_migrations");
      expect(tables).toContain("ssf_streams");
      expect(tables).toContain("ssf_event_queue");
      expect(tables).toContain("ssf_acknowledgments");
      expect(tables).toContain("scitt_entries");
      expect(tables).toContain("scitt_receipts");
      expect(tables).toContain("signing_keys");
    });

    test("signing_keys table has unique active constraint", async () => {
      db = new SQL({ url: process.env.DATABASE_URL });

      const rows = await db`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'signing_keys' AND indexname = 'idx_one_active_key'
      `;
      expect((rows as unknown[]).length).toBe(1);
    });

    test("ssf_event_queue has pending index", async () => {
      db = new SQL({ url: process.env.DATABASE_URL });

      const rows = await db`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'ssf_event_queue' AND indexname = 'idx_event_queue_pending'
      `;
      expect((rows as unknown[]).length).toBe(1);
    });
  });
});
