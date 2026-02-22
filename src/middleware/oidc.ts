/**
 * OIDC Verification Helpers
 *
 * Validates OIDC JWTs against issuer discovery + JWKS.
 * Designed for server-side keyless signing auth.
 */

import { createHash } from "crypto";
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose";

// =============================================================================
// TYPES
// =============================================================================

export interface OIDCClaimMapping {
  subject?: string;
  email?: string;
  name?: string;
  organization?: string;
  username?: string;
}

export interface OIDCProviderConfig {
  /** Issuer URL (exact match with token `iss`) */
  issuer: string;
  /** Optional discovery URL override */
  discoveryUrl?: string;
  /** Optional JWKS URL override (skips discovery) */
  jwksUri?: string;
  /** Allowed audiences */
  audiences: string[];
  /** Optional subject claim (default: "sub") */
  subjectClaim?: string;
  /** Optional issuer-specific claim mapping (canonical fields) */
  claimMapping?: OIDCClaimMapping;
  /** Optional clock skew tolerance in seconds (default: 60) */
  clockSkewSeconds?: number;
  /** Require a jti claim (default: false) */
  requireJti?: boolean;
}

export interface OIDCVerificationResult {
  issuer: string;
  subject: string;
  subjectHash: string;
  audience: string[];
  tokenHash: string;
  verifiedAt: string;
  identity?: Record<string, string>;
  claims: Record<string, unknown>;
}

// =============================================================================
// CONFIG
// =============================================================================

let configCache: { raw: string; providers: OIDCProviderConfig[] } | null = null;

function normalizeClaimMapping(input: unknown): OIDCClaimMapping | undefined {
  if (!input || typeof input !== "object") return undefined;
  const mapping = input as Record<string, unknown>;
  const result: OIDCClaimMapping = {};
  if (typeof mapping.subject === "string") result.subject = mapping.subject;
  if (typeof mapping.email === "string") result.email = mapping.email;
  if (typeof mapping.name === "string") result.name = mapping.name;
  if (typeof mapping.organization === "string") result.organization = mapping.organization;
  if (typeof mapping.username === "string") result.username = mapping.username;
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseProviders(raw: string): OIDCProviderConfig[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const providers = Array.isArray(parsed)
    ? parsed
    : (parsed as { providers?: unknown }).providers;

  if (!Array.isArray(providers)) return [];

  const result: OIDCProviderConfig[] = [];
  for (const entry of providers) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as OIDCProviderConfig;
    if (!candidate.issuer || typeof candidate.issuer !== "string") continue;
    if (!Array.isArray(candidate.audiences) || candidate.audiences.length === 0) continue;
    const claimMapping = normalizeClaimMapping((candidate as { claimMapping?: unknown }).claimMapping);
    result.push({
      issuer: candidate.issuer,
      discoveryUrl: candidate.discoveryUrl,
      jwksUri: candidate.jwksUri,
      audiences: candidate.audiences,
      subjectClaim: typeof candidate.subjectClaim === "string" ? candidate.subjectClaim : undefined,
      claimMapping,
      clockSkewSeconds: typeof candidate.clockSkewSeconds === "number" ? candidate.clockSkewSeconds : undefined,
      requireJti: candidate.requireJti === true,
    });
  }

  return result;
}

function loadOIDCProviders(): OIDCProviderConfig[] {
  const raw = (Bun.env.CORSAIR_OIDC_CONFIG || "").trim();
  if (configCache && configCache.raw === raw) return configCache.providers;
  const providers = parseProviders(raw);
  configCache = { raw, providers };
  return providers;
}

export function getOIDCProviders(): OIDCProviderConfig[] {
  return loadOIDCProviders();
}

export function resetOIDCCacheForTests(): void {
  configCache = null;
  discoveryCache.clear();
  jwksCache.clear();
}

// =============================================================================
// CACHES
// =============================================================================

const discoveryCache = new Map<string, { jwksUri: string; expiresAt: number }>();
const jwksCache = new Map<string, { keys: JsonWebKey[]; expiresAt: number }>();

const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCacheExpiry(headers: Headers): number {
  const cacheControl = headers.get("cache-control") || "";
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (match) {
    const seconds = parseInt(match[1], 10);
    if (!Number.isNaN(seconds)) return Date.now() + seconds * 1000;
  }
  return Date.now() + DEFAULT_CACHE_TTL_MS;
}

function normalizeIssuer(issuer: string): string {
  return issuer.endsWith("/") ? issuer.slice(0, -1) : issuer;
}

function normalizeAudience(aud: unknown): string[] {
  if (typeof aud === "string") return [aud];
  if (Array.isArray(aud)) {
    return aud.filter((a) => typeof a === "string") as string[];
  }
  return [];
}

