/**
 * Billing Module — Barrel Export
 *
 * Domain model for Corsair billing: plans, subscriptions, usage tracking.
 * No external dependencies. Stripe adapter connects later.
 */

// Types
export type {
  PlanTier,
  BillingInterval,
  Plan,
  PlanLimits,
  SubscriptionStatus,
  Subscription,
  UsageRecord,
  UsageCheckResult,
  FeatureFlag,
  UsageResource,
} from "./types";

export { TIER_ORDER, RESOURCE_TO_LIMIT } from "./types";

// Plan catalog
export { PLANS, getPlanById, getPlanByTier } from "./plans";

// Subscription manager
export { SubscriptionManager } from "./subscription-manager";
