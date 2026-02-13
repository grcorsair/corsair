/**
 * Billing Domain Types
 *
 * Complete type layer for Corsair billing: plans, subscriptions, usage tracking.
 * No external dependencies. Domain model only — Stripe adapter connects later.
 */

// =============================================================================
// PLAN TYPES
// =============================================================================

/** Plan tiers matching Let's Encrypt revenue model */
export type PlanTier = "free" | "pro" | "platform";

/** Billing interval */
export type BillingInterval = "monthly" | "quarterly" | "annual";

/** Plan definition */
export interface Plan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string;
  price: number; // cents (e.g., 19900 = $199.00)
  interval: BillingInterval;
  limits: PlanLimits;
  features: string[];
}

/** Usage limits per plan */
export interface PlanLimits {
  cpoesPerMonth: number; // -1 = unlimited
  apiCallsPerDay: number; // -1 = unlimited
  webhookEndpoints: number;
  scittRetentionDays: number;
  flagshipStreams: number;
  enrichment: boolean; // CHART + QUARTER
  sdJwt: boolean; // Selective disclosure
  auditEngine: boolean; // corsair audit
  customDID: boolean; // Custom did:web domain
}

// =============================================================================
// SUBSCRIPTION TYPES
// =============================================================================

/** Subscription state */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired";

/** A customer subscription */
export interface Subscription {
  id: string;
  orgId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  metadata?: Record<string, string>;
}

// =============================================================================
// USAGE TYPES
// =============================================================================

/** Usage tracking record */
export interface UsageRecord {
  orgId: string;
  period: string; // "YYYY-MM" format
  cpoesIssued: number;
  apiCalls: number;
  webhooksDelivered: number;
  scittEntries: number;
  lastUpdated: string;
}

/** Usage check result */
export interface UsageCheckResult {
  allowed: boolean;
  resource: string;
  current: number;
  limit: number;
  remaining: number;
  resetAt?: string;
}

// =============================================================================
// TIER ORDERING (for upgrade/downgrade validation)
// =============================================================================

/** Numeric tier ordering for upgrade/downgrade checks */
export const TIER_ORDER: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  platform: 2,
};

/** Boolean feature keys on PlanLimits */
export type FeatureFlag = "enrichment" | "sdJwt" | "auditEngine" | "customDID";

/** Numeric usage keys on PlanLimits that map to UsageRecord fields */
export const RESOURCE_TO_LIMIT: Record<string, keyof PlanLimits> = {
  cpoesIssued: "cpoesPerMonth",
  apiCalls: "apiCallsPerDay",
};

/** Valid usage resource names */
export type UsageResource =
  | "cpoesIssued"
  | "apiCalls"
  | "webhooksDelivered"
  | "scittEntries";
