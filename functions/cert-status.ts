/**
 * Certification Status Endpoint
 *
 * GET /cert/status?id=xxx — Public, no auth required
 *
 * Returns the status of a certification by its ID.
 * Public endpoint (like verify) to allow third parties
 * to check certification validity.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { CertificationEngine } from "../src/certification/certification-engine";

// =============================================================================
// TYPES
// =============================================================================

export interface CertStatusDeps {
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
 * Create the cert status handler.
 *
 * Accepts: GET /cert/status?id=cert-xxx
 * No auth required — certification status is public information.
 */
export function createCertStatusHandler(
  deps: CertStatusDeps,
): (req: Request) => Promise<Response> {
  const { engine } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") {
      return envelopeError("method_not_allowed", "Method not allowed. Use GET.", 405);
    }

    const url = new URL(req.url);
    const certId = url.searchParams.get("id");

    if (!certId) {
      return envelopeError("validation_error", 'Missing required query parameter: "id"', 400);
    }

    const certification = engine.getCertification(certId);
    if (!certification) {
      return envelopeError("not_found", `Certification not found: ${certId}`, 404);
    }

    // Return a subset: status, score, grade, dates (exclude full audit result for public endpoint)
    const publicData = {
      id: certification.id,
      orgId: certification.orgId,
      status: certification.status,
      currentScore: certification.currentScore,
      currentGrade: certification.currentGrade,
      lastAuditAt: certification.lastAuditAt,
      nextAuditAt: certification.nextAuditAt,
      certifiedSince: certification.certifiedSince,
      expiresAt: certification.expiresAt,
    };

    return envelopeOk(publicData);
  };
}
