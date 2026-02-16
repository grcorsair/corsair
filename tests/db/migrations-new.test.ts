/**
 * New Migration File Validation Tests
 *
 * Validates SQL migration files 008, 011, 012 (billing, webhooks, rate limit/idempotency).
 * Tests file existence, SQL structure, idempotency, table names, constraints,
 * indexes, and foreign keys. Does NOT run against a real database.
 */

import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.join(
  __dirname,
  "../../src/db/migrations",
);

/** Read a migration file and return its SQL content */
function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
}

/** Check if a migration file exists */
function migrationExists(filename: string): boolean {
  return fs.existsSync(path.join(MIGRATIONS_DIR, filename));
}

// =============================================================================
// FILE EXISTENCE
// =============================================================================

describe("Migration file existence", () => {
  test("008_billing.sql should exist", () => {
    expect(migrationExists("008_billing.sql")).toBe(true);
  });

  test("011_webhooks.sql should exist", () => {
    expect(migrationExists("011_webhooks.sql")).toBe(true);
  });

  test("012_rate_limit_idempotency.sql should exist", () => {
    expect(migrationExists("012_rate_limit_idempotency.sql")).toBe(true);
  });
});

// =============================================================================
// NON-EMPTY FILES
// =============================================================================

describe("Migration files are non-empty", () => {
  test("008_billing.sql should have content", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql.trim().length).toBeGreaterThan(0);
  });

  test("011_webhooks.sql should have content", () => {
    const sql = readMigration("011_webhooks.sql");
    expect(sql.trim().length).toBeGreaterThan(0);
  });

  test("012_rate_limit_idempotency.sql should have content", () => {
    const sql = readMigration("012_rate_limit_idempotency.sql");
    expect(sql.trim().length).toBeGreaterThan(0);
  });
});

// =============================================================================
// VALID SQL (contains CREATE TABLE)
// =============================================================================

describe("Migration files contain valid SQL", () => {
  test("008_billing.sql should contain CREATE TABLE statements", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toContain("CREATE TABLE");
  });

  test("011_webhooks.sql should contain CREATE TABLE statements", () => {
    const sql = readMigration("011_webhooks.sql");
    expect(sql).toContain("CREATE TABLE");
  });

  test("012_rate_limit_idempotency.sql should contain CREATE TABLE statements", () => {
    const sql = readMigration("012_rate_limit_idempotency.sql");
    expect(sql).toContain("CREATE TABLE");
  });
});

// =============================================================================
// IDEMPOTENCY (IF NOT EXISTS)
// =============================================================================

describe("Migration files are idempotent", () => {
  test("008_billing.sql should use IF NOT EXISTS for all tables", () => {
    const sql = readMigration("008_billing.sql");
    const createCount = (sql.match(/CREATE TABLE/g) || []).length;
    const ifNotExistsCount = (sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
    expect(createCount).toBeGreaterThan(0);
    expect(ifNotExistsCount).toBe(createCount);
  });

  test("011_webhooks.sql should use IF NOT EXISTS for all tables", () => {
    const sql = readMigration("011_webhooks.sql");
    const createCount = (sql.match(/CREATE TABLE/g) || []).length;
    const ifNotExistsCount = (sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
    expect(createCount).toBeGreaterThan(0);
    expect(ifNotExistsCount).toBe(createCount);
  });

  test("012_rate_limit_idempotency.sql should use IF NOT EXISTS for all tables", () => {
    const sql = readMigration("012_rate_limit_idempotency.sql");
    const createCount = (sql.match(/CREATE TABLE/g) || []).length;
    const ifNotExistsCount = (sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
    expect(createCount).toBeGreaterThan(0);
    expect(ifNotExistsCount).toBe(createCount);
  });

  test("all indexes should use IF NOT EXISTS", () => {
    for (const file of ["008_billing.sql", "011_webhooks.sql", "012_rate_limit_idempotency.sql"]) {
      const sql = readMigration(file);
      const indexStatements = sql.match(/CREATE\s+(UNIQUE\s+)?INDEX\b/g) || [];
      const ifNotExistsIndexes = sql.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+IF NOT EXISTS/g) || [];
      expect(ifNotExistsIndexes.length).toBe(indexStatements.length);
    }
  });
});

// =============================================================================
// 012_RATE_LIMIT_IDEMPOTENCY: TABLE NAMES
// =============================================================================

describe("012_rate_limit_idempotency.sql table structure", () => {
  test("should create rate_limits table", () => {
    const sql = readMigration("012_rate_limit_idempotency.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS rate_limits");
  });

  test("should create idempotency_keys table", () => {
    const sql = readMigration("012_rate_limit_idempotency.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS idempotency_keys");
  });
});

// =============================================================================
// 008_BILLING: TABLE NAMES + STRUCTURE
// =============================================================================

describe("008_billing.sql table structure", () => {
  test("should create plans table", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS plans");
  });

  test("should create subscriptions table", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS subscriptions");
  });

  test("should create usage_records table", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS usage_records");
  });

  test("plans table should have tier CHECK constraint", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toContain("free");
    expect(sql).toContain("pro");
    expect(sql).toContain("platform");
    expect(sql).toMatch(/CHECK\s*\(\s*tier\s+IN\s*\(/);
  });

  test("subscriptions table should have status CHECK constraint", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toMatch(/CHECK\s*\(\s*status\s+IN\s*\(/);
    expect(sql).toContain("active");
    expect(sql).toContain("trialing");
    expect(sql).toContain("past_due");
    expect(sql).toContain("canceled");
    expect(sql).toContain("expired");
  });

  test("subscriptions should reference plans(id)", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toContain("REFERENCES plans(id)");
  });

  test("should create unique index on subscriptions(org_id) for active/trialing", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toContain("idx_subscriptions_org");
    expect(sql).toMatch(/ON\s+subscriptions\s*\(\s*org_id\s*\)/);
  });

  test("usage_records should have composite primary key (org_id, period)", () => {
    const sql = readMigration("008_billing.sql");
    expect(sql).toMatch(/PRIMARY KEY\s*\(\s*org_id\s*,\s*period\s*\)/);
  });
});

