/**
 * Audit Endpoint
 *
 * POST /audit — Authenticated
 *
 * Accepts evidence file paths + scope, runs full compliance audit via
 * the audit engine, returns AuditResult in APIEnvelope.
 */

import type { APIEnvelope, APIErrorCode } from "../src/api/types";
import type { AuditScope, AuditConfig } from "../src/audit/types";

// =============================================================================
// TYPES
// =============================================================================

interface AuditRequest {
  files: string[];
  scope: string;
  frameworks?: string[];
  config?: Partial<AuditConfig>;
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
 * Create the audit endpoint handler.
 *
 * Accepts:
 *   { "files": [...], "scope": "...", "frameworks?": [...], "config?": {...} }
 */
export function createAuditHandler(): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return envelopeError("method_not_allowed", "Method not allowed. Use POST.", 405);
    }

    let body: AuditRequest;
    try {
      body = await req.json();
    } catch {
      return envelopeError("bad_request", "Invalid JSON body", 400);
    }

    if (!body.files || !Array.isArray(body.files)) {
      return envelopeError("validation_error", 'Missing required field: "files" (array of file paths)', 400);
    }

    if (!body.scope || typeof body.scope !== "string") {
      return envelopeError("validation_error", 'Missing required field: "scope" (string)', 400);
    }

    const scope: AuditScope = {
      name: body.scope,
      frameworks: body.frameworks ?? [],
      evidencePaths: body.files,
    };

    try {
      const { runAudit } = await import("../src/audit/audit-engine");
      const result = await runAudit(scope, body.config);
      return envelopeOk(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error during audit";
      return envelopeError("internal_error", message, 500);
    }
  };
}
