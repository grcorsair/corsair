/**
 * API Key Authentication Middleware
 *
 * Bearer token validation for protected endpoints.
 * Reads allowed keys from CORSAIR_API_KEYS environment variable
 * (comma-separated list).
 *
 * Usage:
 *   const protectedHandler = requireAuth(originalHandler);
 */

function loadApiKeys(): Set<string> {
  const raw = Bun.env.CORSAIR_API_KEYS || "";
  const keys = raw.split(",").map((k) => k.trim()).filter((k) => k.length > 0);
  return new Set(keys);
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

    const apiKeys = loadApiKeys();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { error: "Missing or invalid Authorization header. Use: Bearer <api-key>" },
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
    if (!apiKeys.has(token)) {
      return Response.json(
        { error: "Invalid API key" },
        {
          status: 403,
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          },
        },
      );
    }

    return handler(req);
  };
}
