/**
 * Authentication Middleware
 *
 * Bearer token validation for protected endpoints.
 * Accepts API keys from CORSAIR_API_KEYS or OIDC tokens when configured.
 *
 * Usage:
 *   const protectedHandler = requireAuth(originalHandler);
 */

import { verifyOIDCToken } from "./oidc";

let cachedKeys: Set<string> | null = null;

export type CorsairAuthContext =
  | { type: "api_key"; key: string }
  | { type: "oidc"; oidc: import("./oidc").OIDCVerificationResult };

function loadApiKeys(): Set<string> {
  if (cachedKeys) return cachedKeys;
  const raw = Bun.env.CORSAIR_API_KEYS || "";
  const keys = raw.split(",").map((k) => k.trim()).filter((k) => k.length > 0);
  cachedKeys = new Set(keys);
  return cachedKeys;
}

/** Invalidate cached API keys (for testing or key rotation) */
export function invalidateApiKeyCache(): void {
  cachedKeys = null;
}

/**
 * Wrap a request handler with Bearer token authentication.
 * Returns 401 for missing auth, 403 for invalid tokens.
 * CORS preflight (OPTIONS) passes through without auth.
 */
export function requireAuth(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Response | Promise<Response> {
  return async (req: Request) => {
    // Allow CORS preflight through without auth
    if (req.method === "OPTIONS") return handler(req);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { error: "Missing or invalid Authorization header. Use: Bearer <api-key or oidc-token>" },
        {
          status: 401,
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          },
        },
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const apiKeys = loadApiKeys();
    if (apiKeys.has(token)) {
      (req as Request & { corsairAuth?: CorsairAuthContext }).corsairAuth = { type: "api_key", key: token };
      return handler(req);
    }

    // Fallback: OIDC token verification (if configured)
    const oidc = await verifyOIDCToken(token);
    if (oidc) {
      const reqWithAuth = req as Request & {
        corsairAuth?: CorsairAuthContext;
        corsairRateLimitKey?: string;
      };
      reqWithAuth.corsairAuth = { type: "oidc", oidc };
      reqWithAuth.corsairRateLimitKey = `oidc:${oidc.subjectHash}`;
      return handler(req);
    }

    return Response.json(
      { error: "Invalid API key or OIDC token" },
      {
        status: 403,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      },
    );
  };
}
