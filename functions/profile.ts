/**
 * Vendor Profile Endpoint
 *
 * GET /profile/:domain — Returns issuer profile as JSON
 * Domain maps to did:web:<domain>
 *
 * Public, no auth, cached 1 hour.
 * Cache-Control: public, max-age=3600
 */

// =============================================================================
// TYPES
// =============================================================================

export interface IssuerProfile {
  did: string;
  domain: string;
  displayName?: string;
  cpoeCount: number;
  latestCPOE?: {
    marqueId: string;
    scope: string;
    assuranceLevel?: number;
    overallScore?: number;
    issuedAt: string;
    expiresAt?: string;
  };
  frameworks: string[];
  firstSeen: string;
  lastSeen: string;
}

export interface ProfileDeps {
  getIssuerProfile: (issuerDID: string) => Promise<IssuerProfile | null>;
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

function jsonOk(data: unknown, status = 200, cacheSeconds = 3600): Response {
  return Response.json(data, {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": `public, max-age=${cacheSeconds}`,
    },
  });
}

/**
 * Parse profile route from pathname.
 *
 * /profile/<domain> → domain string
 */
export function parseProfileRoute(pathname: string): string | null {
  const match = pathname.match(/^\/profile\/([^/]+)$/);
  return match ? match[1] : null;
}

/**
 * Validate a domain string for basic correctness.
 * Rejects empty, overly long, or obviously invalid domains.
 */
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  // Basic domain format: alphanumeric + hyphens + dots
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(domain);
}

// =============================================================================
// ROUTER
// =============================================================================

/**
 * Create the profile router.
 *
 * Routes:
 *   GET /profile/<domain> — Issuer profile by domain
 */
export function createProfileRouter(
  deps: ProfileDeps,
): (req: Request) => Promise<Response> {
  const { getIssuerProfile } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") {
      return jsonError(405, "Method not allowed. Use GET.");
    }

    const url = new URL(req.url);
    const domain = parseProfileRoute(url.pathname);

    if (!domain) {
      return jsonError(404, "Not found. Use /profile/<domain>");
    }

    if (!isValidDomain(domain)) {
      return jsonError(400, "Invalid domain format");
    }

    const issuerDID = `did:web:${domain}`;
    const profile = await getIssuerProfile(issuerDID);

    if (!profile) {
      return jsonError(404, "No CPOEs found for this issuer");
    }

    return jsonOk(profile);
  };
}
