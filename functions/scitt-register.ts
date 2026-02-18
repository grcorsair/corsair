/**
 * SCITT Registration API
 *
 * Register signed statements and retrieve entries/receipts.
 * POST /scitt/entries           — Register signed statement
 * GET  /scitt/entries/:id       — Get entry metadata
 * GET  /scitt/entries/:id/receipt — Get COSE receipt
 */

import type { SCITTRegistry } from "../src/parley/scitt-types";

export interface SCITTRouterDeps {
  registry: SCITTRegistry;
}

function jsonError(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: { "content-type": "application/json" } },
  );
}

function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "content-type": "application/json" },
  });
}

const MAX_STATEMENT_SIZE = 50_000; // 50KB — typical CPOE is 2-5KB
const BASE64URL_REGEX = /^[A-Za-z0-9_-]*$/;

/**
 * Validate that a statement is a well-formed JWT before registering in SCITT.
 * Returns an error message string if invalid, or null if valid.
 */
function validateStatement(statement: string): string | null {
  if (statement.length > MAX_STATEMENT_SIZE) {
    return `Statement exceeds maximum size (${MAX_STATEMENT_SIZE} bytes)`;
  }

  const parts = statement.split(".");
  if (parts.length !== 3) {
    return "Statement must be a JWT (3 dot-separated segments: header.payload.signature)";
  }

  // Validate header is valid base64url and decodable
  const [header] = parts;
  if (!header || !BASE64URL_REGEX.test(header)) {
    return "JWT header is not valid base64url";
  }

  try {
    const decoded = atob(header.replace(/-/g, "+").replace(/_/g, "/"));
    JSON.parse(decoded);
  } catch {
    return "JWT header is not valid JSON";
  }

  return null;
}

/**
 * Match SCITT entry routes:
 *   /scitt/entries/:id         → { entryId, receipt: false }
 *   /scitt/entries/:id/receipt → { entryId, receipt: true }
 */
function matchSCITTRoute(
  pathname: string,
): { entryId: string; receipt: boolean } | null {
  const receiptMatch = pathname.match(/^\/scitt\/entries\/([^/]+)\/receipt$/);
  if (receiptMatch) {
    return { entryId: receiptMatch[1], receipt: true };
  }

  const entryMatch = pathname.match(/^\/scitt\/entries\/([^/]+)$/);
  if (entryMatch) {
    return { entryId: entryMatch[1], receipt: false };
  }

  return null;
}

export function createSCITTRouter(
  deps: SCITTRouterDeps,
): (req: Request) => Promise<Response> {
  const { registry } = deps;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // POST /scitt/entries — Register statement
    if (method === "POST" && pathname === "/scitt/entries") {
      let body: { statement?: string; proofOnly?: boolean };
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "Invalid JSON body");
      }

      if (!body.statement || typeof body.statement !== "string") {
        return jsonError(400, "Missing required field: statement");
      }
      if (body.proofOnly !== undefined && typeof body.proofOnly !== "boolean") {
        return jsonError(400, "proofOnly must be a boolean");
      }

      // Validate statement is a well-formed JWT (3 base64url-separated parts)
      const statementError = validateStatement(body.statement);
      if (statementError) {
        return jsonError(400, statementError);
      }

      const registration = await registry.register(body.statement, { proofOnly: body.proofOnly });
      return jsonOk({ ...registration, proofOnly: Boolean(body.proofOnly) }, 201);
    }

    // GET routes with entry ID
    if (method === "GET") {
      const match = matchSCITTRoute(pathname);
      if (match) {
        if (match.receipt) {
          // GET /scitt/entries/:id/receipt
          const receipt = await registry.getReceipt(match.entryId);
          if (!receipt) {
            return jsonError(404, `Entry not found: ${match.entryId}`);
          }
          return jsonOk(receipt);
        } else {
          // GET /scitt/entries/:id — return receipt as metadata
          const receipt = await registry.getReceipt(match.entryId);
          if (!receipt) {
            return jsonError(404, `Entry not found: ${match.entryId}`);
          }
          return jsonOk(receipt);
        }
      }
    }

    return jsonError(404, "Not found");
  };
}
