/**
 * Subscription Manager — In-Memory
 *
 * Manages subscriptions, usage tracking, and feature gating.
 * In-memory implementation — will be replaced with Postgres-backed version later.
 * No external dependencies. Domain logic only.
 */

import { getPlanById } from "./plans";
import { PLANS } from "./plans";
import {
  TIER_ORDER,
  RESOURCE_TO_LIMIT,
  type Subscription,
  type UsageRecord,
  type UsageCheckResult,
  type FeatureFlag,
  type PlanLimits,
} from "./types";

/** Options for creating a subscription */
interface CreateSubscriptionOptions {
  trialEnd?: string;
  metadata?: Record<string, string>;
}

/**
 * In-memory subscription manager.
 *
 * Handles CRUD for subscriptions, usage metering, and feature gating.
 * Defaults to free plan when no subscription exists for an org.
 */
export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private usage: Map<string, UsageRecord> = new Map();

  // ===========================================================================
  // SUBSCRIPTION CRUD
  // ===========================================================================

  /**
   * Create a new subscription for an org.
   * Throws if plan ID is invalid or org already has an active subscription.
   */
  createSubscription(
    orgId: string,
    planId: string,
    options?: CreateSubscriptionOptions,
  ): Subscription {
    const plan = getPlanById(planId);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    const existing = this.subscriptions.get(orgId);
    if (existing && existing.status !== "canceled" && existing.status !== "expired") {
      throw new Error(`Org ${orgId} already has an active subscription`);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const isTrialing = options?.trialEnd !== undefined;

    const subscription: Subscription = {
      id: crypto.randomUUID(),
      orgId,
      planId,
      status: isTrialing ? "trialing" : "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: options?.trialEnd,
      metadata: options?.metadata,
    };

    this.subscriptions.set(orgId, subscription);
    this.initUsage(orgId);
    return subscription;
  }

  /**
   * Get the current subscription for an org.
   * Returns undefined if no subscription exists.
   */
  getSubscription(orgId: string): Subscription | undefined {
    return this.subscriptions.get(orgId);
  }

  /**
   * Cancel a subscription.
   * @param atPeriodEnd - If true (default), cancel at period end. If false, cancel immediately.
   */
  cancelSubscription(orgId: string, atPeriodEnd: boolean = true): Subscription {
    const sub = this.subscriptions.get(orgId);
    if (!sub) {
      throw new Error(`No subscription found for org ${orgId}`);
    }
    if (sub.status === "canceled" || sub.status === "expired") {
      throw new Error(`Subscription for org ${orgId} is already ${sub.status}`);
    }

    if (atPeriodEnd) {
      sub.cancelAtPeriodEnd = true;
      // Status stays active until period ends
    } else {
      sub.status = "canceled";
    }

    return sub;
  }

  /**
   * Upgrade to a higher-tier plan. Takes effect immediately.
   * Resets period dates and clears cancelAtPeriodEnd.
   */
  upgradeSubscription(orgId: string, newPlanId: string): Subscription {
    const sub = this.subscriptions.get(orgId);
    if (!sub) {
      throw new Error(`No subscription found for org ${orgId}`);
    }

    const newPlan = getPlanById(newPlanId);
    if (!newPlan) {
      throw new Error(`Invalid plan ID: ${newPlanId}`);
    }

    const currentPlan = getPlanById(sub.planId);
    if (!currentPlan) {
      throw new Error(`Current plan not found: ${sub.planId}`);
    }

    if (TIER_ORDER[newPlan.tier] <= TIER_ORDER[currentPlan.tier]) {
      throw new Error(
        `Cannot upgrade from ${currentPlan.tier} to ${newPlan.tier}. Use downgradeSubscription() instead.`,
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    sub.planId = newPlanId;
    sub.status = "active";
    sub.currentPeriodStart = now.toISOString();
    sub.currentPeriodEnd = periodEnd.toISOString();
    sub.cancelAtPeriodEnd = false;

    return sub;
  }

  /**
   * Downgrade to a lower-tier plan. Takes effect at period end.
   * Stores the pending downgrade in metadata.
   */
  downgradeSubscription(orgId: string, newPlanId: string): Subscription {
    const sub = this.subscriptions.get(orgId);
    if (!sub) {
      throw new Error(`No subscription found for org ${orgId}`);
    }

    const newPlan = getPlanById(newPlanId);
    if (!newPlan) {
      throw new Error(`Invalid plan ID: ${newPlanId}`);
    }

    const currentPlan = getPlanById(sub.planId);
    if (!currentPlan) {
      throw new Error(`Current plan not found: ${sub.planId}`);
    }

    if (TIER_ORDER[newPlan.tier] >= TIER_ORDER[currentPlan.tier]) {
      throw new Error(
        `Cannot downgrade from ${currentPlan.tier} to ${newPlan.tier}. Use upgradeSubscription() instead.`,
      );
    }

    // Schedule downgrade for period end — don't change plan yet
    if (!sub.metadata) {
      sub.metadata = {};
    }
    sub.metadata.pendingDowngrade = newPlanId;

    return sub;
  }

  // ===========================================================================
  // USAGE TRACKING
  // ===========================================================================

  /**
   * Record usage for a resource.
   * @param amount - Amount to increment (default: 1)
   */
  recordUsage(orgId: string, resource: string, amount: number = 1): void {
    const usage = this.getOrInitUsage(orgId);
    if (resource in usage && resource !== "orgId" && resource !== "period" && resource !== "lastUpdated") {
      (usage as Record<string, unknown>)[resource] =
        ((usage as Record<string, unknown>)[resource] as number) + amount;
    }
    usage.lastUpdated = new Date().toISOString();
  }

  /**
   * Check if usage is within plan limits for a resource.
   * Defaults to free plan if no subscription exists.
   */
  checkUsage(orgId: string, resource: string): UsageCheckResult {
    const limits = this.getLimitsForOrg(orgId);
    const usage = this.getOrInitUsage(orgId);

    const limitKey = RESOURCE_TO_LIMIT[resource];
    const limit = limitKey ? (limits[limitKey] as number) : 0;
    const current = ((usage as Record<string, unknown>)[resource] as number) || 0;

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        resource,
        current,
        limit: -1,
        remaining: -1,
      };
    }

    const remaining = Math.max(0, limit - current);

    return {
      allowed: current < limit,
      resource,
      current,
      limit,
      remaining,
    };
  }

  /** Get current period usage for an org. Returns zero usage if none tracked. */
  getUsage(orgId: string): UsageRecord {
    return this.getOrInitUsage(orgId);
  }

  /** Reset all usage counters to zero for a new period. */
  resetUsage(orgId: string): void {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    this.usage.set(orgId, {
      orgId,
      period,
      cpoesIssued: 0,
      apiCalls: 0,
      webhooksDelivered: 0,
      scittEntries: 0,
      lastUpdated: now.toISOString(),
    });
  }

  // ===========================================================================
  // FEATURE GATING
  // ===========================================================================

  /**
   * Check if a feature is enabled for an org's plan.
   * Returns false for unknown features. Defaults to free plan limits.
   */
  isFeatureEnabled(orgId: string, feature: string): boolean {
    const limits = this.getLimitsForOrg(orgId);
    if (feature in limits) {
      const value = limits[feature as keyof PlanLimits];
      return typeof value === "boolean" ? value : false;
    }
    return false;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /** Get plan limits for an org, defaulting to free plan. */
  private getLimitsForOrg(orgId: string): PlanLimits {
    const sub = this.subscriptions.get(orgId);
    if (!sub) {
      return PLANS.free.limits;
    }
    const plan = getPlanById(sub.planId);
    return plan ? plan.limits : PLANS.free.limits;
  }

  /** Initialize empty usage record for an org. */
  private initUsage(orgId: string): void {
    if (!this.usage.has(orgId)) {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      this.usage.set(orgId, {
        orgId,
        period,
        cpoesIssued: 0,
        apiCalls: 0,
        webhooksDelivered: 0,
        scittEntries: 0,
        lastUpdated: now.toISOString(),
      });
    }
  }

  /** Get or initialize usage record for an org. */
  private getOrInitUsage(orgId: string): UsageRecord {
    if (!this.usage.has(orgId)) {
      this.initUsage(orgId);
    }
    return this.usage.get(orgId)!;
  }
}
