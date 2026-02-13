/**
 * Billing Endpoint
 *
 * GET  /billing?orgId=xxx         — Get subscription + usage
 * POST /billing/subscribe         — Create subscription { orgId, planId }
 * POST /billing/cancel            — Cancel subscription { orgId, atPeriodEnd? }
 *
 * All require authentication.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { SubscriptionManager } from "../src/billing/subscription-manager";

// =============================================================================
// TYPES
// =============================================================================

export interface BillingDeps {
  manager: SubscriptionManager;
}

interface SubscribeRequest {
  orgId: string;
  planId: string;
}

interface CancelRequest {
  orgId: string;
  atPeriodEnd?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function envelopeOk<T>(data: T, status = 200): Response {
  const body: APIEnvelope<T> = { ok: true, data };
  return Response.json(body, {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

function envelopeError(code: APIErrorCode, message: string, status: number): Response {
  const body: APIEnvelope = { ok: false, error: { code, message } };
  return Response.json(body, {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Create the billing handler.
 *
 * Routes based on URL path:
 *   GET  /billing               — Get subscription + usage
 *   POST /billing/subscribe     — Create subscription
 *   POST /billing/cancel        — Cancel subscription
 */
export function createBillingHandler(
  deps: BillingDeps,
): (req: Request) => Promise<Response> {
  const { manager } = deps;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    // POST /billing/subscribe
    if (req.method === "POST" && path.endsWith("/subscribe")) {
      return handleSubscribe(req, manager);
    }

    // POST /billing/cancel
    if (req.method === "POST" && path.endsWith("/cancel")) {
      return handleCancel(req, manager);
    }

    // GET /billing
    if (req.method === "GET") {
      return handleGetBilling(req, manager);
    }

    return envelopeError("method_not_allowed", "Method not allowed.", 405);
  };
}

// =============================================================================
// GET — Get subscription + usage
// =============================================================================

async function handleGetBilling(
  req: Request,
  manager: SubscriptionManager,
): Promise<Response> {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return envelopeError("validation_error", 'Missing required query parameter: "orgId"', 400);
  }

  const subscription = manager.getSubscription(orgId);
  if (!subscription) {
    return envelopeError("not_found", `No subscription found for org: ${orgId}`, 404);
  }

  const usage = manager.getUsage(orgId);

  return envelopeOk({ subscription, usage });
}

// =============================================================================
// POST — Subscribe
// =============================================================================

async function handleSubscribe(
  req: Request,
  manager: SubscriptionManager,
): Promise<Response> {
  let body: SubscribeRequest;
  try {
    body = await req.json();
  } catch {
    return envelopeError("bad_request", "Invalid JSON body", 400);
  }

  if (!body.orgId || typeof body.orgId !== "string") {
    return envelopeError("validation_error", 'Missing required field: "orgId"', 400);
  }

  if (!body.planId || typeof body.planId !== "string") {
    return envelopeError("validation_error", 'Missing required field: "planId"', 400);
  }

  try {
    const subscription = manager.createSubscription(body.orgId, body.planId);
    return envelopeOk(subscription, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    // Invalid plan ID or existing subscription errors are client errors
    if (message.includes("Invalid plan") || message.includes("already has")) {
      return envelopeError("bad_request", message, 400);
    }
    return envelopeError("internal_error", message, 500);
  }
}

// =============================================================================
// POST — Cancel
// =============================================================================

async function handleCancel(
  req: Request,
  manager: SubscriptionManager,
): Promise<Response> {
  let body: CancelRequest;
  try {
    body = await req.json();
  } catch {
    return envelopeError("bad_request", "Invalid JSON body", 400);
  }

  if (!body.orgId || typeof body.orgId !== "string") {
    return envelopeError("validation_error", 'Missing required field: "orgId"', 400);
  }

  try {
    const atPeriodEnd = body.atPeriodEnd !== undefined ? body.atPeriodEnd : true;
    const subscription = manager.cancelSubscription(body.orgId, atPeriodEnd);
    return envelopeOk(subscription);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message.includes("No subscription found")) {
      return envelopeError("not_found", message, 404);
    }
    if (message.includes("already")) {
      return envelopeError("bad_request", message, 400);
    }
    return envelopeError("internal_error", message, 500);
  }
}
