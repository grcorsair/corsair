import * as crypto from "crypto";
import { decodeJwt } from "jose";
import { validatePublicUrl } from "../security/url-validation";
import { verifyVCJWTViaDID } from "./vc-verifier";
import type { DependencyProof } from "./vc-types";

export interface DependencyParseResult {
  dependencies: DependencyProof[];
  errors: string[];
}

export interface DependencyVerificationResult {
  dependency: DependencyProof;
  ok: boolean;
  reason?: string;
  digestMatch?: boolean;
  signatureValid?: boolean;
  resolved?: {
    issuer?: string;
    scope?: string;
    frameworks?: string[];
    issuedAt?: string;
    expiresAt?: string;
    marqueId?: string;
  };
  children?: DependencyVerificationResult[];
}

export interface DependencyVerifyOptions {
  depth?: number;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function buildDependencyProof(jwt: string, options?: { cpoeUrl?: string }): DependencyProof {
  const payload = decodeJwt(jwt) as Record<string, unknown>;
  const vc = payload.vc as Record<string, unknown> | undefined;
  const cs = vc?.credentialSubject as Record<string, unknown> | undefined;

  const frameworks = cs?.frameworks
    ? Object.keys(cs.frameworks as Record<string, unknown>)
    : undefined;
  const scope = typeof cs?.scope === "string" ? cs.scope : undefined;
  const issuer = typeof payload.iss === "string" ? payload.iss : "unknown";

  const issuedAt = typeof payload.iat === "number"
    ? new Date(payload.iat * 1000).toISOString()
    : undefined;
  const expiresAt = typeof payload.exp === "number"
    ? new Date(payload.exp * 1000).toISOString()
    : undefined;
  const marqueId = typeof payload.jti === "string"
    ? payload.jti
    : typeof payload.sub === "string"
      ? payload.sub
      : undefined;

  const digest = `sha256:${crypto.createHash("sha256").update(jwt).digest("hex")}`;

  return {
    issuer,
    ...(scope ? { scope } : {}),
    ...(frameworks ? { frameworks } : {}),
    ...(options?.cpoeUrl ? { cpoe: options.cpoeUrl } : {}),
    digest,
    ...(issuedAt ? { issuedAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(marqueId ? { marqueId } : {}),
  };
}

export function parseDependencyProofs(payload: Record<string, unknown>): DependencyParseResult {
  const errors: string[] = [];
  const vc = payload.vc as Record<string, unknown> | undefined;
  const cs = vc?.credentialSubject as Record<string, unknown> | undefined;
  const raw = cs?.dependencies;
  if (!Array.isArray(raw)) {
    return { dependencies: [], errors };
  }

  const dependencies: DependencyProof[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      errors.push("dependency entry must be an object");
      continue;
    }
    const dep = item as Record<string, unknown>;
    const digest = typeof dep.digest === "string" ? dep.digest : null;
    if (!digest) {
      errors.push("dependency missing digest");
      continue;
    }

    dependencies.push({
      issuer: typeof dep.issuer === "string" ? dep.issuer : "unknown",
      ...(typeof dep.scope === "string" ? { scope: dep.scope } : {}),
      ...(Array.isArray(dep.frameworks) ? { frameworks: dep.frameworks.filter(f => typeof f === "string") } : {}),
      ...(typeof dep.cpoe === "string" ? { cpoe: dep.cpoe } : {}),
      digest,
      ...(typeof dep.issuedAt === "string" ? { issuedAt: dep.issuedAt } : {}),
      ...(typeof dep.expiresAt === "string" ? { expiresAt: dep.expiresAt } : {}),
      ...(typeof dep.marqueId === "string" ? { marqueId: dep.marqueId } : {}),
    });
  }

  return { dependencies, errors };
}

export async function verifyDependencyChain(
  dependencies: DependencyProof[],
  options: DependencyVerifyOptions = {},
  visited: Set<string> = new Set(),
): Promise<DependencyVerificationResult[]> {
  const results: DependencyVerificationResult[] = [];
  for (const dep of dependencies) {
    results.push(await verifyDependency(dep, options, visited));
  }
  return results;
}

async function verifyDependency(
  dep: DependencyProof,
  options: DependencyVerifyOptions,
  visited: Set<string>,
): Promise<DependencyVerificationResult> {
  if (!dep.cpoe) {
    return { dependency: dep, ok: false, reason: "missing dependency cpoe url" };
  }

  const normalizedDigest = normalizeDigest(dep.digest);
  const cycleKey = dep.cpoe || normalizedDigest;
  if (visited.has(cycleKey)) {
    return { dependency: dep, ok: false, reason: "dependency cycle detected" };
  }
  visited.add(cycleKey);

  const urlCheck = validatePublicUrl(dep.cpoe);
  if (!urlCheck.valid) {
    return { dependency: dep, ok: false, reason: urlCheck.error || "invalid dependency url" };
  }
  const parsedUrl = new URL(dep.cpoe);
  if (parsedUrl.protocol !== "https:") {
    return { dependency: dep, ok: false, reason: "dependency url must use https" };
  }

  const doFetch = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let jwt: string;
  try {
    const res = await doFetch(dep.cpoe, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
    });
    if (!res.ok) {
      return { dependency: dep, ok: false, reason: `fetch failed (${res.status})` };
    }
    const body = await res.text();
    const extracted = extractJwtFromContent(body);
    if (!extracted) {
      return { dependency: dep, ok: false, reason: "dependency did not return a JWT" };
    }
    jwt = extracted;
  } catch (err) {
    return {
      dependency: dep,
      ok: false,
      reason: err instanceof Error ? err.message : "fetch failed",
    };
  }

  const verification = await verifyVCJWTViaDID(jwt, options.fetchFn);
  const signatureValid = verification.valid;

  const digest = normalizeDigest(
    `sha256:${crypto.createHash("sha256").update(jwt).digest("hex")}`,
  );
  const digestMatch = digest === normalizedDigest;

  const payload = decodeJwt(jwt) as Record<string, unknown>;
  const vc = payload.vc as Record<string, unknown> | undefined;
  const cs = vc?.credentialSubject as Record<string, unknown> | undefined;
  const frameworks = cs?.frameworks
    ? Object.keys(cs.frameworks as Record<string, unknown>)
    : undefined;

  const resolved = {
    issuer: typeof payload.iss === "string" ? payload.iss : undefined,
    scope: typeof cs?.scope === "string" ? cs.scope : undefined,
    frameworks,
    issuedAt: typeof payload.iat === "number" ? new Date(payload.iat * 1000).toISOString() : undefined,
    expiresAt: typeof payload.exp === "number" ? new Date(payload.exp * 1000).toISOString() : undefined,
    marqueId: typeof payload.jti === "string"
      ? payload.jti
      : typeof payload.sub === "string"
        ? payload.sub
        : undefined,
  };

  let children: DependencyVerificationResult[] | undefined;
  if ((options.depth ?? 1) > 1) {
    const parsedDeps = parseDependencyProofs(payload);
    if (parsedDeps.dependencies.length > 0) {
      children = await verifyDependencyChain(
        parsedDeps.dependencies,
        { ...options, depth: (options.depth ?? 1) - 1 },
        visited,
      );
    }
  }

  const childOk = !children || children.every((c) => c.ok);
  const ok = signatureValid && digestMatch && childOk;
  let reason: string | undefined;
  if (!signatureValid) {
    reason = verification.reason || "signature invalid";
  } else if (!digestMatch) {
    reason = "dependency digest mismatch";
  } else if (!childOk) {
    reason = "dependency chain failed";
  }

  return {
    dependency: dep,
    ok,
    signatureValid,
    digestMatch,
    ...(reason ? { reason } : {}),
    resolved,
    ...(children ? { children } : {}),
  };
}

function normalizeDigest(digest: string): string {
  if (digest.startsWith("sha256:")) return digest;
  return `sha256:${digest}`;
}

function extractJwtFromContent(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.startsWith("eyJ") && trimmed.split(".").length === 3) {
    return trimmed;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { cpoe?: string; jwt?: string };
      if (parsed.cpoe && typeof parsed.cpoe === "string") return parsed.cpoe;
      if (parsed.jwt && typeof parsed.jwt === "string") return parsed.jwt;
    } catch {
      return null;
    }
  }

  return null;
}
