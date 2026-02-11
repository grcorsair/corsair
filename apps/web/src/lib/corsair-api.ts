/**
 * Corsair API Client — Browser-to-API calls for CPOE verification.
 * Direct fetch to api.grcorsair.com (CORS: *). No proxy needed.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.grcorsair.com";

export interface APIVerifyResponse {
  verified: boolean;
  reason?: string;
  issuer: string | null;
  issuerTier: "corsair-verified" | "self-signed" | "unverifiable" | "invalid" | null;
  assurance: { level: number; name: string | null } | null;
  provenance: { source: string; sourceIdentity?: string; sourceDate?: string } | null;
  scope: string | null;
  summary: { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number } | null;
  timestamps: { issuedAt: string | null; expiresAt: string | null };
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
