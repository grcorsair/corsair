/**
 * SSF Stream Management API
 *
 * CRUD operations for SSF streams per OpenID SSF spec.
 * POST   /ssf/streams          — Create stream
 * GET    /ssf/streams/:id      — Get stream config
 * PATCH  /ssf/streams/:id      — Update stream
 * DELETE /ssf/streams/:id      — Delete stream
 */

import type { SSFStreamManager } from "../src/flagship/ssf-stream";
import type { SSFStreamConfig } from "../src/flagship/flagship-types";

export interface SSFStreamRouterDeps {
  streamManager: SSFStreamManager;
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
 * Extract the stream ID from a URL path like /ssf/streams/:id
 * Returns null if the path doesn't match the expected pattern.
 */
function extractStreamId(pathname: string): string | null {
  const match = pathname.match(/^\/ssf\/streams\/([^/]+)$/);
  return match ? match[1] : null;
}

export function createSSFStreamRouter(
  deps: SSFStreamRouterDeps,
): (req: Request) => Promise<Response> {
  const { streamManager } = deps;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // POST /ssf/streams — Create stream
    if (method === "POST" && pathname === "/ssf/streams") {
      let body: Partial<SSFStreamConfig>;
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "Invalid JSON body");
      }

      if (!body.delivery || !body.events_requested || !body.format) {
        return jsonError(
          400,
          "Missing required fields: delivery, events_requested, format",
        );
      }

      const stream = streamManager.createStream(body as SSFStreamConfig);
      return jsonOk(stream, 201);
    }

    // Routes with stream ID
    const streamId = extractStreamId(pathname);

    if (streamId) {
      // GET /ssf/streams/:id — Get stream
      if (method === "GET") {
        const stream = streamManager.getStream(streamId);
        if (!stream) {
          return jsonError(404, `Stream not found: ${streamId}`);
        }
        return jsonOk(stream);
      }

      // PATCH /ssf/streams/:id — Update stream
      if (method === "PATCH") {
        let body: Partial<SSFStreamConfig>;
        try {
          body = await req.json();
        } catch {
          return jsonError(400, "Invalid JSON body");
        }

        try {
          const stream = streamManager.updateStream(streamId, body);
          return jsonOk(stream);
        } catch {
          return jsonError(404, `Stream not found: ${streamId}`);
        }
      }

      // DELETE /ssf/streams/:id — Delete stream
      if (method === "DELETE") {
        try {
          streamManager.deleteStream(streamId);
          return jsonOk({ status: "deleted", streamId });
        } catch {
          return jsonError(404, `Stream not found: ${streamId}`);
        }
      }
    }

    return jsonError(404, "Not found");
  };
}
