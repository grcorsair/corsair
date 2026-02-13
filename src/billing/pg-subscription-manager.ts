/**
 * PgSubscriptionManager — Postgres-backed Subscription Management
 *
 * Implements the same interface as the in-memory SubscriptionManager but
 * persists all data to Postgres via Bun.sql tagged templates.
 *
 * Follows the established pattern from:
 *   - src/parley/pg-scitt-registry.ts
 *   - src/parley/pg-key-manager.ts
 *   - src/flagship/pg-ssf-stream.ts
 *
 * All queries use parameterized templates (no string interpolation).
 * Falls back to free plan defaults when tables or rows don't exist.
 */

import { getPlanById } from "./plans";
import { PLANS } from "./plans";
import {
  TIER_ORDER,
  RESOURCE_TO_LIMIT,
  type Subscription,
  type SubscriptionStatus,
  type UsageRecord,
  type UsageCheckResult,
  type PlanLimits,
} from "./types";

// =============================================================================
// DB INTERFACE (matches Bun.sql tagged template)
// =============================================================================

interface DbLike {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

// =============================================================================
// CREATE SUBSCRIPTION OPTIONS
// =============================================================================

interface CreateSubscriptionOptions {
  trialEnd?: string;
  metadata?: Record<string, string>;
}

// =============================================================================
// ROW TYPES (snake_case from Postgres)
// =============================================================================

interface SubscriptionRow {
  id: string;
  org_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  metadata: string | Record<string, string> | null;
}

interface UsageRow {
  org_id: string;
  period: string;
  cpoes_issued: number;
  api_calls: number;
  webhooks_delivered: number;
  scitt_entries: number;
  last_updated: string;
}

// =============================================================================
// COLUMN MAPPING: usage resource -> DB column name
// =============================================================================

const RESOURCE_TO_COLUMN: Record<string, string> = {
  cpoesIssued: "cpoes_issued",
  apiCalls: "api_calls",
  webhooksDelivered: "webhooks_delivered",
  scittEntries: "scitt_entries",
};

// =============================================================================
// PG SUBSCRIPTION MANAGER
// =============================================================================

export class PgSubscriptionManager {
  private db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  // ===========================================================================
  // SUBSCRIPTION CRUD
  // ===========================================================================

  /**
   * Create a new subscription for an org.
   * Throws if plan ID is invalid.
   */
  async createSubscription(
    orgId: string,
    planId: string,
    options?: CreateSubscriptionOptions,
  ): Promise<Subscription> {
    const plan = getPlanById(planId);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const isTrialing = options?.trialEnd !== undefined;
    const id = crypto.randomUUID();
    const status: SubscriptionStatus = isTrialing ? "trialing" : "active";
    const metadataJson = options?.metadata ? JSON.stringify(options.metadata) : null;

    await this.db`
      INSERT INTO subscriptions (id, org_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, trial_end, metadata)
      VALUES (${id}, ${orgId}, ${planId}, ${status}, ${now.toISOString()}, ${periodEnd.toISOString()}, ${false}, ${options?.trialEnd ?? null}, ${metadataJson})
    `;

    // Initialize usage record
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await this.db`
      INSERT INTO usage_records (org_id, period, cpoes_issued, api_calls, webhooks_delivered, scitt_entries, last_updated)
      VALUES (${orgId}, ${period}, ${0}, ${0}, ${0}, ${0}, ${now.toISOString()})
      ON CONFLICT (org_id, period) DO NOTHING
    `;

    return {
      id,
      orgId,
      planId,
      status,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: options?.trialEnd,
      metadata: options?.metadata,
    };
  }

  /**
   * Get the current subscription for an org.
   * Returns undefined if no subscription exists.
   */
  async getSubscription(orgId: string): Promise<Subscription | undefined> {
    const rows = (await this.db`
      SELECT id, org_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, trial_end, metadata
      FROM subscriptions
      WHERE org_id = ${orgId}
      ORDER BY current_period_start DESC
      LIMIT 1
    `) as SubscriptionRow[];

    if (rows.length === 0) return undefined;
    return this.rowToSubscription(rows[0]);
  }

