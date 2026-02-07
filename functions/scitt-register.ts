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
      let body: { statement?: string };
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "Invalid JSON body");
      }

      if (!body.statement || typeof body.statement !== "string") {
        return jsonError(400, "Missing required field: statement");
      }

      const registration = await registry.register(body.statement);
      return jsonOk(registration, 201);
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
