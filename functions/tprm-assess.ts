/**
 * TPRM Assessment Endpoint
 *
 * POST /tprm/assess — Authenticated
 *
 * Runs a vendor risk assessment against provided CPOEs.
 * Requires an existing vendor and assessment request in the engine.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { TPRMEngine } from "../src/tprm/tprm-engine";

// =============================================================================
// TYPES
// =============================================================================

export interface TPRMAssessDeps {
  engine: TPRMEngine;
}

interface TPRMAssessRequest {
  vendorId: string;
  frameworks: string[];
  cpoes: unknown[];
  requestId?: string;
  minimumScore?: number;
  minimumAssurance?: number;
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
 * Create the TPRM assessment handler.
 *
 * Accepts:
 *   { "vendorId": "...", "frameworks": [...], "cpoes": [...], "requestId?": "..." }
 *
 * If requestId is not provided, creates an assessment request automatically.
 */
export function createTPRMAssessHandler(
  deps: TPRMAssessDeps,
): (req: Request) => Promise<Response> {
  const { engine } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return envelopeError("method_not_allowed", "Method not allowed. Use POST.", 405);
    }

    let body: TPRMAssessRequest;
    try {
      body = await req.json();
    } catch {
      return envelopeError("bad_request", "Invalid JSON body", 400);
    }

    if (!body.vendorId || typeof body.vendorId !== "string") {
      return envelopeError("validation_error", 'Missing required field: "vendorId"', 400);
    }

    if (!body.frameworks || !Array.isArray(body.frameworks)) {
      return envelopeError("validation_error", 'Missing required field: "frameworks" (array)', 400);
    }

    try {
      // Use provided requestId or create one
      let requestId = body.requestId;

      if (!requestId) {
        // Auto-create assessment request
        const request = engine.requestAssessment(body.vendorId, {
          requestedBy: "api",
          frameworks: body.frameworks,
          minimumScore: body.minimumScore ?? 70,
          minimumAssurance: body.minimumAssurance ?? 1,
        });
        requestId = request.id;
      }

      const result = engine.runAssessment(requestId, body.cpoes as any[]);
      return envelopeOk(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error during assessment";
      // Vendor/request not found errors are client errors
      if (message.includes("not found")) {
        return envelopeError("not_found", message, 404);
      }
      return envelopeError("internal_error", message, 500);
    }
  };
}
