/**
 * Certification Create Endpoint
 *
 * POST /cert — Authenticated
 *
 * Creates a new compliance certification for an organization.
 * Runs an initial audit against the provided scope, then creates
 * the certification with the policy and audit result.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { CertificationEngine } from "../src/certification/certification-engine";
import type { CertificationPolicy } from "../src/certification/types";
import type { AuditScope } from "../src/audit/types";

// =============================================================================
// TYPES
// =============================================================================

export interface CertCreateDeps {
  engine: CertificationEngine;
}

interface CertCreateRequest {
  orgId: string;
  scope: AuditScope;
  policy?: Partial<CertificationPolicy>;
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
 * Create the cert creation handler.
 *
 * Accepts:
 *   { "orgId": "...", "scope": {...}, "policy?": {...} }
 */
export function createCertCreateHandler(
  deps: CertCreateDeps,
): (req: Request) => Promise<Response> {
  const { engine } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return envelopeError("method_not_allowed", "Method not allowed. Use POST.", 405);
    }

    let body: CertCreateRequest;
    try {
      body = await req.json();
    } catch {
      return envelopeError("bad_request", "Invalid JSON body", 400);
    }

    if (!body.orgId || typeof body.orgId !== "string") {
      return envelopeError("validation_error", 'Missing required field: "orgId"', 400);
    }

    if (!body.scope || typeof body.scope !== "object") {
      return envelopeError("validation_error", 'Missing required field: "scope"', 400);
    }

    try {
      // Run an initial audit against the scope
      const { runAudit } = await import("../src/audit/audit-engine");
      const auditResult = await runAudit(body.scope);

      // Build full policy with defaults
      const policyDefaults: CertificationPolicy = {
        id: `policy-${crypto.randomUUID()}`,
        name: `${body.orgId} Certification Policy`,
        scope: body.scope,
        minimumScore: 70,
        warningThreshold: 80,
        auditIntervalDays: 90,
        freshnessMaxDays: 7,
        gracePeriodDays: 14,
        autoRenew: false,
        autoSuspend: false,
        notifyOnChange: false,
        ...body.policy,
      } as CertificationPolicy;

      const certification = engine.createCertification(body.orgId, policyDefaults, auditResult);
      return envelopeOk(certification, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error during certification creation";
      return envelopeError("internal_error", message, 500);
    }
  };
}
