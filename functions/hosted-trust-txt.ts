/**
 * Hosted trust.txt Endpoints
 *
 * POST   /trust-txt/host               — Create or update hosted trust.txt
 * GET    /trust-txt/host/:domain       — Fetch hosted trust.txt config
 * POST   /trust-txt/host/:domain/verify — Verify DNS delegation
 * GET    /trust/:domain/trust.txt      — Public hosted trust.txt
 */

import { createHash } from "crypto";
import { generateTrustTxt, validateTrustTxt, type TrustTxt, type TrustTxtResolution, resolveTrustTxt } from "../src/parley/trust-txt";
import { formatDIDWeb, parseDIDWeb } from "../src/parley/did-resolver";
import {
  createMemoryHostedTrustTxtStore,
  hashTrustTxt,
  type HostedTrustTxtRecord,
  type HostedTrustTxtStatus,
  type HostedTrustTxtStore,
  type HostedTrustTxtOwnerType,
} from "../src/parley/hosted-trust-store";

// =============================================================================
// TYPES
// =============================================================================

export interface HostedTrustTxtRequest {
  domain: string;
  did?: string;
  cpoes?: string[];
  scitt?: string;
  catalog?: string;
  policy?: string;
  flagship?: string;
  frameworks?: string[];
  contact?: string;
  expiryDays?: number;
  includeDefaults?: boolean;
}

export interface HostedTrustTxtResponse {
  domain: string;
  did: string;
  status: HostedTrustTxtStatus;
  trustTxt: {
    content: string;
    hash: string;
    expires?: string;
  };
  urls: {
    hosted: string;
  };
  dns: {
    txt: string;
    hashTxt: string;
  };
  verifiedAt?: string | null;
}

export interface HostedTrustTxtVerifyResponse {
  domain: string;
  status: HostedTrustTxtStatus;
  verifiedAt?: string | null;
  resolution?: Pick<TrustTxtResolution, "source" | "url" | "delegated">;
}

export interface HostedTrustTxtDeps {
  store: HostedTrustTxtStore;
  trustHost: string;
  resolveTrustTxt?: typeof resolveTrustTxt;
  now?: () => Date;
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

function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

function normalizePath(pathname: string): string {
  if (pathname.startsWith("/v1/")) return pathname.slice(3);
  return pathname;
}

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(domain);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function computeExpiry(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function buildHostedUrl(trustHost: string, domain: string): string {
  return `https://${trustHost}/trust/${encodeURIComponent(domain)}/trust.txt`;
}

function buildDnsRecords(domain: string, hostedUrl: string, hash: string): { txt: string; hashTxt: string } {
  return {
    txt: `_corsair.${domain} TXT "corsair-trusttxt=${hostedUrl}"`,
    hashTxt: `_corsair.${domain} TXT "corsair-trusttxt-sha256=${hash}"`,
  };
}

function extractOwner(req: Request): { type: HostedTrustTxtOwnerType; id: string } | null {
  const auth = (req as Request & { corsairAuth?: { type?: string; key?: string; oidc?: { subjectHash?: string } } }).corsairAuth;
  if (!auth || !auth.type) return null;
  if (auth.type === "api_key" && auth.key) {
    const hash = createHash("sha256").update(auth.key).digest("hex");
    return { type: "api_key", id: hash };
  }
  if (auth.type === "oidc" && auth.oidc?.subjectHash) {
    return { type: "oidc", id: auth.oidc.subjectHash };
  }
  return null;
}

function buildTrustTxtInput(domain: string, body: HostedTrustTxtRequest): TrustTxt {
  const expiryDays = typeof body.expiryDays === "number" && body.expiryDays > 0
    ? body.expiryDays
    : 365;
  const includeDefaults = body.includeDefaults !== false;

  const scitt = body.scitt || (includeDefaults ? `https://${domain}/scitt/entries` : undefined);
  const flagship = body.flagship || (includeDefaults ? `https://${domain}/ssf/streams` : undefined);

  return {
    did: body.did,
    cpoes: isStringArray(body.cpoes) ? body.cpoes : [],
    scitt,
    catalog: typeof body.catalog === "string" ? body.catalog : undefined,
    policy: typeof body.policy === "string" ? body.policy : undefined,
    flagship,
    frameworks: isStringArray(body.frameworks) ? body.frameworks : [],
    contact: typeof body.contact === "string" ? body.contact : undefined,
    expires: computeExpiry(expiryDays),
  };
}

function buildResponse(record: HostedTrustTxtRecord, trustHost: string): HostedTrustTxtResponse {
  const hostedUrl = buildHostedUrl(trustHost, record.domain);
  const dns = buildDnsRecords(record.domain, hostedUrl, record.trustTxtHash);

  return {
    domain: record.domain,
    did: record.did,
    status: record.status,
    trustTxt: {
      content: record.trustTxt,
      hash: record.trustTxtHash,
      expires: record.config.expires,
    },
    urls: {
      hosted: hostedUrl,
    },
    dns,
    verifiedAt: record.verifiedAt || null,
  };
}

function ownerMatches(record: HostedTrustTxtRecord, owner: { type: HostedTrustTxtOwnerType; id: string }): boolean {
  return record.ownerType === owner.type && record.ownerId === owner.id;
}

// =============================================================================
// ROUTER
// =============================================================================

export function createHostedTrustTxtRouter(
  deps: HostedTrustTxtDeps,
): (req: Request) => Promise<Response> {
  const { store, trustHost } = deps;
  const doResolveTrustTxt = deps.resolveTrustTxt ?? resolveTrustTxt;
  const now = deps.now ?? (() => new Date());

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);

    if (path === "/trust-txt/host" && req.method === "POST") {
      let body: HostedTrustTxtRequest;
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "Invalid JSON body");
      }

