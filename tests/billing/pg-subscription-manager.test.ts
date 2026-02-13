/**
 * PgSubscriptionManager Tests — Postgres-backed Subscription Management
 *
 * Tests for Postgres-backed subscription manager. Uses a mock sql connection
 * to verify query construction, row mapping, and interface compatibility
 * without requiring a real Postgres instance.
 *
 * TDD: Tests written FIRST, then implementation makes them green.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { PgSubscriptionManager } from "../../src/billing/pg-subscription-manager";
import { PLANS } from "../../src/billing/plans";
import type { Subscription, UsageRecord, UsageCheckResult } from "../../src/billing/types";

// =============================================================================
// MOCK SQL HELPER
// =============================================================================

interface MockSqlCall {
  strings: readonly string[];
  values: unknown[];
}

function createMockSql(defaultRows: unknown[] = []) {
  const calls: MockSqlCall[] = [];
  let nextResult: unknown[] = defaultRows;

  const mockSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings: [...strings], values });
    const result = nextResult;
    nextResult = defaultRows; // Reset after each call
    return Promise.resolve(result);
  };

  return {
    sql: mockSql as unknown as ReturnType<typeof import("../../src/db/connection").getDb>,
    calls,
    setNextResult: (rows: unknown[]) => {
      nextResult = rows;
    },
  };
}

// =============================================================================
// INSTANTIATION
// =============================================================================

describe("PgSubscriptionManager", () => {
  describe("constructor", () => {
    test("should instantiate with a mock sql connection", () => {
      const { sql } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      expect(manager).toBeDefined();
    });

    test("should be a class with expected method names", () => {
      const { sql } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      expect(typeof manager.createSubscription).toBe("function");
      expect(typeof manager.getSubscription).toBe("function");
      expect(typeof manager.cancelSubscription).toBe("function");
      expect(typeof manager.upgradeSubscription).toBe("function");
      expect(typeof manager.downgradeSubscription).toBe("function");
      expect(typeof manager.checkUsage).toBe("function");
      expect(typeof manager.recordUsage).toBe("function");
      expect(typeof manager.getUsage).toBe("function");
      expect(typeof manager.resetUsage).toBe("function");
      expect(typeof manager.isFeatureEnabled).toBe("function");
    });
  });

  // ===========================================================================
  // CREATE SUBSCRIPTION
  // ===========================================================================

  describe("createSubscription", () => {
    test("should insert a subscription row via SQL", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      const sub = await manager.createSubscription("org-1", "plan_free");

      expect(sub.orgId).toBe("org-1");
      expect(sub.planId).toBe("plan_free");
      expect(sub.status).toBe("active");
      // Should have made at least one SQL call
      expect(calls.length).toBeGreaterThan(0);
    });

    test("should generate a unique subscription ID", async () => {
      const { sql } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      const sub = await manager.createSubscription("org-1", "plan_free");
      expect(sub.id).toBeDefined();
      expect(sub.id.length).toBeGreaterThan(0);
    });

    test("should set period start and end dates", async () => {
      const { sql } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      const before = new Date().toISOString();
      const sub = await manager.createSubscription("org-1", "plan_pro");
      expect(sub.currentPeriodStart).toBeDefined();
      expect(sub.currentPeriodEnd).toBeDefined();
      expect(sub.currentPeriodStart >= before).toBe(true);
    });

    test("should default cancelAtPeriodEnd to false", async () => {
      const { sql } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      const sub = await manager.createSubscription("org-1", "plan_free");
      expect(sub.cancelAtPeriodEnd).toBe(false);
    });

    test("should throw if plan ID is invalid", async () => {
      const { sql } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      expect(manager.createSubscription("org-1", "plan_nonexistent")).rejects.toThrow();
    });

    test("should create trial subscription when trialEnd provided", async () => {
      const { sql } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const sub = await manager.createSubscription("org-1", "plan_pro", { trialEnd });
      expect(sub.status).toBe("trialing");
      expect(sub.trialEnd).toBe(trialEnd);
    });

    test("should accept optional metadata", async () => {
      const { sql } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      const sub = await manager.createSubscription("org-1", "plan_free", {
        metadata: { source: "website" },
      });
      expect(sub.metadata).toEqual({ source: "website" });
    });

    test("should use parameterized queries (no string interpolation)", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      await manager.createSubscription("org-1", "plan_free");

      // Verify that SQL template strings don't contain the actual values
      for (const call of calls) {
        const joined = call.strings.join("");
        expect(joined).not.toContain("org-1");
        expect(joined).not.toContain("plan_free");
      }
    });
  });

  // ===========================================================================
  // GET SUBSCRIPTION
  // ===========================================================================

  describe("getSubscription", () => {
    test("should return subscription from database row", async () => {
      const mockRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_pro",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([mockRow]);

      const sub = await manager.getSubscription("org-1");
      expect(sub).toBeDefined();
      expect(sub!.id).toBe("sub-123");
      expect(sub!.orgId).toBe("org-1");
      expect(sub!.planId).toBe("plan_pro");
      expect(sub!.status).toBe("active");
    });

    test("should return undefined when no subscription exists", async () => {
      const { sql } = createMockSql([]);
      const manager = new PgSubscriptionManager(sql);
      const sub = await manager.getSubscription("org-nonexistent");
      expect(sub).toBeUndefined();
    });

    test("should map snake_case DB columns to camelCase", async () => {
      const mockRow = {
        id: "sub-456",
        org_id: "org-2",
        plan_id: "plan_free",
        status: "trialing",
        current_period_start: "2026-01-15T00:00:00.000Z",
        current_period_end: "2026-02-15T00:00:00.000Z",
        cancel_at_period_end: true,
        trial_end: "2026-01-29T00:00:00.000Z",
        metadata: '{"source": "api"}',
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([mockRow]);

      const sub = await manager.getSubscription("org-2");
      expect(sub!.cancelAtPeriodEnd).toBe(true);
      expect(sub!.currentPeriodStart).toBe("2026-01-15T00:00:00.000Z");
      expect(sub!.currentPeriodEnd).toBe("2026-02-15T00:00:00.000Z");
      expect(sub!.trialEnd).toBe("2026-01-29T00:00:00.000Z");
    });
  });

  // ===========================================================================
  // CANCEL SUBSCRIPTION
  // ===========================================================================

  describe("cancelSubscription", () => {
    test("should set cancelAtPeriodEnd for soft cancel", async () => {
      const existingRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_pro",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([existingRow]);

      const sub = await manager.cancelSubscription("org-1");
      expect(sub.cancelAtPeriodEnd).toBe(true);
      expect(sub.status).toBe("active");
    });

    test("should set status to canceled for immediate cancel", async () => {
      const existingRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_pro",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([existingRow]);

      const sub = await manager.cancelSubscription("org-1", false);
      expect(sub.status).toBe("canceled");
    });

    test("should throw if no subscription found", async () => {
      const { sql } = createMockSql([]);
      const manager = new PgSubscriptionManager(sql);
      expect(manager.cancelSubscription("org-nonexistent")).rejects.toThrow();
    });
  });

  // ===========================================================================
  // UPGRADE SUBSCRIPTION
  // ===========================================================================

  describe("upgradeSubscription", () => {
    test("should upgrade plan immediately", async () => {
      const existingRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_free",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([existingRow]);

      const sub = await manager.upgradeSubscription("org-1", "plan_pro");
      expect(sub.planId).toBe("plan_pro");
      expect(sub.status).toBe("active");
    });

    test("should throw if new plan is not higher tier", async () => {
      const existingRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_pro",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([existingRow]);

      expect(manager.upgradeSubscription("org-1", "plan_free")).rejects.toThrow();
    });

    test("should throw if plan ID is invalid", async () => {
      const existingRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_free",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([existingRow]);

      expect(manager.upgradeSubscription("org-1", "plan_invalid")).rejects.toThrow();
    });

    test("should throw if no subscription exists", async () => {
      const { sql } = createMockSql([]);
      const manager = new PgSubscriptionManager(sql);
      expect(manager.upgradeSubscription("org-nonexistent", "plan_pro")).rejects.toThrow();
    });
  });

  // ===========================================================================
  // DOWNGRADE SUBSCRIPTION
  // ===========================================================================

  describe("downgradeSubscription", () => {
    test("should schedule downgrade at period end", async () => {
      const existingRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_pro",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([existingRow]);

      const sub = await manager.downgradeSubscription("org-1", "plan_free");
      expect(sub.planId).toBe("plan_pro"); // Not changed yet
      expect(sub.metadata?.pendingDowngrade).toBe("plan_free");
    });

    test("should throw if new plan is not lower tier", async () => {
      const existingRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_free",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([existingRow]);

      expect(manager.downgradeSubscription("org-1", "plan_pro")).rejects.toThrow();
    });

    test("should throw if no subscription exists", async () => {
      const { sql } = createMockSql([]);
      const manager = new PgSubscriptionManager(sql);
      expect(manager.downgradeSubscription("org-nonexistent", "plan_free")).rejects.toThrow();
    });
  });

  // ===========================================================================
  // USAGE TRACKING
  // ===========================================================================

  describe("recordUsage", () => {
    test("should execute SQL to increment usage", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      await manager.recordUsage("org-1", "cpoesIssued", 1);
      expect(calls.length).toBeGreaterThan(0);
    });

    test("should default amount to 1", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      await manager.recordUsage("org-1", "cpoesIssued");
      // Verify that 1 is passed as the amount value
      const insertCall = calls.find((c) =>
        c.strings.join("").toLowerCase().includes("usage")
      );
      expect(insertCall).toBeDefined();
    });

    test("should use parameterized query for resource name", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      await manager.recordUsage("org-1", "apiCalls", 5);

      for (const call of calls) {
        const joined = call.strings.join("");
        expect(joined).not.toContain("org-1");
      }
    });
  });

  describe("checkUsage", () => {
    test("should return allowed true when within limits", async () => {
      const usageRow = {
        org_id: "org-1",
        period: "2026-02",
        cpoes_issued: 10,
        api_calls: 5,
        webhooks_delivered: 0,
        scitt_entries: 0,
        last_updated: new Date().toISOString(),
      };
      const subRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_free",
        status: "active",
        current_period_start: "2026-02-01T00:00:00.000Z",
        current_period_end: "2026-03-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);

      // First call returns subscription, second returns usage
      let callCount = 0;
      const origSql = sql as unknown as Function;
      const customSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([subRow]);
        return Promise.resolve([usageRow]);
      };

      const manager2 = new PgSubscriptionManager(customSql as typeof sql);
      const result = await manager2.checkUsage("org-1", "cpoesIssued");
      expect(result.allowed).toBe(true);
      expect(result.resource).toBe("cpoesIssued");
    });

    test("should use free plan limits when no subscription exists", async () => {
      let callCount = 0;
      const customSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
        callCount++;
        return Promise.resolve([]); // No subscription, no usage
      };
      const manager = new PgSubscriptionManager(customSql as any);
      const result = await manager.checkUsage("org-no-sub", "cpoesIssued");
      expect(result.limit).toBe(50); // Free plan limit
    });

    test("should handle unlimited resources (-1 limit)", async () => {
      let callCount = 0;
      const subRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_platform",
        status: "active",
        current_period_start: "2026-02-01T00:00:00.000Z",
        current_period_end: "2026-03-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const usageRow = {
        org_id: "org-1",
        period: "2026-02",
        cpoes_issued: 999999,
        api_calls: 0,
        webhooks_delivered: 0,
        scitt_entries: 0,
        last_updated: new Date().toISOString(),
      };
      const customSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([subRow]);
        return Promise.resolve([usageRow]);
      };
      const manager = new PgSubscriptionManager(customSql as any);
      const result = await manager.checkUsage("org-1", "cpoesIssued");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });
  });

  // ===========================================================================
  // GET USAGE
  // ===========================================================================

  describe("getUsage", () => {
    test("should return usage record from database", async () => {
      const usageRow = {
        org_id: "org-1",
        period: "2026-02",
        cpoes_issued: 15,
        api_calls: 42,
        webhooks_delivered: 3,
        scitt_entries: 7,
        last_updated: "2026-02-10T12:00:00.000Z",
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([usageRow]);

      const usage = await manager.getUsage("org-1");
      expect(usage.orgId).toBe("org-1");
      expect(usage.cpoesIssued).toBe(15);
      expect(usage.apiCalls).toBe(42);
      expect(usage.webhooksDelivered).toBe(3);
      expect(usage.scittEntries).toBe(7);
    });

    test("should return zero usage when no record exists", async () => {
      const { sql } = createMockSql([]);
      const manager = new PgSubscriptionManager(sql);
      const usage = await manager.getUsage("org-new");
      expect(usage.cpoesIssued).toBe(0);
      expect(usage.apiCalls).toBe(0);
      expect(usage.webhooksDelivered).toBe(0);
      expect(usage.scittEntries).toBe(0);
    });

    test("should include period in YYYY-MM format", async () => {
      const { sql } = createMockSql([]);
      const manager = new PgSubscriptionManager(sql);
      const usage = await manager.getUsage("org-1");
      expect(usage.period).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  // ===========================================================================
  // RESET USAGE
  // ===========================================================================

  describe("resetUsage", () => {
    test("should execute SQL to reset usage counters", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      await manager.resetUsage("org-1");
      expect(calls.length).toBeGreaterThan(0);
    });

    test("should use parameterized query for org ID", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      await manager.resetUsage("org-1");

      for (const call of calls) {
        const joined = call.strings.join("");
        expect(joined).not.toContain("org-1");
      }
    });
  });

  // ===========================================================================
  // FEATURE GATING
  // ===========================================================================

  describe("isFeatureEnabled", () => {
    test("should return false for free plan features", async () => {
      const subRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_free",
        status: "active",
        current_period_start: "2026-02-01T00:00:00.000Z",
        current_period_end: "2026-03-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([subRow]);

      const result = await manager.isFeatureEnabled("org-1", "enrichment");
      expect(result).toBe(false);
    });

    test("should return true for pro plan enrichment", async () => {
      const subRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_pro",
        status: "active",
        current_period_start: "2026-02-01T00:00:00.000Z",
        current_period_end: "2026-03-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([subRow]);

      const result = await manager.isFeatureEnabled("org-1", "enrichment");
      expect(result).toBe(true);
    });

    test("should default to free plan for unknown org", async () => {
      const { sql } = createMockSql([]);
      const manager = new PgSubscriptionManager(sql);
      const result = await manager.isFeatureEnabled("org-unknown", "enrichment");
      expect(result).toBe(false);
    });

    test("should return false for unknown feature", async () => {
      const subRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_platform",
        status: "active",
        current_period_start: "2026-02-01T00:00:00.000Z",
        current_period_end: "2026-03-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([subRow]);

      const result = await manager.isFeatureEnabled("org-1", "nonexistent");
      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // ROW MAPPING
  // ===========================================================================

  describe("row mapping", () => {
    test("should handle null trial_end", async () => {
      const mockRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_free",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: null,
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([mockRow]);

      const sub = await manager.getSubscription("org-1");
      expect(sub!.trialEnd).toBeUndefined();
    });

    test("should handle JSON string metadata from Postgres", async () => {
      const mockRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_free",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: '{"source": "website", "campaign": "launch"}',
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([mockRow]);

      const sub = await manager.getSubscription("org-1");
      expect(sub!.metadata).toEqual({ source: "website", campaign: "launch" });
    });

    test("should handle object metadata from Postgres (already parsed)", async () => {
      const mockRow = {
        id: "sub-123",
        org_id: "org-1",
        plan_id: "plan_free",
        status: "active",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2026-02-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: { source: "api" },
      };
      const { sql, setNextResult } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      setNextResult([mockRow]);

      const sub = await manager.getSubscription("org-1");
      expect(sub!.metadata).toEqual({ source: "api" });
    });
  });

  // ===========================================================================
  // SQL SAFETY
  // ===========================================================================

  describe("SQL safety", () => {
    test("should never include raw org IDs in SQL template strings", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      await manager.createSubscription("org-drop-tables", "plan_free");

      for (const call of calls) {
        const joined = call.strings.join("");
        expect(joined).not.toContain("org-drop-tables");
      }
    });

    test("should pass org ID as parameterized value", async () => {
      const { sql, calls } = createMockSql();
      const manager = new PgSubscriptionManager(sql);
      await manager.createSubscription("org-1", "plan_free");

      // At least one call should have org-1 in its values
      const hasOrgValue = calls.some((c) =>
        c.values.some((v) => v === "org-1"),
      );
      expect(hasOrgValue).toBe(true);
    });
  });
});
