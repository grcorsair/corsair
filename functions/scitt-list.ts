/**
 * SCITT List Endpoint
 *
 * GET /scitt/entries — List recent SCITT entries (paginated, no auth)
 * GET /scitt/entries?issuer=did:web:acme.com — Filter by issuer
 * GET /scitt/entries?framework=SOC2 — Filter by framework
 * GET /scitt/entries?limit=20&offset=0 — Pagination
 *
 * Rate limited: 30 req/min per IP. Public, no auth. CORS enabled.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SCITTProvenance {
  source: "self" | "tool" | "auditor" | "unknown";
  sourceIdentity?: string;
}

export interface SCITTListEntry {
  entryId: string;
  registrationTime: string;
  treeSize?: number;
  issuer: string;
  scope: string;
  provenance: SCITTProvenance;
  proofOnly?: boolean;
  summary?: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };
}

export interface SCITTListOptions {
  limit?: number;
  offset?: number;
  issuer?: string;
  framework?: string;
}

export interface SCITTListDeps {
  listEntries: (options: SCITTListOptions) => Promise<SCITTListEntry[]>;
}

export interface SCITTListResponse {
  entries: SCITTListEntry[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

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

/**
 * Parse and clamp a numeric query parameter.
 * Returns defaultValue if absent or non-numeric.
 */
function parseIntParam(value: string | null, defaultValue: number, min: number, max: number): number {
  if (value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

// =============================================================================
// ROUTER
// =============================================================================

/**
 * Create the SCITT list router.
 *
 * Query params:
 *   limit    — Page size (1-100, default 20)
 *   offset   — Skip N entries (default 0)
 *   issuer   — Filter by issuer DID (e.g. did:web:acme.com)
 *   framework — Filter by framework name (e.g. SOC2)
 */
export function createSCITTListRouter(
  deps: SCITTListDeps,
): (req: Request) => Promise<Response> {
  const { listEntries } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") {
      return jsonError(405, "Method not allowed. Use GET.");
    }

    const url = new URL(req.url);
    const { searchParams } = url;

    // Parse pagination params
    const limit = parseIntParam(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = parseIntParam(searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

    // Parse filter params
    const issuer = searchParams.get("issuer") || undefined;
    const framework = searchParams.get("framework") || undefined;

    const entries = await listEntries({ limit, offset, issuer, framework });

    const response: SCITTListResponse = {
      entries,
      pagination: {
        limit,
        offset,
        count: entries.length,
      },
    };

    return jsonOk(response);
  };
}
