/**
 * Badge SVG Endpoint
 *
 * GET /badge/:marqueId.svg — Returns SVG badge for a specific CPOE
 * GET /badge/did/:domain.svg — Returns badge for latest CPOE by issuer domain
 *
 * Content-Type: image/svg+xml
 * Cache-Control: public, max-age=300 (5 min)
 *
 * On not found, returns a gray "CPOE | Not Found" badge (not a 404).
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CPOEMetadata {
  marqueId: string;
  tier: "verified" | "self-signed" | "expired" | "invalid";
  assuranceLevel?: number;
  controlsTested?: number;
  overallScore?: number;
  jwt: string;
}

export interface BadgeDeps {
  getCPOEById: (marqueId: string) => Promise<CPOEMetadata | null>;
  getLatestByDomain: (domain: string) => Promise<CPOEMetadata | null>;
  generateBadge: (params: BadgeParams) => string;
}

export interface BadgeParams {
  tier: string;
  level?: number;
  controls?: number;
  score?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function svgResponse(svg: string, cacheSeconds = 300): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": `public, max-age=${cacheSeconds}`,
      "access-control-allow-origin": "*",
    },
  });
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

/**
 * Parse badge route from pathname.
 *
 * /badge/<id>.svg         → { type: "id", value: "<id>" }
 * /badge/did/<domain>.svg → { type: "domain", value: "<domain>" }
 */
export function parseBadgeRoute(
  pathname: string,
): { type: "id"; value: string } | { type: "domain"; value: string } | null {
  // Match /badge/did/<domain>.svg first (more specific)
  const domainMatch = pathname.match(/^\/badge\/did\/([^/]+)\.svg$/);
  if (domainMatch) {
    return { type: "domain", value: domainMatch[1] };
  }

  // Match /badge/<id>.svg
  const idMatch = pathname.match(/^\/badge\/([^/]+)\.svg$/);
  if (idMatch) {
    return { type: "id", value: idMatch[1] };
  }

  return null;
}

/**
 * Default badge SVG generator.
 * Returns a shields.io-style flat badge.
 */
export function defaultGenerateBadge(params: BadgeParams): string {
  const { tier, level, score } = params;

  let label = "CPOE";
  let message: string;
  let color: string;

  switch (tier) {
    case "verified":
      message = level !== undefined ? `L${level} Verified` : "Verified";
      if (score !== undefined) message += ` (${score}%)`;
      color = "#2ECC71";
      break;
    case "self-signed":
      message = level !== undefined ? `L${level} Self-Signed` : "Self-Signed";
      if (score !== undefined) message += ` (${score}%)`;
      color = "#F5C542";
      break;
    case "expired":
      message = "Expired";
      color = "#E63946";
      break;
    case "invalid":
      message = "Invalid";
      color = "#E63946";
      break;
    case "not-found":
      message = "Not Found";
      color = "#999999";
      break;
    default:
      message = "Unknown";
      color = "#999999";
  }

  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 7 + 10;
  const totalWidth = labelWidth + messageWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>`;
}

// =============================================================================
// NOT FOUND BADGE
// =============================================================================

function notFoundBadge(generateBadge: BadgeDeps["generateBadge"]): string {
  return generateBadge({ tier: "not-found" });
}

// =============================================================================
// ROUTER
// =============================================================================

/**
 * Create the badge router.
 *
 * Routes:
 *   GET /badge/<marqueId>.svg     — Badge for specific CPOE
 *   GET /badge/did/<domain>.svg   — Badge for latest CPOE by issuer
 */
export function createBadgeRouter(
  deps: BadgeDeps,
): (req: Request) => Promise<Response> {
  const { getCPOEById, getLatestByDomain, generateBadge } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") {
      return jsonError(405, "Method not allowed. Use GET.");
    }

    const url = new URL(req.url);
    const route = parseBadgeRoute(url.pathname);

    if (!route) {
      return jsonError(404, "Not found. Use /badge/<id>.svg or /badge/did/<domain>.svg");
    }

    let cpoe: CPOEMetadata | null = null;

    if (route.type === "id") {
      cpoe = await getCPOEById(route.value);
    } else {
      cpoe = await getLatestByDomain(route.value);
    }

    if (!cpoe) {
      return svgResponse(notFoundBadge(generateBadge));
    }

    const svg = generateBadge({
      tier: cpoe.tier,
      level: cpoe.assuranceLevel,
      controls: cpoe.controlsTested,
      score: cpoe.overallScore,
    });

    return svgResponse(svg);
  };
}
