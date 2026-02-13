/**
 * TPRM Dashboard Endpoint
 *
 * GET /tprm/dashboard — Authenticated
 *
 * Returns the TPRM dashboard summary: vendor counts by risk tier,
 * assessment decisions, average score, and recent assessments.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { TPRMEngine } from "../src/tprm/tprm-engine";

// =============================================================================
// TYPES
// =============================================================================

export interface TPRMDashboardDeps {
  engine: TPRMEngine;
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
 * Create the TPRM dashboard handler.
 *
 * GET: Returns dashboard summary
 */
export function createTPRMDashboardHandler(
  deps: TPRMDashboardDeps,
): (req: Request) => Promise<Response> {
  const { engine } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") {
      return envelopeError("method_not_allowed", "Method not allowed. Use GET.", 405);
    }

    const dashboard = engine.getDashboard();
    return envelopeOk(dashboard);
  };
}
