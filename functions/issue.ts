/**
 * CPOE Issuance Endpoint
 *
 * POST /issue — Issue a signed CPOE from evidence
 *
 * Accepts:
 *   - JSON evidence body with controls and metadata
 *   - Returns a signed JWT-VC CPOE
 *
 * This is the revenue endpoint:
 *   L0 (Documented) — free, self-reported controls
 *   L1+ (Configured, Demonstrated, etc.) — requires API key (future)
 *
 * The endpoint runs the full ingestion pipeline:
 *   evidence → IngestedDocument → mapToMarqueInput → generateVCJWT → signed CPOE
 */

import type { KeyManager } from "../src/parley/marque-key-manager";
import type { IngestedDocument, IngestedControl, DocumentSource, DocumentMetadata } from "../src/ingestion/types";
import { mapToMarqueInput } from "../src/ingestion/mapper";
import { MarqueGenerator } from "../src/parley/marque-generator";
import { ReceiptChain } from "../src/parley/receipt-chain";
import { hashData } from "../src/parley/process-receipt";

export interface IssueRouterDeps {
  keyManager: KeyManager;
  domain: string;
}

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

/**
 * Request body for CPOE issuance.
 *
 * Accepts pre-parsed evidence (controls + metadata).
 * PDF parsing is handled separately (CLI or future upload endpoint).
 */
export interface IssueRequest {
  /** Document source type */
  source: DocumentSource;

  /** Document metadata */
  metadata: {
    title: string;
    issuer: string;
    date: string;
    scope: string;
    auditor?: string;
    reportType?: string;
    rawTextHash?: string;
  };

  /** Extracted controls */
  controls: Array<{
    id: string;
    description: string;
    status: "effective" | "ineffective" | "not-tested";
    evidence?: string;
    severity?: string;
    frameworkRefs?: Array<{
      framework: string;
      controlId: string;
      controlName?: string;
    }>;
  }>;

  /** Optional issuer DID */
  did?: string;

  /** Optional CPOE expiry in days (default: 90) */
  expiryDays?: number;
}

export interface IssueResponse {
  cpoe: string;
  marqueId: string;
  assurance: {
    declared: number;
    verified: boolean;
    method: string;
  };
  provenance: {
    source: string;
    sourceIdentity?: string;
  };
  expiresAt: string;
}

/**
 * Create the issue router.
 */
export function createIssueRouter(
  deps: IssueRouterDeps,
): (req: Request) => Promise<Response> {
  const { keyManager, domain } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return jsonError(405, "Method not allowed. Use POST.");
    }

    // Parse request body
    let body: IssueRequest;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    // Validate required fields
    const validation = validateIssueRequest(body);
    if (validation) {
      return jsonError(400, validation);
    }

    try {
      // Build IngestedDocument from request
      const controls: IngestedControl[] = body.controls.map(c => ({
        id: c.id,
        description: c.description,
        status: c.status,
        evidence: c.evidence,
        severity: c.severity as IngestedControl["severity"],
        frameworkRefs: c.frameworkRefs?.map(r => ({
          framework: r.framework,
          controlId: r.controlId,
          controlName: r.controlName,
        })),
      }));

      const metadata: DocumentMetadata = {
        title: body.metadata.title,
        issuer: body.metadata.issuer,
        date: body.metadata.date,
        scope: body.metadata.scope,
        auditor: body.metadata.auditor,
        reportType: body.metadata.reportType,
        rawTextHash: body.metadata.rawTextHash,
      };

      const doc: IngestedDocument = {
        source: body.source,
        metadata,
        controls,
      };

      // Map to MarqueGeneratorInput
      const did = body.did || `did:web:${domain}`;
      const input = mapToMarqueInput(doc, { did });

      // Build process receipt chain
      const keypair = await keyManager.loadKeypair();
      if (keypair) {
        const chain = new ReceiptChain(keypair.privateKey.toString());

        // Receipt 1: CLASSIFY (deterministic — evidence mapping)
        await chain.captureStep({
          step: "classify",
          inputData: { controlCount: controls.length, source: body.source },
          outputData: { assurance: "calculated" },
          reproducible: true,
          codeVersion: "assurance-calculator@2026-02-09",
        });

        // Receipt 2: CHART (deterministic — framework mapping)
        await chain.captureStep({
          step: "chart",
          inputData: controls.map(c => c.frameworkRefs),
          outputData: input.chartResults,
          reproducible: true,
          codeVersion: "chart-engine@1.0",
        });

        input.processReceipts = chain.getReceipts();
      }

      // Generate signed CPOE
      const generator = new MarqueGenerator(keyManager, {
        expiryDays: body.expiryDays || 90,
        format: "vc",
      });

      const output = await generator.generateOutput(input);

      if (!output.jwt) {
        return jsonError(500, "CPOE generation failed: no JWT produced");
      }

      // Decode to extract metadata for response
      const { decodeJwt } = await import("jose");
      const payload = decodeJwt(output.jwt) as Record<string, unknown>;
      const vc = payload.vc as Record<string, unknown>;
      const cs = vc?.credentialSubject as Record<string, unknown>;
      const assurance = cs?.assurance as { declared: number; verified: boolean; method: string };
      const provenance = cs?.provenance as { source: string; sourceIdentity?: string };

      const response: IssueResponse = {
        cpoe: output.jwt,
        marqueId: output.marqueId,
        assurance: {
          declared: assurance?.declared ?? 0,
          verified: assurance?.verified ?? false,
          method: assurance?.method ?? "self-assessed",
        },
        provenance: {
          source: provenance?.source ?? "self",
          sourceIdentity: provenance?.sourceIdentity,
        },
        expiresAt: vc?.validUntil as string || new Date(Date.now() + 90 * 86400000).toISOString(),
      };

      return jsonOk(response, 201);
    } catch (err) {
      console.error("CPOE issuance failed:", err instanceof Error ? err.message : err);
      return jsonError(500, "CPOE issuance failed");
    }
  };
}

/**
 * Validate the issue request body. Returns error message or null.
 */
function validateIssueRequest(body: IssueRequest): string | null {
  if (!body.source) {
    return "Missing required field: source (soc2, iso27001, prowler, pentest, manual)";
  }

  const validSources: DocumentSource[] = ["soc2", "iso27001", "prowler", "securityhub", "pentest", "manual"];
  if (!validSources.includes(body.source)) {
    return `Invalid source: "${body.source}". Must be one of: ${validSources.join(", ")}`;
  }

  if (!body.metadata) {
    return "Missing required field: metadata";
  }

  for (const field of ["title", "issuer", "date", "scope"] as const) {
    if (!body.metadata[field]) {
      return `Missing required field: metadata.${field}`;
    }
  }

  if (!body.controls || !Array.isArray(body.controls) || body.controls.length === 0) {
    return "Missing required field: controls (non-empty array)";
  }

  for (let i = 0; i < body.controls.length; i++) {
    const ctrl = body.controls[i];
    if (!ctrl.id) return `controls[${i}].id is required`;
    if (!ctrl.description) return `controls[${i}].description is required`;
    if (!["effective", "ineffective", "not-tested"].includes(ctrl.status)) {
      return `controls[${i}].status must be "effective", "ineffective", or "not-tested"`;
    }
  }

  return null;
}