      const rawDomain = typeof body.domain === "string" ? body.domain : "";
      const domain = normalizeDomain(rawDomain);
      if (!isValidDomain(domain)) {
        return jsonError(400, "Invalid domain format");
      }

      const owner = extractOwner(req);
      if (!owner) {
        return jsonError(401, "Missing authentication context");
      }

      let did = formatDIDWeb(domain);
      if (body.did) {
        try {
          const parsed = parseDIDWeb(body.did);
          if (parsed.path) {
            return jsonError(400, "DID path segments are not supported");
          }
          if (parsed.domain !== domain) {
            return jsonError(400, `DID domain mismatch. Expected ${domain}.`);
          }
          did = formatDIDWeb(parsed.domain);
        } catch (err) {
          return jsonError(400, (err as Error).message);
        }
      }

      const trustInput = buildTrustTxtInput(domain, { ...body, did });
      const validation = validateTrustTxt(trustInput);
      if (!validation.valid) {
        return jsonError(400, validation.errors.join("; "));
      }

      const trustTxt = generateTrustTxt(trustInput);
      const trustTxtHash = hashTrustTxt(trustTxt);

      const existing = await store.get(domain);
      if (existing && !ownerMatches(existing, owner)) {
        return jsonError(403, "Domain is already owned by a different owner");
      }

      const status: HostedTrustTxtStatus = existing
        ? (existing.trustTxtHash === trustTxtHash ? existing.status : "pending")
        : "pending";
      const verifiedAt = status === existing?.status ? existing?.verifiedAt : null;

      const record = await store.upsert({
        domain,
        did,
        config: trustInput,
        trustTxt,
        trustTxtHash,
        ownerType: owner.type,
        ownerId: owner.id,
        status,
        verifiedAt,
        createdAt: existing?.createdAt,
        updatedAt: now().toISOString(),
      });

      return jsonOk(buildResponse(record, trustHost));
    }

    if (path.startsWith("/trust-txt/host/")) {
      const parts = path.split("/").filter(Boolean);
      const domain = parts[2] ? normalizeDomain(parts[2]) : "";
      if (!isValidDomain(domain)) {
        return jsonError(400, "Invalid domain format");
      }

      const owner = extractOwner(req);
      if (!owner) {
        return jsonError(401, "Missing authentication context");
      }

      if (parts.length === 3 && req.method === "GET") {
        const record = await store.get(domain);
        if (!record) {
          return jsonError(404, "Hosted trust.txt not found");
        }
        if (!ownerMatches(record, owner)) {
          return jsonError(403, "Domain is already owned by a different owner");
        }
        return jsonOk(buildResponse(record, trustHost));
      }

      if (parts.length === 4 && parts[3] === "verify" && req.method === "POST") {
        const record = await store.get(domain);
        if (!record) {
          return jsonError(404, "Hosted trust.txt not found");
        }
        if (!ownerMatches(record, owner)) {
          return jsonError(403, "Domain is already owned by a different owner");
        }

        const resolution = await doResolveTrustTxt(domain);
        const expectedUrl = buildHostedUrl(trustHost, domain);

        if (!resolution.trustTxt || resolution.url !== expectedUrl) {
          const reason = resolution.error || "trust.txt is not delegated to Corsair host";
          return jsonError(400, reason);
        }

        if (resolution.delegated?.hashValid === false) {
          return jsonError(400, "Delegated trust.txt hash pin mismatch");
        }

        const updated = await store.upsert({
          ...record,
          status: "active",
          verifiedAt: now().toISOString(),
          updatedAt: now().toISOString(),
        });

        const response: HostedTrustTxtVerifyResponse = {
          domain,
          status: updated.status,
          verifiedAt: updated.verifiedAt,
          resolution: {
            source: resolution.source,
            url: resolution.url,
            delegated: resolution.delegated,
          },
        };

        return jsonOk(response);
      }
    }

    return jsonError(404, "Not found");
  };
}

export function createHostedTrustTxtPublicHandler(
  deps: { store: HostedTrustTxtStore },
): (req: Request) => Promise<Response> {
  const { store } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(req.url);
    const match = url.pathname.match(/^\/trust\/([^/]+)\/trust\.txt$/);
    if (!match) {
      return new Response("Not found", { status: 404 });
    }

    const domain = normalizeDomain(match[1]);
    if (!isValidDomain(domain)) {
      return new Response("Invalid domain", { status: 400 });
    }

    const record = await store.get(domain);
    if (!record) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(record.trustTxt, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*",
        "x-corsair-trust-status": record.status,
      },
    });
  };
}

export const __testUtils = {
  buildHostedUrl,
  buildDnsRecords,
  normalizeDomain,
  isValidDomain,
  createMemoryHostedTrustTxtStore,
};
