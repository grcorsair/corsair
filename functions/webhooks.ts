/**
 * Webhooks Endpoint
 *
 * POST   /webhooks — Register a new webhook endpoint
 * GET    /webhooks — List active webhook endpoints
 * DELETE /webhooks — Remove a webhook endpoint
 *
 * All require authentication.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { WebhookManager } from "../src/webhooks/webhook-manager";
import type { WebhookEventType } from "../src/webhooks/types";

// =============================================================================
// TYPES
// =============================================================================

export interface WebhooksDeps {
  manager: WebhookManager;
}

interface RegisterWebhookRequest {
  url: string;
  events: WebhookEventType[];
  metadata?: Record<string, string>;
}

interface RemoveWebhookRequest {
  id: string;
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
 * Create the webhooks handler.
 *
 * POST: Register endpoint { url, events, metadata? }
 * GET: List active endpoints
 * DELETE: Remove endpoint { id }
 */
export function createWebhooksHandler(
  deps: WebhooksDeps,
): (req: Request) => Promise<Response> {
  const { manager } = deps;

  return async (req: Request): Promise<Response> => {
    switch (req.method) {
      case "GET":
        return handleListWebhooks(manager);
      case "POST":
        return handleRegisterWebhook(req, manager);
      case "DELETE":
        return handleRemoveWebhook(req, manager);
      default:
        return envelopeError("method_not_allowed", "Method not allowed. Use GET, POST, or DELETE.", 405);
    }
  };
}

// =============================================================================
// GET — List endpoints
// =============================================================================

function handleListWebhooks(manager: WebhookManager): Response {
  const endpoints = manager.listEndpoints();
  return envelopeOk(endpoints);
}

// =============================================================================
// POST — Register endpoint
// =============================================================================

async function handleRegisterWebhook(
  req: Request,
  manager: WebhookManager,
): Promise<Response> {
  let body: RegisterWebhookRequest;
  try {
    body = await req.json();
  } catch {
    return envelopeError("bad_request", "Invalid JSON body", 400);
  }

  if (!body.url || typeof body.url !== "string") {
    return envelopeError("validation_error", 'Missing required field: "url"', 400);
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return envelopeError("validation_error", 'Missing required field: "events" (non-empty array)', 400);
  }

  try {
    const endpoint = manager.registerEndpoint(
      body.url,
      body.events,
      undefined,
      body.metadata,
    );
    return envelopeOk(endpoint, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return envelopeError("bad_request", message, 400);
  }
}

// =============================================================================
// DELETE — Remove endpoint
// =============================================================================

async function handleRemoveWebhook(
  req: Request,
  manager: WebhookManager,
): Promise<Response> {
  let body: RemoveWebhookRequest;
  try {
    body = await req.json();
  } catch {
    return envelopeError("bad_request", "Invalid JSON body", 400);
  }

  if (!body.id || typeof body.id !== "string") {
    return envelopeError("validation_error", 'Missing required field: "id"', 400);
  }

  const removed = manager.removeEndpoint(body.id);
  if (!removed) {
    return envelopeError("not_found", `Webhook endpoint not found or already inactive: ${body.id}`, 404);
  }

  return envelopeOk({ id: body.id, removed: true });
}
