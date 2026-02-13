/**
 * Certification List Endpoint
 *
 * GET /cert/list — Authenticated
 *
 * Lists certifications, optionally filtered by orgId and status.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { CertificationEngine } from "../src/certification/certification-engine";

// =============================================================================
// TYPES
// =============================================================================

export interface CertListDeps {
  engine: CertificationEngine;
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
 * Create the cert list handler.
 *
 * Accepts: GET /cert/list?orgId=xxx&status=active
 */
export function createCertListHandler(
  deps: CertListDeps,
): (req: Request) => Promise<Response> {
  const { engine } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") {
      return envelopeError("method_not_allowed", "Method not allowed. Use GET.", 405);
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId") ?? undefined;
    const statusFilter = url.searchParams.get("status") ?? undefined;

    let certifications = engine.listCertifications(orgId);

    // Filter by status if provided
    if (statusFilter) {
      certifications = certifications.filter((c) => c.status === statusFilter);
    }

    return envelopeOk(certifications);
  };
}
