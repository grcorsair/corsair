/**
 * CPOE Issuance Endpoint
 *
 * POST /issue — Issue a signed CPOE from evidence
 *
 * Accepts:
 *   - JSON evidence body with controls and metadata
 *   - Returns a signed JWT-VC CPOE
 *
 * The endpoint runs the full issuance pipeline:
 *   evidence → IngestedDocument → signDocument → signed CPOE
 */

import { createHash } from "crypto";
import type { KeyManager } from "../src/parley/marque-key-manager";
import type { IngestedDocument, IngestedControl, DocumentSource, DocumentMetadata } from "../src/ingestion/types";
import type { SignAuthContext } from "../src/sign/sign-core";
import { signDocument } from "../src/sign/sign-core";

export interface IssueRouterDeps {
  keyManager: KeyManager;
  domain: string;
  db?: IssueIdempotencyDb;
  scittRegistry?: import("../src/parley/scitt-types").SCITTRegistry;
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

  /** Register signed CPOE in SCITT log (default: false) */
  registerScitt?: boolean;
}

export interface IssueResponse {
  cpoe: string;
  marqueId: string;
  provenance: {
    source: string;
    sourceIdentity?: string;
  };
  expiresAt: string;
  scittEntryId?: string;
}

const MAX_JWT_SIZE = 100_000; // 100KB

type IssueIdempotencyDb = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

type RequestWithAuth = Request & {
  corsairAuth?: import("../src/middleware/auth").CorsairAuthContext;
};

const idempotencyCache = new Map<string, { response: IssueResponse; expiresAt: number }>();

function cleanIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache) {
    if (entry.expiresAt < now) {
      idempotencyCache.delete(key);
    }
  }
}

setInterval(cleanIdempotencyCache, 5 * 60 * 1000);

function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function computeRequestHash(body: IssueRequest, authTokenHash?: string, registerScitt?: boolean): string {
  return hashString(JSON.stringify({
    ...body,
    registerScitt: registerScitt === true,
    authTokenHash: authTokenHash || null,
  }));
}

function extractAuthContext(req: Request): SignAuthContext | undefined {
  const auth = (req as RequestWithAuth).corsairAuth;
  if (!auth || auth.type !== "oidc") return undefined;
  const oidc = auth.oidc;
  return {
    oidc: {
      issuer: oidc.issuer,
      subject: oidc.subject,
      subjectHash: oidc.subjectHash,
      audience: oidc.audience,
      tokenHash: oidc.tokenHash,
      verifiedAt: oidc.verifiedAt,
      identity: oidc.identity,
    },
  };
}

/**
 * Create the issue router.
 */