  /**
   * Cancel a subscription.
   * @param atPeriodEnd - If true (default), cancel at period end. If false, cancel immediately.
   */
  async cancelSubscription(
    orgId: string,
    atPeriodEnd: boolean = true,
  ): Promise<Subscription> {
    const sub = await this.getSubscription(orgId);
    if (!sub) {
      throw new Error(`No subscription found for org ${orgId}`);
    }
    if (sub.status === "canceled" || sub.status === "expired") {
      throw new Error(`Subscription for org ${orgId} is already ${sub.status}`);
    }

    if (atPeriodEnd) {
      await this.db`
        UPDATE subscriptions
        SET cancel_at_period_end = ${true}
        WHERE id = ${sub.id}
      `;
      sub.cancelAtPeriodEnd = true;
    } else {
      await this.db`
        UPDATE subscriptions
        SET status = ${"canceled"}
        WHERE id = ${sub.id}
      `;
      sub.status = "canceled";
    }

    return sub;
  }

  /**
   * Upgrade to a higher-tier plan. Takes effect immediately.
   */
  async upgradeSubscription(
    orgId: string,
    newPlanId: string,
  ): Promise<Subscription> {
    const sub = await this.getSubscription(orgId);
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

    await this.db`
      UPDATE subscriptions
      SET plan_id = ${newPlanId}, status = ${"active"}, current_period_start = ${now.toISOString()}, current_period_end = ${periodEnd.toISOString()}, cancel_at_period_end = ${false}
      WHERE id = ${sub.id}
    `;

    sub.planId = newPlanId;
    sub.status = "active";
    sub.currentPeriodStart = now.toISOString();
    sub.currentPeriodEnd = periodEnd.toISOString();
    sub.cancelAtPeriodEnd = false;

    return sub;
  }

  /**
   * Downgrade to a lower-tier plan. Takes effect at period end.
   */
  async downgradeSubscription(
    orgId: string,
    newPlanId: string,
  ): Promise<Subscription> {
    const sub = await this.getSubscription(orgId);
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

    // Schedule downgrade for period end
    const metadata = sub.metadata ? { ...sub.metadata } : {};
    metadata.pendingDowngrade = newPlanId;
    const metadataJson = JSON.stringify(metadata);

    await this.db`
      UPDATE subscriptions
      SET metadata = ${metadataJson}
      WHERE id = ${sub.id}
    `;

    sub.metadata = metadata;
    return sub;
  }

  // ===========================================================================
  // USAGE TRACKING
  // ===========================================================================

  /**
   * Record usage for a resource.
   * @param amount - Amount to increment (default: 1)
   */
  async recordUsage(
    orgId: string,
    resource: string,
    amount: number = 1,
  ): Promise<void> {
    const column = RESOURCE_TO_COLUMN[resource];
    if (!column) return;

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Upsert usage: increment the correct column
    // We use separate queries per column to maintain parameterized safety
    if (column === "cpoes_issued") {
      await this.db`
        INSERT INTO usage_records (org_id, period, cpoes_issued, api_calls, webhooks_delivered, scitt_entries, last_updated)
        VALUES (${orgId}, ${period}, ${amount}, ${0}, ${0}, ${0}, ${now.toISOString()})
        ON CONFLICT (org_id, period) DO UPDATE
        SET cpoes_issued = usage_records.cpoes_issued + ${amount}, last_updated = ${now.toISOString()}
      `;
    } else if (column === "api_calls") {
      await this.db`
        INSERT INTO usage_records (org_id, period, cpoes_issued, api_calls, webhooks_delivered, scitt_entries, last_updated)
        VALUES (${orgId}, ${period}, ${0}, ${amount}, ${0}, ${0}, ${now.toISOString()})
        ON CONFLICT (org_id, period) DO UPDATE
        SET api_calls = usage_records.api_calls + ${amount}, last_updated = ${now.toISOString()}
      `;
    } else if (column === "webhooks_delivered") {
      await this.db`
        INSERT INTO usage_records (org_id, period, cpoes_issued, api_calls, webhooks_delivered, scitt_entries, last_updated)
        VALUES (${orgId}, ${period}, ${0}, ${0}, ${amount}, ${0}, ${now.toISOString()})
        ON CONFLICT (org_id, period) DO UPDATE
        SET webhooks_delivered = usage_records.webhooks_delivered + ${amount}, last_updated = ${now.toISOString()}
      `;
    } else if (column === "scitt_entries") {
      await this.db`
        INSERT INTO usage_records (org_id, period, cpoes_issued, api_calls, webhooks_delivered, scitt_entries, last_updated)
        VALUES (${orgId}, ${period}, ${0}, ${0}, ${0}, ${amount}, ${now.toISOString()})
        ON CONFLICT (org_id, period) DO UPDATE
        SET scitt_entries = usage_records.scitt_entries + ${amount}, last_updated = ${now.toISOString()}
      `;
    }
  }

