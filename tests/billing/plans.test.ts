/**
 * Billing Plans Tests — TDD
 *
 * Tests for the plan catalog: free, pro, platform tiers.
 * Validates pricing, limits, features, and structural correctness.
 */

import { describe, test, expect } from "bun:test";
import { PLANS } from "../../src/billing/plans";
import type { Plan, PlanTier, PlanLimits } from "../../src/billing/types";

// =============================================================================
// PLAN CATALOG STRUCTURE
// =============================================================================

describe("Plan Catalog", () => {
  test("should define all three plan tiers", () => {
    expect(PLANS.free).toBeDefined();
    expect(PLANS.pro).toBeDefined();
    expect(PLANS.platform).toBeDefined();
  });

  test("should have exactly three plans", () => {
    const keys = Object.keys(PLANS);
    expect(keys).toHaveLength(3);
    expect(keys.sort()).toEqual(["free", "platform", "pro"]);
  });

  test("every plan should have all required fields", () => {
    const requiredFields: (keyof Plan)[] = [
      "id", "tier", "name", "description", "price", "interval", "limits", "features",
    ];

    for (const tier of Object.keys(PLANS) as PlanTier[]) {
      const plan = PLANS[tier];
      for (const field of requiredFields) {
        expect(plan[field]).toBeDefined();
      }
    }
  });

  test("every plan should have all required limit fields", () => {
    const requiredLimitFields: (keyof PlanLimits)[] = [
      "cpoesPerMonth", "apiCallsPerDay", "webhookEndpoints",
      "scittRetentionDays", "flagshipStreams", "enrichment",
      "sdJwt", "auditEngine", "customDID",
    ];

    for (const tier of Object.keys(PLANS) as PlanTier[]) {
      const limits = PLANS[tier].limits;
      for (const field of requiredLimitFields) {
        expect(limits[field]).toBeDefined();
      }
    }
  });

  test("every plan should have a non-empty features list", () => {
    for (const tier of Object.keys(PLANS) as PlanTier[]) {
      expect(PLANS[tier].features.length).toBeGreaterThan(0);
    }
  });

  test("plan IDs should be unique", () => {
    const ids = Object.values(PLANS).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("plan tier field should match the catalog key", () => {
    for (const tier of Object.keys(PLANS) as PlanTier[]) {
      expect(PLANS[tier].tier).toBe(tier);
    }
  });
});

// =============================================================================
// FREE PLAN
// =============================================================================

describe("Free Plan", () => {
  test("should have zero price", () => {
    expect(PLANS.free.price).toBe(0);
  });

  test("should limit to 50 CPOEs per month", () => {
    expect(PLANS.free.limits.cpoesPerMonth).toBe(50);
  });

  test("should NOT include enrichment", () => {
    expect(PLANS.free.limits.enrichment).toBe(false);
  });

  test("should NOT include SD-JWT", () => {
    expect(PLANS.free.limits.sdJwt).toBe(false);
  });

  test("should NOT include audit engine", () => {
    expect(PLANS.free.limits.auditEngine).toBe(false);
  });

  test("should NOT include custom DID", () => {
    expect(PLANS.free.limits.customDID).toBe(false);
  });

  test("should have monthly billing interval", () => {
    expect(PLANS.free.interval).toBe("monthly");
  });
});

// =============================================================================
// PRO PLAN
// =============================================================================

describe("Pro Plan", () => {
  test("should cost $199/month (19900 cents)", () => {
    expect(PLANS.pro.price).toBe(19900);
  });

  test("should allow more CPOEs than free", () => {
    expect(PLANS.pro.limits.cpoesPerMonth).toBeGreaterThan(
      PLANS.free.limits.cpoesPerMonth,
    );
  });

  test("should include enrichment (CHART + QUARTER)", () => {
    expect(PLANS.pro.limits.enrichment).toBe(true);
  });

  test("should include SD-JWT selective disclosure", () => {
    expect(PLANS.pro.limits.sdJwt).toBe(true);
  });

  test("should include audit engine", () => {
    expect(PLANS.pro.limits.auditEngine).toBe(true);
  });

  test("should have monthly billing interval", () => {
    expect(PLANS.pro.interval).toBe("monthly");
  });

  test("should have more API calls per day than free", () => {
    expect(PLANS.pro.limits.apiCallsPerDay).toBeGreaterThan(
      PLANS.free.limits.apiCallsPerDay,
    );
  });
});

// =============================================================================
// PLATFORM PLAN
// =============================================================================

describe("Platform Plan", () => {
  test("should cost $2000/month (200000 cents)", () => {
    expect(PLANS.platform.price).toBe(200000);
  });

  test("should have unlimited CPOEs (-1)", () => {
    expect(PLANS.platform.limits.cpoesPerMonth).toBe(-1);
  });

  test("should have unlimited API calls (-1)", () => {
    expect(PLANS.platform.limits.apiCallsPerDay).toBe(-1);
  });

  test("should include all features", () => {
    expect(PLANS.platform.limits.enrichment).toBe(true);
    expect(PLANS.platform.limits.sdJwt).toBe(true);
    expect(PLANS.platform.limits.auditEngine).toBe(true);
    expect(PLANS.platform.limits.customDID).toBe(true);
  });

  test("should have monthly billing interval", () => {
    expect(PLANS.platform.interval).toBe("monthly");
  });

  test("should have more FLAGSHIP streams than pro (or unlimited)", () => {
    const platformStreams = PLANS.platform.limits.flagshipStreams;
    const proStreams = PLANS.pro.limits.flagshipStreams;
    // -1 means unlimited, which exceeds any finite limit
    expect(platformStreams === -1 || platformStreams > proStreams).toBe(true);
  });

  test("should have longer SCITT retention than pro (or unlimited)", () => {
    const platformRetention = PLANS.platform.limits.scittRetentionDays;
    const proRetention = PLANS.pro.limits.scittRetentionDays;
    // -1 means unlimited, which exceeds any finite limit
    expect(platformRetention === -1 || platformRetention > proRetention).toBe(true);
  });
});