export function createIssueRouter(
  deps: IssueRouterDeps,
): (req: Request) => Promise<Response> {
  const { keyManager, domain, db, scittRegistry } = deps;

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

    const registerScittHeader = req.headers.get("x-corsair-register-scitt");
    const registerScitt = body.registerScitt === true ||
      (registerScittHeader ? ["true", "1", "yes"].includes(registerScittHeader.toLowerCase()) : false);

    // Idempotency handling
    const idempotencyKey = req.headers.get("x-idempotency-key");
    const authContext = extractAuthContext(req);
    const authTokenHash = authContext?.oidc?.tokenHash;
    const requestHash = idempotencyKey ? computeRequestHash(body, authTokenHash, registerScitt) : null;
    if (idempotencyKey && db) {
      try {
        const inserted = await db`
          INSERT INTO idempotency_keys (key, route, request_hash, expires_at)
          VALUES (${idempotencyKey}, ${"/issue"}, ${requestHash}, NOW() + INTERVAL '1 hour')
          ON CONFLICT (key) DO NOTHING
          RETURNING key
        `;

        if ((inserted as Array<{ key: string }>).length === 0) {
          const rows = await db`
            SELECT request_hash, status, response, expires_at
            FROM idempotency_keys
            WHERE key = ${idempotencyKey}
          `;
          const existing = (rows as Array<{ request_hash: string; status: number | null; response: unknown | null; expires_at: string }>)[0];
          if (existing) {
            if (existing.request_hash !== requestHash) {
              return jsonError(409, "Idempotency key reuse with different payload");
            }
            if (existing.response) {
              const cached = typeof existing.response === "string"
                ? JSON.parse(existing.response)
                : existing.response;
              return jsonOk(cached, existing.status || 200);
            }
            return jsonError(202, "Request in progress. Retry shortly.");
          }
        }
      } catch {
        // Fail open: fall back to in-memory cache
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && cached.expiresAt > Date.now()) {
          return jsonOk(cached.response);
        }
      }
    } else if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        return jsonOk(cached.response);
      }
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

      const did = body.did || `did:web:${domain}`;
      const output = await signDocument({
        document: doc,
        did,
        expiryDays: body.expiryDays || 90,
        authContext,
      }, keyManager);

      if (!output.jwt) {
        return jsonError(500, "CPOE generation failed: no JWT produced");
      }

      if (Buffer.byteLength(output.jwt) > MAX_JWT_SIZE) {
        const message = `CPOE exceeds maximum size (${MAX_JWT_SIZE} bytes). Reduce evidence or extensions.`;
        if (idempotencyKey && db && requestHash) {
          try {
            await db`
              UPDATE idempotency_keys
              SET status = ${400}, response = ${JSON.stringify({ error: message })}
              WHERE key = ${idempotencyKey} AND request_hash = ${requestHash}
            `;
          } catch { /* ignore */ }
        }
        return jsonError(400, message);
      }

      // Decode to extract metadata for response
      const { decodeJwt } = await import("jose");
      const payload = decodeJwt(output.jwt) as Record<string, unknown>;
      const vc = payload.vc as Record<string, unknown>;
      const cs = vc?.credentialSubject as Record<string, unknown>;
      const provenance = cs?.provenance as { source: string; sourceIdentity?: string };

      let scittEntryId: string | undefined;
      if (registerScitt) {
        if (!output.jwt) {
          return jsonError(400, "Cannot register SCITT entry for empty JWT.");
        }
        if (!scittRegistry) {
          return jsonError(400, "SCITT registry not configured on this server.");
        }
        try {
          const registration = await scittRegistry.register(output.jwt);
          scittEntryId = registration.entryId;
        } catch (err) {
          console.error("SCITT registration failed:", err);
          return jsonError(500, "SCITT registration failed");
        }
      }

      const response: IssueResponse = {
        cpoe: output.jwt,
        marqueId: output.marqueId,
        provenance: {
          source: provenance?.source ?? "self",
          sourceIdentity: provenance?.sourceIdentity,
        },
        expiresAt: vc?.validUntil as string || new Date(Date.now() + 90 * 86400000).toISOString(),
        ...(scittEntryId ? { scittEntryId } : {}),
      };

      if (idempotencyKey && db && requestHash) {
        try {
          await db`
            UPDATE idempotency_keys
            SET status = ${201}, response = ${JSON.stringify(response)}
            WHERE key = ${idempotencyKey} AND request_hash = ${requestHash}
          `;
        } catch {
          idempotencyCache.set(idempotencyKey, {
            response,
            expiresAt: Date.now() + 60 * 60 * 1000,
          });
        }
      } else if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          response,
          expiresAt: Date.now() + 60 * 60 * 1000,
        });
      }

      return jsonOk(response, 201);
    } catch (err) {
      if (idempotencyKey && db && requestHash) {
        const errorPayload = { error: "CPOE issuance failed" };
        try {
          await db`
            UPDATE idempotency_keys
            SET status = ${500}, response = ${JSON.stringify(errorPayload)}
            WHERE key = ${idempotencyKey} AND request_hash = ${requestHash}
          `;
        } catch { /* ignore */ }
      }
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
    return "Missing required field: source (soc2, iso27001, pentest, manual, json, tool)";
  }

  const validSources: DocumentSource[] = ["soc2", "iso27001", "pentest", "manual", "json", "tool"];
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
