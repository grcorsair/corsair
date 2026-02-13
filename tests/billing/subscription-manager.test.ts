/**
 * Subscription Manager Tests — TDD
 *
 * Tests for in-memory subscription manager: CRUD, usage tracking,
 * feature gating, plan upgrades/downgrades, and period management.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { SubscriptionManager } from "../../src/billing/subscription-manager";
import { PLANS } from "../../src/billing/plans";
import type {
  Subscription,
  UsageRecord,
  UsageCheckResult,
} from "../../src/billing/types";

let manager: SubscriptionManager;

beforeEach(() => {
  manager = new SubscriptionManager();
});

// =============================================================================
// CREATE SUBSCRIPTION
// =============================================================================

describe("createSubscription", () => {
  test("should create a subscription with valid plan", () => {
    const sub = manager.createSubscription("org-1", "plan_free");
    expect(sub.orgId).toBe("org-1");
    expect(sub.planId).toBe("plan_free");
    expect(sub.status).toBe("active");
  });

  test("should generate a unique subscription ID", () => {
    const sub1 = manager.createSubscription("org-1", "plan_free");
    const sub2 = manager.createSubscription("org-2", "plan_pro");
    expect(sub1.id).toBeDefined();
    expect(sub2.id).toBeDefined();
    expect(sub1.id).not.toBe(sub2.id);
  });

  test("should set period start to now", () => {
    const before = new Date().toISOString();
    const sub = manager.createSubscription("org-1", "plan_free");
    const after = new Date().toISOString();
    expect(sub.currentPeriodStart >= before).toBe(true);
    expect(sub.currentPeriodStart <= after).toBe(true);
  });

  test("should set period end to one month from now for monthly plan", () => {
    const sub = manager.createSubscription("org-1", "plan_free");
    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Monthly period: 28-31 days
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  test("should default cancelAtPeriodEnd to false", () => {
    const sub = manager.createSubscription("org-1", "plan_free");
    expect(sub.cancelAtPeriodEnd).toBe(false);
  });

  test("should throw if plan ID is invalid", () => {
    expect(() => manager.createSubscription("org-1", "plan_nonexistent")).toThrow();
  });

  test("should throw if org already has an active subscription", () => {
    manager.createSubscription("org-1", "plan_free");
    expect(() => manager.createSubscription("org-1", "plan_pro")).toThrow();
  });

  test("should support creating a trial subscription", () => {
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const sub = manager.createSubscription("org-1", "plan_pro", { trialEnd });
    expect(sub.status).toBe("trialing");
    expect(sub.trialEnd).toBe(trialEnd);
  });

  test("should accept optional metadata", () => {
    const sub = manager.createSubscription("org-1", "plan_free", {
      metadata: { source: "website", campaign: "launch" },
    });
    expect(sub.metadata).toEqual({ source: "website", campaign: "launch" });
  });
});

// =============================================================================
// GET SUBSCRIPTION
// =============================================================================

describe("getSubscription", () => {
  test("should return existing subscription", () => {
    manager.createSubscription("org-1", "plan_pro");
    const sub = manager.getSubscription("org-1");
    expect(sub).toBeDefined();
    expect(sub!.orgId).toBe("org-1");
    expect(sub!.planId).toBe("plan_pro");
  });

  test("should return undefined for org with no subscription", () => {
    const sub = manager.getSubscription("org-nonexistent");
    expect(sub).toBeUndefined();
  });
});

// =============================================================================
// CANCEL SUBSCRIPTION
// =============================================================================

describe("cancelSubscription", () => {
  test("should cancel at period end by default", () => {
    manager.createSubscription("org-1", "plan_pro");
    const sub = manager.cancelSubscription("org-1");
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect(sub.status).toBe("active");
  });

  test("should cancel immediately when atPeriodEnd is false", () => {
    manager.createSubscription("org-1", "plan_pro");
    const sub = manager.cancelSubscription("org-1", false);
    expect(sub.status).toBe("canceled");
  });

  test("should throw if no subscription exists", () => {
    expect(() => manager.cancelSubscription("org-nonexistent")).toThrow();
  });

  test("should throw if subscription is already canceled", () => {
    manager.createSubscription("org-1", "plan_pro");
    manager.cancelSubscription("org-1", false);
    expect(() => manager.cancelSubscription("org-1")).toThrow();
  });
});

// =============================================================================
// UPGRADE SUBSCRIPTION
// =============================================================================

describe("upgradeSubscription", () => {
  test("should switch plan immediately on upgrade", () => {
    manager.createSubscription("org-1", "plan_free");
    const sub = manager.upgradeSubscription("org-1", "plan_pro");
    expect(sub.planId).toBe("plan_pro");
    expect(sub.status).toBe("active");
  });

  test("should reset period dates on upgrade", () => {
    manager.createSubscription("org-1", "plan_free");
    const before = new Date().toISOString();
    const sub = manager.upgradeSubscription("org-1", "plan_pro");
    expect(sub.currentPeriodStart >= before).toBe(true);
  });

  test("should throw if no subscription exists", () => {
    expect(() => manager.upgradeSubscription("org-nonexistent", "plan_pro")).toThrow();
  });

  test("should throw if new plan is not higher tier", () => {
    manager.createSubscription("org-1", "plan_pro");
    expect(() => manager.upgradeSubscription("org-1", "plan_free")).toThrow();
  });

  test("should throw if plan ID is invalid", () => {
    manager.createSubscription("org-1", "plan_free");
    expect(() => manager.upgradeSubscription("org-1", "plan_invalid")).toThrow();
  });

  test("should clear cancelAtPeriodEnd on upgrade", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.cancelSubscription("org-1"); // cancel at period end
    const sub = manager.upgradeSubscription("org-1", "plan_pro");
    expect(sub.cancelAtPeriodEnd).toBe(false);
  });
});

// =============================================================================
// DOWNGRADE SUBSCRIPTION
// =============================================================================

describe("downgradeSubscription", () => {
  test("should schedule downgrade at period end", () => {
    manager.createSubscription("org-1", "plan_pro");
    const sub = manager.downgradeSubscription("org-1", "plan_free");
    // Downgrade doesn't take effect immediately — plan stays until period end
    expect(sub.planId).toBe("plan_pro");
    expect(sub.metadata?.pendingDowngrade).toBe("plan_free");
  });

  test("should throw if no subscription exists", () => {
    expect(() => manager.downgradeSubscription("org-nonexistent", "plan_free")).toThrow();
  });

  test("should throw if new plan is not lower tier", () => {
    manager.createSubscription("org-1", "plan_free");
    expect(() => manager.downgradeSubscription("org-1", "plan_pro")).toThrow();
  });

  test("should throw if plan ID is invalid", () => {
    manager.createSubscription("org-1", "plan_pro");
    expect(() => manager.downgradeSubscription("org-1", "plan_invalid")).toThrow();
  });
});

// =============================================================================
// USAGE TRACKING
// =============================================================================

describe("recordUsage", () => {
  test("should record CPOE usage", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued");
    const usage = manager.getUsage("org-1");
    expect(usage.cpoesIssued).toBe(1);
  });

  test("should increment by specified amount", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued", 5);
    const usage = manager.getUsage("org-1");
    expect(usage.cpoesIssued).toBe(5);
  });

  test("should accumulate multiple recordings", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued", 3);
    manager.recordUsage("org-1", "cpoesIssued", 7);
    const usage = manager.getUsage("org-1");
    expect(usage.cpoesIssued).toBe(10);
  });

  test("should record API call usage", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "apiCalls", 10);
    const usage = manager.getUsage("org-1");
    expect(usage.apiCalls).toBe(10);
  });

  test("should record webhook usage", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "webhooksDelivered", 2);
    const usage = manager.getUsage("org-1");
    expect(usage.webhooksDelivered).toBe(2);
  });

  test("should record SCITT entry usage", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "scittEntries", 1);
    const usage = manager.getUsage("org-1");
    expect(usage.scittEntries).toBe(1);
  });

  test("should update lastUpdated timestamp", () => {
    manager.createSubscription("org-1", "plan_free");
    const before = new Date().toISOString();
    manager.recordUsage("org-1", "cpoesIssued");
    const usage = manager.getUsage("org-1");
    expect(usage.lastUpdated >= before).toBe(true);
  });

  test("should default amount to 1", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued");
    const usage = manager.getUsage("org-1");
    expect(usage.cpoesIssued).toBe(1);
  });
});

// =============================================================================
// USAGE CHECK
// =============================================================================

describe("checkUsage", () => {
  test("should allow usage within limits", () => {
    manager.createSubscription("org-1", "plan_free");
    const result = manager.checkUsage("org-1", "cpoesIssued");
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
    expect(result.limit).toBe(50);
    expect(result.remaining).toBe(50);
  });

  test("should deny usage when limit exceeded", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued", 50);
    const result = manager.checkUsage("org-1", "cpoesIssued");
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(50);
    expect(result.remaining).toBe(0);
  });

  test("should always allow unlimited resources (-1 limit)", () => {
    manager.createSubscription("org-1", "plan_platform");
    manager.recordUsage("org-1", "cpoesIssued", 999999);
    const result = manager.checkUsage("org-1", "cpoesIssued");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });

  test("should return correct remaining count", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued", 30);
    const result = manager.checkUsage("org-1", "cpoesIssued");
    expect(result.remaining).toBe(20);
  });

  test("should use free plan limits for org with no subscription", () => {
    const result = manager.checkUsage("org-no-sub", "cpoesIssued");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(50);
  });

  test("should include resource name in result", () => {
    manager.createSubscription("org-1", "plan_free");
    const result = manager.checkUsage("org-1", "cpoesIssued");
    expect(result.resource).toBe("cpoesIssued");
  });
});

// =============================================================================
// GET USAGE
// =============================================================================

describe("getUsage", () => {
  test("should return zero usage for new subscription", () => {
    manager.createSubscription("org-1", "plan_free");
    const usage = manager.getUsage("org-1");
    expect(usage.cpoesIssued).toBe(0);
    expect(usage.apiCalls).toBe(0);
    expect(usage.webhooksDelivered).toBe(0);
    expect(usage.scittEntries).toBe(0);
  });

  test("should return correct period format", () => {
    manager.createSubscription("org-1", "plan_free");
    const usage = manager.getUsage("org-1");
    // Period should be YYYY-MM format
    expect(usage.period).toMatch(/^\d{4}-\d{2}$/);
  });

  test("should return orgId in usage record", () => {
    manager.createSubscription("org-1", "plan_free");
    const usage = manager.getUsage("org-1");
    expect(usage.orgId).toBe("org-1");
  });

  test("should return zero usage for org with no subscription", () => {
    const usage = manager.getUsage("org-no-sub");
    expect(usage.cpoesIssued).toBe(0);
    expect(usage.apiCalls).toBe(0);
  });
});

// =============================================================================
// RESET USAGE
// =============================================================================

describe("resetUsage", () => {
  test("should reset all usage counters to zero", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued", 30);
    manager.recordUsage("org-1", "apiCalls", 50);
    manager.resetUsage("org-1");
    const usage = manager.getUsage("org-1");
    expect(usage.cpoesIssued).toBe(0);
    expect(usage.apiCalls).toBe(0);
    expect(usage.webhooksDelivered).toBe(0);
    expect(usage.scittEntries).toBe(0);
  });

  test("should update the period on reset", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued", 10);
    const usageBefore = manager.getUsage("org-1");
    manager.resetUsage("org-1");
    const usageAfter = manager.getUsage("org-1");
    expect(usageAfter.lastUpdated).toBeDefined();
  });
});

// =============================================================================
// FEATURE CHECK
// =============================================================================

describe("isFeatureEnabled", () => {
  test("free plan should NOT have enrichment", () => {
    manager.createSubscription("org-1", "plan_free");
    expect(manager.isFeatureEnabled("org-1", "enrichment")).toBe(false);
  });

  test("free plan should NOT have sdJwt", () => {
    manager.createSubscription("org-1", "plan_free");
    expect(manager.isFeatureEnabled("org-1", "sdJwt")).toBe(false);
  });

  test("free plan should NOT have auditEngine", () => {
    manager.createSubscription("org-1", "plan_free");
    expect(manager.isFeatureEnabled("org-1", "auditEngine")).toBe(false);
  });

  test("free plan should NOT have customDID", () => {
    manager.createSubscription("org-1", "plan_free");
    expect(manager.isFeatureEnabled("org-1", "customDID")).toBe(false);
  });

  test("pro plan should have enrichment", () => {
    manager.createSubscription("org-1", "plan_pro");
    expect(manager.isFeatureEnabled("org-1", "enrichment")).toBe(true);
  });

  test("pro plan should have sdJwt", () => {
    manager.createSubscription("org-1", "plan_pro");
    expect(manager.isFeatureEnabled("org-1", "sdJwt")).toBe(true);
  });

  test("pro plan should have auditEngine", () => {
    manager.createSubscription("org-1", "plan_pro");
    expect(manager.isFeatureEnabled("org-1", "auditEngine")).toBe(true);
  });

  test("platform plan should have all features enabled", () => {
    manager.createSubscription("org-1", "plan_platform");
    expect(manager.isFeatureEnabled("org-1", "enrichment")).toBe(true);
    expect(manager.isFeatureEnabled("org-1", "sdJwt")).toBe(true);
    expect(manager.isFeatureEnabled("org-1", "auditEngine")).toBe(true);
    expect(manager.isFeatureEnabled("org-1", "customDID")).toBe(true);
  });

  test("should default to free plan features for org with no subscription", () => {
    expect(manager.isFeatureEnabled("org-no-sub", "enrichment")).toBe(false);
  });

  test("should return false for unknown feature name", () => {
    manager.createSubscription("org-1", "plan_platform");
    expect(manager.isFeatureEnabled("org-1", "nonexistentFeature")).toBe(false);
  });
});

// =============================================================================
// SUBSCRIPTION STATUS TRANSITIONS
// =============================================================================

describe("Subscription Status Transitions", () => {
  test("new subscription should be active", () => {
    const sub = manager.createSubscription("org-1", "plan_free");
    expect(sub.status).toBe("active");
  });

  test("trial subscription should be trialing", () => {
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const sub = manager.createSubscription("org-1", "plan_pro", { trialEnd });
    expect(sub.status).toBe("trialing");
  });

  test("immediately canceled subscription should be canceled", () => {
    manager.createSubscription("org-1", "plan_pro");
    const sub = manager.cancelSubscription("org-1", false);
    expect(sub.status).toBe("canceled");
  });

  test("period-end canceled subscription should stay active", () => {
    manager.createSubscription("org-1", "plan_pro");
    const sub = manager.cancelSubscription("org-1", true);
    expect(sub.status).toBe("active");
    expect(sub.cancelAtPeriodEnd).toBe(true);
  });
});

// =============================================================================
// MULTI-ORG ISOLATION
// =============================================================================

describe("Multi-Org Isolation", () => {
  test("different orgs should have independent subscriptions", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.createSubscription("org-2", "plan_pro");
    const sub1 = manager.getSubscription("org-1");
    const sub2 = manager.getSubscription("org-2");
    expect(sub1!.planId).toBe("plan_free");
    expect(sub2!.planId).toBe("plan_pro");
  });

  test("different orgs should have independent usage", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.createSubscription("org-2", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued", 10);
    manager.recordUsage("org-2", "cpoesIssued", 20);
    expect(manager.getUsage("org-1").cpoesIssued).toBe(10);
    expect(manager.getUsage("org-2").cpoesIssued).toBe(20);
  });

  test("canceling one org should not affect another", () => {
    manager.createSubscription("org-1", "plan_pro");
    manager.createSubscription("org-2", "plan_pro");
    manager.cancelSubscription("org-1", false);
    expect(manager.getSubscription("org-1")!.status).toBe("canceled");
    expect(manager.getSubscription("org-2")!.status).toBe("active");
  });

  test("resetting usage for one org should not affect another", () => {
    manager.createSubscription("org-1", "plan_free");
    manager.createSubscription("org-2", "plan_free");
    manager.recordUsage("org-1", "cpoesIssued", 10);
    manager.recordUsage("org-2", "cpoesIssued", 20);
    manager.resetUsage("org-1");
    expect(manager.getUsage("org-1").cpoesIssued).toBe(0);
    expect(manager.getUsage("org-2").cpoesIssued).toBe(20);
  });
});
