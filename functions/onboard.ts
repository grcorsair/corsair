/**
 * Onboard Endpoint
 *
 * POST /onboard — Authenticated
 *
 * Returns machine-actionable onboarding artifacts:
 * - did.json
 * - jwks.json
 * - trust.txt
 */

import type { KeyManager } from "../src/parley/marque-key-manager";
import type { DIDDocument } from "../src/parley/did-resolver";
import { formatDIDWeb, parseDIDWeb } from "../src/parley/did-resolver";
import { generateTrustTxt, validateTrustTxt, type TrustTxt, type TrustTxtValidation } from "../src/parley/trust-txt";

// =============================================================================
// TYPES
// =============================================================================

export interface OnboardDeps {
  keyManager: KeyManager;
  domain: string;
}

export interface OnboardRequest {
  /** Optional domain override (must match server domain) */
  domain?: string;

  /** Optional DID override (must match server domain; no path support) */
  did?: string;

  /** CPOE URLs to list in trust.txt */
  cpoes?: string[];

  /** SCITT endpoint override */
  scitt?: string;

  /** Catalog snapshot URL */
  catalog?: string;

  /** Policy artifact URL */
  policy?: string;

  /** FLAGSHIP stream endpoint override */
  flagship?: string;

  /** Compliance frameworks in scope */
  frameworks?: string[];

  /** Compliance contact */
  contact?: string;

  /** trust.txt expiry window in days (default: 365) */
  expiryDays?: number;

  /** Populate default SCITT/FLAGSHIP URLs (default: true) */
  includeDefaults?: boolean;
}

export interface OnboardFile<T> {
  path: string;
  mediaType: string;
  content: T;
}

export interface OnboardResponse {
  domain: string;
  did: string;
  urls: {
    didJson: string;
    jwksJson: string;
    trustTxt: string;
  };
  files: {
    didJson: OnboardFile<DIDDocument>;
    jwksJson: OnboardFile<{ keys: JsonWebKey[] }>;
    trustTxt: OnboardFile<string> & {
      parsed: TrustTxt;
      validation: TrustTxtValidation;
    };
  };
}

// =============================================================================
// HELPERS
// =============================================================================

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

// =============================================================================
// ROUTER
// =============================================================================

export function createOnboardRouter(
  deps: OnboardDeps,
): (req: Request) => Promise<Response> {
  const { keyManager, domain: serverDomain } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return jsonError(405, "Method not allowed. Use POST.");
    }

    let body: OnboardRequest;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    const requestedDomain = typeof body.domain === "string" ? body.domain.trim() : "";
    const domain = requestedDomain || serverDomain;

    if (!domain) {
      return jsonError(400, "Missing domain");
    }

    if (domain !== serverDomain) {
      return jsonError(400, `Domain mismatch. This server is configured for ${serverDomain}.`);
    }

    let did = formatDIDWeb(domain);
    if (body.did) {
      try {
        const parsed = parseDIDWeb(body.did);
        if (parsed.path) {
          return jsonError(400, "DID path segments are not supported for onboarding");
        }
        if (parsed.domain !== domain) {
          return jsonError(400, `DID domain mismatch. Expected ${domain}.`);
        }
        did = formatDIDWeb(parsed.domain);
      } catch (err) {
        return jsonError(400, (err as Error).message);
      }
    }

    const expiryDays = typeof body.expiryDays === "number" && body.expiryDays > 0
      ? body.expiryDays
      : 365;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const includeDefaults = body.includeDefaults !== false;
    const scitt = body.scitt || (includeDefaults ? `https://${domain}/scitt/entries` : undefined);
    const flagship = body.flagship || (includeDefaults ? `https://${domain}/ssf/streams` : undefined);

    const trustTxtInput: TrustTxt = {
      did,
      cpoes: isStringArray(body.cpoes) ? body.cpoes : [],
      scitt,
      catalog: typeof body.catalog === "string" ? body.catalog : undefined,
      policy: typeof body.policy === "string" ? body.policy : undefined,
      flagship,
      frameworks: isStringArray(body.frameworks) ? body.frameworks : [],
      contact: typeof body.contact === "string" ? body.contact : undefined,
      expires: expiresAt,
    };

    const validation = validateTrustTxt(trustTxtInput);
    if (!validation.valid) {
      return jsonError(400, validation.errors.join("; "));
    }

    // Ensure keys exist (auto-generate if missing)
    const existing = await keyManager.loadKeypair();
    if (!existing) {
      await keyManager.generateKeypair();
    }

    let didDocument: DIDDocument;
    let jwk: JsonWebKey;
    try {
      didDocument = await keyManager.generateDIDDocument(domain);
      jwk = await keyManager.exportJWK();
    } catch {
      return jsonError(503, "No signing key configured. Run key generation first.");
    }

    jwk.kid = `${did}#key-1`;
    jwk.use = "sig";
    jwk.alg = "EdDSA";

    const jwks = { keys: [jwk] };
    const trustTxt = generateTrustTxt(trustTxtInput);

    const response: OnboardResponse = {
      domain,
      did,
      urls: {
        didJson: `https://${domain}/.well-known/did.json`,
        jwksJson: `https://${domain}/.well-known/jwks.json`,
        trustTxt: `https://${domain}/.well-known/trust.txt`,
      },
      files: {
        didJson: {
          path: "/.well-known/did.json",
          mediaType: "application/did+ld+json",
          content: didDocument,
        },
        jwksJson: {
          path: "/.well-known/jwks.json",
          mediaType: "application/jwk-set+json",
          content: jwks,
        },
        trustTxt: {
          path: "/.well-known/trust.txt",
          mediaType: "text/plain",
          content: trustTxt,
          parsed: trustTxtInput,
          validation,
        },
      },
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    });
  };
}
