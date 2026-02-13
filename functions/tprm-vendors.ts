/**
 * TPRM Vendors Endpoint
 *
 * GET  /tprm/vendors — List vendors (optional ?riskTier=high&tag=cloud)
 * POST /tprm/vendors — Register a new vendor
 *
 * Both require authentication.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { TPRMEngine } from "../src/tprm/tprm-engine";
import type { RiskTier } from "../src/tprm/types";

// =============================================================================
// TYPES
// =============================================================================

export interface TPRMVendorsDeps {
  engine: TPRMEngine;
}

interface RegisterVendorRequest {
  name: string;
  domain: string;
  did: string;
  riskTier: RiskTier;
  tags: string[];
  contacts?: { name: string; email: string; role: string }[];
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
 * Create the TPRM vendors handler.
 *
 * GET: List vendors with optional filters
 * POST: Register a new vendor
 */
export function createTPRMVendorsHandler(
  deps: TPRMVendorsDeps,
): (req: Request) => Promise<Response> {
  const { engine } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method === "GET") {
      return handleListVendors(req, engine);
    }

    if (req.method === "POST") {
      return handleRegisterVendor(req, engine);
    }

    return envelopeError("method_not_allowed", "Method not allowed. Use GET or POST.", 405);
  };
}

// =============================================================================
// GET — List vendors
// =============================================================================

async function handleListVendors(req: Request, engine: TPRMEngine): Promise<Response> {
  const url = new URL(req.url);
  const riskTier = url.searchParams.get("riskTier") as RiskTier | null;
  const tag = url.searchParams.get("tag") ?? undefined;

  const filters: { riskTier?: RiskTier; tag?: string } = {};
  if (riskTier) filters.riskTier = riskTier;
  if (tag) filters.tag = tag;

  const vendors = engine.listVendors(Object.keys(filters).length > 0 ? filters : undefined);
  return envelopeOk(vendors);
}

// =============================================================================
// POST — Register vendor
// =============================================================================

async function handleRegisterVendor(req: Request, engine: TPRMEngine): Promise<Response> {
  let body: RegisterVendorRequest;
  try {
    body = await req.json();
  } catch {
    return envelopeError("bad_request", "Invalid JSON body", 400);
  }

  if (!body.name || typeof body.name !== "string") {
    return envelopeError("validation_error", 'Missing required field: "name"', 400);
  }

  if (!body.domain || typeof body.domain !== "string") {
    return envelopeError("validation_error", 'Missing required field: "domain"', 400);
  }

  if (!body.did || typeof body.did !== "string") {
    return envelopeError("validation_error", 'Missing required field: "did"', 400);
  }

  if (!body.riskTier || typeof body.riskTier !== "string") {
    return envelopeError("validation_error", 'Missing required field: "riskTier"', 400);
  }

  if (!body.tags || !Array.isArray(body.tags)) {
    return envelopeError("validation_error", 'Missing required field: "tags" (array)', 400);
  }

  try {
    const vendor = engine.registerVendor({
      name: body.name,
      domain: body.domain,
      did: body.did,
      riskTier: body.riskTier,
      tags: body.tags,
      contacts: body.contacts,
    });
    return envelopeOk(vendor, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return envelopeError("internal_error", message, 500);
  }
}
