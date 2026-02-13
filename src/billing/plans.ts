/**
 * Plan Catalog
 *
 * Defines the three Corsair plan tiers: free, pro, platform.
 * Pricing follows the Let's Encrypt revenue model:
 *   - Free: verify + sign (50 CPOEs/mo, Corsair-signed, SCITT)
 *   - Pro: $199/mo (unlimited signing, diff history, CHART+QUARTER enrichment)
 *   - Platform: $2,000/mo (API, FLAGSHIP, SLA, custom DID, unlimited everything)
 */

import type { Plan, PlanTier } from "./types";

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    id: "plan_free",
    tier: "free",
    name: "Free",
    description: "Verify trust. Sign up to 50 CPOEs/month.",
    price: 0,
    interval: "monthly",
    limits: {
      cpoesPerMonth: 50,
      apiCallsPerDay: 100,
      webhookEndpoints: 2,
      scittRetentionDays: 30,
      flagshipStreams: 1,
      enrichment: false,
      sdJwt: false,
      auditEngine: false,
      customDID: false,
    },
    features: [
      "Sign CPOEs",
      "Verify CPOEs",
      "SCITT log (30 days)",
      "1 FLAGSHIP stream",
    ],
  },

  pro: {
    id: "plan_pro",
    tier: "pro",
    name: "Pro",
    description:
      "Unlimited signing with enrichment. CHART + QUARTER + SD-JWT + audit engine.",
    price: 19900,
    interval: "monthly",
    limits: {
      cpoesPerMonth: 500,
      apiCallsPerDay: 5000,
      webhookEndpoints: 10,
      scittRetentionDays: 365,
      flagshipStreams: 10,
      enrichment: true,
      sdJwt: true,
      auditEngine: true,
      customDID: false,
    },
    features: [
      "Sign CPOEs (500/mo)",
      "Verify CPOEs",
      "SCITT log (1 year)",
      "10 FLAGSHIP streams",
      "CHART framework mapping",
      "QUARTER governance review",
      "SD-JWT selective disclosure",
      "Audit engine",
      "Diff history",
      "Priority support",
    ],
  },

  platform: {
    id: "plan_platform",
    tier: "platform",
    name: "Platform",
    description:
      "Unlimited everything. API access, FLAGSHIP SLA, custom DID, dedicated support.",
    price: 200000,
    interval: "monthly",
    limits: {
      cpoesPerMonth: -1,
      apiCallsPerDay: -1,
      webhookEndpoints: 100,
      scittRetentionDays: -1,
      flagshipStreams: -1,
      enrichment: true,
      sdJwt: true,
      auditEngine: true,
      customDID: true,
    },
    features: [
      "Unlimited CPOEs",
      "Unlimited API calls",
      "Verify CPOEs",
      "SCITT log (unlimited retention)",
      "Unlimited FLAGSHIP streams",
      "CHART framework mapping",
      "QUARTER governance review",
      "SD-JWT selective disclosure",
      "Audit engine",
      "Custom did:web domain",
      "Diff history",
      "SLA guarantee",
      "Dedicated support",
    ],
  },
};

/** Look up a plan by its ID (e.g., "plan_free" -> free plan) */
export function getPlanById(planId: string): Plan | undefined {
  return Object.values(PLANS).find((plan) => plan.id === planId);
}

/** Look up a plan by its tier */
export function getPlanByTier(tier: PlanTier): Plan {
  return PLANS[tier];
}
