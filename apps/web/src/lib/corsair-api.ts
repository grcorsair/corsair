/**
 * Corsair API Client — Browser-to-API calls for CPOE operations.
 * Direct fetch to api.grcorsair.com (CORS: *). No proxy needed.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.grcorsair.com";

export interface APIVerifyResponse {
  verified: boolean;
  reason?: string;
  issuer: string | null;
  issuerTier: "corsair-verified" | "self-signed" | "unverifiable" | "invalid" | null;
  provenance: { source: string; sourceIdentity?: string; sourceDate?: string } | null;
  scope: string | null;
  summary: { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number } | null;
  timestamps: { issuedAt: string | null; expiresAt: string | null };
  processProvenance?: {
    chainDigest: string;
    receiptCount: number;
    chainVerified: boolean;
    format: string;
    reproducibleSteps: number;
    attestedSteps: number;
    toolAttestedSteps?: number;
    scittEntryIds?: string[];
  } | null;
  inputBinding?: { ok: boolean; errors: string[]; expected?: string; actual?: string } | null;
  extensions?: Record<string, unknown> | null;
}

export type APIVerifyResult =
  | { ok: true; data: APIVerifyResponse }
  | { ok: false; error: { type: "network" | "timeout" | "server"; message: string } };

/**
 * Verify a CPOE via the Corsair API.
 * POST /verify with { cpoe: jwt }. 10s timeout. Never throws.
 */
export async function verifyViaAPI(cpoe: string): Promise<APIVerifyResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpoe }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return {
        ok: false,
        error: { type: "server", message: body.error || `HTTP ${res.status}` },
      };
    }

    const data: APIVerifyResponse = await res.json();
    return { ok: true, data };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: { type: "timeout", message: "Verification timed out (10s)" } };
    }
    return {
      ok: false,
      error: { type: "network", message: "Could not reach verification API" },
    };
  }
}

// =============================================================================
// SIGN API
// =============================================================================

export interface APISignRequest {
  evidence: unknown;
  format?: string;
  did?: string;
  scope?: string;
  expiryDays?: number;
  strict?: boolean;
  enrich?: boolean;
  dryRun?: boolean;
}

export interface APISignResponse {
  cpoe: string;
  marqueId: string;
  detectedFormat: string;
  summary: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };
  provenance: {
    source: string;
    sourceIdentity?: string;
    sourceDate?: string;
  };
  warnings: string[];
  extensions?: Record<string, unknown>;
  expiresAt?: string;
  demo?: boolean;
}

export type APISignResult =
  | { ok: true; data: APISignResponse }
  | { ok: false; error: { type: "network" | "timeout" | "server"; message: string } };

/**
 * Sign evidence via the Corsair API.
 * POST /sign with evidence + options. 15s timeout. Never throws.
 * Pass an API key or OIDC token as the Bearer auth value.
 */
export async function signViaAPI(request: APISignRequest, apiKey?: string): Promise<APISignResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const res = await fetch(`${API_BASE}/sign`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return {
        ok: false,
        error: { type: "server", message: body.error || `HTTP ${res.status}` },
      };
    }

    const data: APISignResponse = await res.json();
    return { ok: true, data };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: { type: "timeout", message: "Signing timed out (15s)" } };
    }
    return {
      ok: false,
      error: { type: "network", message: "Could not reach signing API" },
    };
  }
}

/**
 * Demo sign via the Corsair API.
 * POST /sign/demo with evidence + options. 10s timeout. Never throws.
 */
export async function signDemoViaAPI(request: APISignRequest): Promise<APISignResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE}/sign/demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return {
        ok: false,
        error: { type: "server", message: body.error || `HTTP ${res.status}` },
      };
    }

    const data: APISignResponse = await res.json();
    return { ok: true, data };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: { type: "timeout", message: "Demo signing timed out (10s)" } };
    }
    return {
      ok: false,
      error: { type: "network", message: "Could not reach demo signing API" },
    };
  }
}

// =============================================================================
// HOSTED TRUST.TXT API
// =============================================================================

export interface APIHostedTrustTxtRequest {
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

export interface APIHostedTrustTxtResponse {
  domain: string;
  did: string;
  status: "pending" | "active" | "revoked";
  trustTxt: { content: string; hash: string; expires?: string };
  urls: { hosted: string };
  dns: { txt: string; hashTxt: string };
  verifiedAt?: string | null;
}

export interface APIHostedTrustTxtVerifyResponse {
  domain: string;
  status: "pending" | "active" | "revoked";
  verifiedAt?: string | null;
}

export type APIHostedTrustTxtResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { type: "network" | "timeout" | "server"; message: string } };

async function apiPost<T>(path: string, body: unknown, token: string): Promise<APIHostedTrustTxtResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      return {
        ok: false,
        error: { type: "server", message: data.error || `HTTP ${res.status}` },
      };
    }

    return { ok: true, data: await res.json() as T };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: { type: "timeout", message: "Request timed out (15s)" } };
    }
    return { ok: false, error: { type: "network", message: "Could not reach API" } };
  }
}

async function apiGet<T>(path: string, token: string): Promise<APIHostedTrustTxtResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      return {
        ok: false,
        error: { type: "server", message: data.error || `HTTP ${res.status}` },
      };
    }

    return { ok: true, data: await res.json() as T };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: { type: "timeout", message: "Request timed out (15s)" } };
    }
    return { ok: false, error: { type: "network", message: "Could not reach API" } };
  }
}

export async function hostTrustTxtViaAPI(
  request: APIHostedTrustTxtRequest,
  token: string,
): Promise<APIHostedTrustTxtResult<APIHostedTrustTxtResponse>> {
  return apiPost<APIHostedTrustTxtResponse>("/trust-txt/host", request, token);
}

export async function getHostedTrustTxtViaAPI(
  domain: string,
  token: string,
): Promise<APIHostedTrustTxtResult<APIHostedTrustTxtResponse>> {
  return apiGet<APIHostedTrustTxtResponse>(`/trust-txt/host/${domain}`, token);
}

export async function verifyHostedTrustTxtViaAPI(
  domain: string,
  token: string,
): Promise<APIHostedTrustTxtResult<APIHostedTrustTxtVerifyResponse>> {
  return apiPost<APIHostedTrustTxtVerifyResponse>(`/trust-txt/host/${domain}/verify`, {}, token);
}