  /**
   * Check if usage is within plan limits for a resource.
   * Defaults to free plan if no subscription exists.
   */
  async checkUsage(orgId: string, resource: string): Promise<UsageCheckResult> {
    const limits = await this.getLimitsForOrg(orgId);
    const usage = await this.getUsage(orgId);

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
  async getUsage(orgId: string): Promise<UsageRecord> {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const rows = (await this.db`
      SELECT org_id, period, cpoes_issued, api_calls, webhooks_delivered, scitt_entries, last_updated
      FROM usage_records
      WHERE org_id = ${orgId} AND period = ${period}
      LIMIT 1
    `) as UsageRow[];

    if (rows.length === 0) {
      return {
        orgId,
        period,
        cpoesIssued: 0,
        apiCalls: 0,
        webhooksDelivered: 0,
        scittEntries: 0,
        lastUpdated: now.toISOString(),
      };
    }

    return this.rowToUsage(rows[0]);
  }

  /** Reset all usage counters to zero for a new period. */
  async resetUsage(orgId: string): Promise<void> {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await this.db`
      INSERT INTO usage_records (org_id, period, cpoes_issued, api_calls, webhooks_delivered, scitt_entries, last_updated)
      VALUES (${orgId}, ${period}, ${0}, ${0}, ${0}, ${0}, ${now.toISOString()})
      ON CONFLICT (org_id, period) DO UPDATE
      SET cpoes_issued = ${0}, api_calls = ${0}, webhooks_delivered = ${0}, scitt_entries = ${0}, last_updated = ${now.toISOString()}
    `;
  }

  // ===========================================================================
  // FEATURE GATING
  // ===========================================================================

  /**
   * Check if a feature is enabled for an org's plan.
   * Returns false for unknown features. Defaults to free plan limits.
   */
  async isFeatureEnabled(orgId: string, feature: string): Promise<boolean> {
    const limits = await this.getLimitsForOrg(orgId);
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
  private async getLimitsForOrg(orgId: string): Promise<PlanLimits> {
    const sub = await this.getSubscription(orgId);
    if (!sub) {
      return PLANS.free.limits;
    }
    const plan = getPlanById(sub.planId);
    return plan ? plan.limits : PLANS.free.limits;
  }

  /** Map a Postgres subscription row to a Subscription object. */
  private rowToSubscription(row: SubscriptionRow): Subscription {
    let metadata: Record<string, string> | undefined;
    if (row.metadata) {
      metadata =
        typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata;
    }

    return {
      id: row.id,
      orgId: row.org_id,
      planId: row.plan_id,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      trialEnd: row.trial_end ?? undefined,
      metadata,
    };
  }

  /** Map a Postgres usage row to a UsageRecord object. */
  private rowToUsage(row: UsageRow): UsageRecord {
    return {
      orgId: row.org_id,
      period: row.period,
      cpoesIssued: row.cpoes_issued,
      apiCalls: row.api_calls,
      webhooksDelivered: row.webhooks_delivered,
      scittEntries: row.scitt_entries,
      lastUpdated: row.last_updated,
    };
  }
}