function hashToken(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function extractMappedClaims(
  payload: Record<string, unknown>,
  provider: OIDCProviderConfig,
): Record<string, string> | undefined {
  const mapping = provider.claimMapping;
  if (!mapping) return undefined;
  const result: Record<string, string> = {};
  const setIfString = (field: keyof OIDCClaimMapping) => {
    const claimName = mapping[field];
    if (!claimName) return;
    const value = payload[claimName];
    if (typeof value === "string" && value.trim()) {
      result[field] = value.trim();
    }
  };
  setIfString("subject");
  setIfString("email");
  setIfString("name");
  setIfString("organization");
  setIfString("username");
  return Object.keys(result).length > 0 ? result : undefined;
}

async function fetchJSON(url: string, fetchFn: typeof fetch): Promise<{ data: any; expiresAt: number }> {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new Error(`OIDC fetch failed: ${url} (${res.status})`);
  }
  const expiresAt = getCacheExpiry(res.headers);
  return { data: await res.json(), expiresAt };
}

async function resolveJWKSUri(
  provider: OIDCProviderConfig,
  fetchFn: typeof fetch,
): Promise<string> {
  if (provider.jwksUri) return provider.jwksUri;

  const issuer = normalizeIssuer(provider.issuer);
  const cached = discoveryCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.jwksUri;

  const discoveryUrl = provider.discoveryUrl || `${issuer}/.well-known/openid-configuration`;
  const { data, expiresAt } = await fetchJSON(discoveryUrl, fetchFn);
  const jwksUri = data?.jwks_uri;
  if (!jwksUri || typeof jwksUri !== "string") {
    throw new Error("OIDC discovery missing jwks_uri");
  }

  discoveryCache.set(issuer, { jwksUri, expiresAt });
  return jwksUri;
}

async function resolveJWKS(
  issuer: string,
  jwksUri: string,
  fetchFn: typeof fetch,
): Promise<JsonWebKey[]> {
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const { data, expiresAt } = await fetchJSON(jwksUri, fetchFn);
  const keys = Array.isArray(data?.keys) ? data.keys as JsonWebKey[] : [];
  jwksCache.set(issuer, { keys, expiresAt });
  return keys;
}

// =============================================================================
// VERIFICATION
// =============================================================================

function isOIDCEnabled(): boolean {
  return loadOIDCProviders().length > 0;
}

export async function verifyOIDCToken(
  token: string,
  options?: { fetchFn?: typeof fetch },
): Promise<OIDCVerificationResult | null> {
  if (!isOIDCEnabled()) return null;

  let payload: Record<string, unknown>;
  let header: { kid?: string; alg?: string };
  try {
    payload = decodeJwt(token) as Record<string, unknown>;
    header = decodeProtectedHeader(token) as { kid?: string; alg?: string };
  } catch {
    return null;
  }

  const issuerRaw = payload.iss;
  if (typeof issuerRaw !== "string") return null;

  const issuer = normalizeIssuer(issuerRaw);
  const providers = loadOIDCProviders();
  const provider = providers.find((p) => normalizeIssuer(p.issuer) === issuer);
  if (!provider) return null;

  const fetchFn = options?.fetchFn || globalThis.fetch;
  if (!fetchFn) return null;

  let jwksUri: string;
  let keys: JsonWebKey[];
  try {
    jwksUri = await resolveJWKSUri(provider, fetchFn);
    keys = await resolveJWKS(issuer, jwksUri, fetchFn);
  } catch {
    return null;
  }

  const kid = header.kid;
  const jwk = kid
    ? keys.find((k) => k.kid === kid)
    : keys[0];
  if (!jwk) return null;

  const key = await importJWK(jwk, header.alg || "EdDSA");

  let verified;
  try {
    verified = await jwtVerify(token, key, {
      issuer: issuerRaw,
      audience: provider.audiences,
      clockTolerance: provider.clockSkewSeconds ?? 60,
    });
  } catch {
    return null;
  }

  const subjectClaim = provider.claimMapping?.subject || provider.subjectClaim || "sub";
  const subject = verified.payload[subjectClaim];
  if (typeof subject !== "string" || !subject.trim()) return null;

  const iat = verified.payload.iat;
  if (typeof iat !== "number") return null;
  const skew = provider.clockSkewSeconds ?? 60;
  const now = Math.floor(Date.now() / 1000);
  if (iat > now + skew) return null;

  if (provider.requireJti) {
    const jti = verified.payload.jti;
    if (typeof jti !== "string" || !jti.trim()) return null;
  }

  const audience = normalizeAudience(verified.payload.aud);
  const verifiedAt = new Date().toISOString();
  const tokenHash = hashToken(token);
  const subjectHash = hashToken(`${provider.issuer}|${subject}`);
  const identity = extractMappedClaims(verified.payload as Record<string, unknown>, provider);

  return {
    issuer: provider.issuer,
    subject,
    subjectHash,
    audience,
    tokenHash,
    verifiedAt,
    identity,
    claims: verified.payload as Record<string, unknown>,
  };
}
