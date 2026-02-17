/**
 * Demo CPOE Sign Endpoint
 *
 * POST /sign/demo — Public, rate-limited, no auth
 * Signs evidence with a demo keypair to deliver the full aha moment.
 */

import type { KeyManager } from "../src/parley/marque-key-manager";
import type { EvidenceFormat, SignOutput } from "../src/sign/sign-core";

export interface DemoSignRouterDeps {
  keyManager: KeyManager | null;
  demoDid: string;
}

export interface DemoSignRequest {
  evidence: unknown;
  format?: EvidenceFormat;
  scope?: string;
}

export interface DemoSignResponse {
  cpoe: string;
  marqueId: string;
  detectedFormat: string;
  summary: SignOutput["summary"];
  provenance: SignOutput["provenance"];
  warnings: string[];
  extensions?: Record<string, unknown>;
  expiresAt?: string;
  demo: true;
}

const MAX_JWT_SIZE = 100_000; // 100KB

function jsonError(status: number, message: string): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    },
  );
}

function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

export function createDemoSignRouter(
  deps: DemoSignRouterDeps,
): (req: Request) => Promise<Response> {
  const { keyManager, demoDid } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return jsonError(405, "Method not allowed. Use POST.");
    }

    if (!keyManager) {
      return jsonError(503, "Demo signing is not configured.");
    }

    let body: DemoSignRequest;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    if (!body.evidence) {
      return jsonError(400, 'Missing required field: "evidence"');
    }

    const evidenceStr = typeof body.evidence === "string"
      ? body.evidence
      : JSON.stringify(body.evidence);

    // Reject oversized evidence (250KB) for demo endpoint
    if (evidenceStr.length > 250_000) {
      return jsonError(400, "Evidence exceeds maximum size (250KB) for demo signing");
    }

    // Parse and normalize evidence
    const { parseJSON } = await import("../src/ingestion/json-parser");
    let doc;
    try {
      doc = parseJSON(body.evidence as string | object, { format: body.format });
    } catch (err) {
      return jsonError(400, err instanceof Error ? err.message : "Invalid evidence format");
    }

    // Override scope + issuer for demo clarity
    if (body.scope) {
      doc.metadata.scope = body.scope;
    }

    const baseScope = doc.metadata.scope || "Demo Assessment";
    doc.metadata.scope = baseScope.includes("(DEMO)") ? baseScope : `${baseScope} (DEMO)`;
    doc.metadata.issuer = "Corsair Demo Signing";

    const { signDocument } = await import("../src/sign/sign-core");

    try {
      const result = await signDocument({
        document: doc,
        format: body.format,
        did: demoDid,
        expiryDays: 7,
      }, keyManager);

      if (result.jwt && Buffer.byteLength(result.jwt) > MAX_JWT_SIZE) {
        return jsonError(400, `CPOE exceeds maximum size (${MAX_JWT_SIZE} bytes). Reduce evidence or extensions.`);
      }

      let expiresAt: string | undefined;
      if (result.jwt) {
        try {
          const parts = result.jwt.split(".");
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
          if (payload.exp) {
            expiresAt = new Date(payload.exp * 1000).toISOString();
          }
        } catch { /* non-critical */ }
      }

      const warnings = [
        ...result.warnings,
        "Demo signature — not for production",
      ];

      const response: DemoSignResponse = {
        cpoe: result.jwt,
        marqueId: result.marqueId,
        detectedFormat: result.detectedFormat,
        summary: result.summary,
        provenance: result.provenance,
        warnings,
        extensions: result.extensions,
        ...(expiresAt ? { expiresAt } : {}),
        demo: true,
      };

      return jsonOk(response);
    } catch (err) {
      const { SignError: SE } = await import("../src/sign/sign-core");
      if (err instanceof SE) {
        return jsonError(400, err.message);
      }
      console.error("Demo sign error:", err);
      return jsonError(500, "Internal server error during demo signing");
    }
  };
}