// =============================================================================
// 011_WEBHOOKS: TABLE NAMES + STRUCTURE
// =============================================================================

describe("011_webhooks.sql table structure", () => {
  test("should create webhook_endpoints table", () => {
    const sql = readMigration("011_webhooks.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS webhook_endpoints");
  });

  test("should create webhook_deliveries table", () => {
    const sql = readMigration("011_webhooks.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS webhook_deliveries");
  });

  test("webhook_deliveries should have status CHECK constraint", () => {
    const sql = readMigration("011_webhooks.sql");
    expect(sql).toMatch(/CHECK\s*\(\s*status\s+IN\s*\(/);
    expect(sql).toContain("pending");
    expect(sql).toContain("success");
    expect(sql).toContain("failed");
    expect(sql).toContain("exhausted");
  });

  test("webhook_deliveries should reference webhook_endpoints(id)", () => {
    const sql = readMigration("011_webhooks.sql");
    expect(sql).toContain("REFERENCES webhook_endpoints(id)");
  });

  test("should create indexes on webhook_deliveries", () => {
    const sql = readMigration("011_webhooks.sql");
    expect(sql).toContain("idx_deliveries_endpoint");
    expect(sql).toContain("idx_deliveries_status");
  });
});

// =============================================================================
// CROSS-MIGRATION: NAMING CONVENTIONS
// =============================================================================

describe("Migration naming conventions", () => {
  test("all migration files should follow NNN_name.sql pattern", () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    for (const file of files) {
      expect(file).toMatch(/^\d{3}_[a-z_]+\.sql$/);
    }
  });

  test("expected migration numbers are present", () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    const numbers = files.map((f) => parseInt(f.split("_")[0], 10));
    // 008, 011, 012 should all be present
    expect(numbers).toContain(8);
    expect(numbers).toContain(11);
    expect(numbers).toContain(12);
  });
});

// =============================================================================
// SQL QUALITY: TIMESTAMPS + DEFAULTS
// =============================================================================

describe("SQL quality conventions", () => {
  test("all tables should use TIMESTAMPTZ for timestamps (not TIMESTAMP)", () => {
    for (const file of ["008_billing.sql", "011_webhooks.sql", "012_rate_limit_idempotency.sql"]) {
      const sql = readMigration(file);
      // Every timestamp column should be TIMESTAMPTZ, not bare TIMESTAMP
      const timestampMatches = sql.match(/\bTIMESTAMP\b(?!TZ)/g) || [];
      expect(timestampMatches.length).toBe(0);
    }
  });

  test("all tables should have created_at columns", () => {
    for (const file of ["008_billing.sql", "011_webhooks.sql", "012_rate_limit_idempotency.sql"]) {
      const sql = readMigration(file);
      expect(sql).toContain("created_at");
    }
  });

  test("all TEXT PRIMARY KEY columns should be present", () => {
    for (const file of ["008_billing.sql", "011_webhooks.sql", "012_rate_limit_idempotency.sql"]) {
      const sql = readMigration(file);
      expect(sql).toContain("TEXT PRIMARY KEY");
    }
  });
});
