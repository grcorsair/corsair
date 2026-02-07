/**
 * Database Connection Tests
 *
 * Tests connection module against LIVE Railway Postgres.
 * Verifies: exports, singleton behavior, error handling, real queries.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { SQL } from "bun";
import { createDb, getDb, closeDb } from "../../src/db/connection";

describe("Database Connection", () => {
  let originalDatabaseUrl: string | undefined;

  beforeEach(() => {
    originalDatabaseUrl = process.env.DATABASE_URL;
  });

  afterEach(() => {
    // Restore env and close singleton
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    closeDb();
  });

  test("module exports getDb, createDb, and closeDb functions", () => {
    expect(typeof getDb).toBe("function");
    expect(typeof createDb).toBe("function");
    expect(typeof closeDb).toBe("function");
  });

  test("getDb throws when DATABASE_URL is not set", () => {
    delete process.env.DATABASE_URL;
    closeDb();
    expect(() => getDb()).toThrow("DATABASE_URL");
  });

  test("createDb connects to live Postgres and runs SELECT 1", async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const rows = await db`SELECT 1 AS result`;
    expect(rows[0].result).toBe(1);
    db.close();
  });

  test("createDb can query Postgres version", async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const rows = await db`SELECT version()`;
    expect(rows[0].version).toContain("PostgreSQL");
    db.close();
  });

  test("getDb returns same instance on repeated calls (singleton)", () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  test("closeDb resets the singleton so getDb returns new instance", () => {
    const db1 = getDb();
    closeDb();
    const db2 = getDb();
    expect(db1).not.toBe(db2);
    closeDb();
  });

  test("getDb singleton can execute queries against live Postgres", async () => {
    const db = getDb();
    const rows = await db`SELECT current_database() AS db_name`;
    expect(rows[0].db_name).toBeDefined();
    expect(typeof rows[0].db_name).toBe("string");
  });
});
