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
import { validatePublicUrl } from "../src/security/url-validation";
import type { EventJournalWriter } from "../src/intelligence/event-journal";
import { writeEventBestEffort } from "../src/intelligence/event-journal";
import { getRequestActor, getSSFStreamOwner } from "../src/intelligence/request-context";

export interface SSFStreamRouterDeps {
  streamManager: SSFStreamManager;
  eventJournal?: EventJournalWriter;
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

function normalizePath(pathname: string): string {
  if (pathname.startsWith("/v1/")) {
    return pathname.slice(3);
  }
  return pathname;
}

export function createSSFStreamRouter(
  deps: SSFStreamRouterDeps,
): (req: Request) => Promise<Response> {
  const { streamManager, eventJournal } = deps;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const pathname = normalizePath(url.pathname);
    const method = req.method;
    const actor = getRequestActor(req);
    const owner = getSSFStreamOwner(req);

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

      // SSRF protection: validate endpoint_url for push delivery
      if (body.delivery.method === "push" && body.delivery.endpoint_url) {
        const urlCheck = validatePublicUrl(body.delivery.endpoint_url);
        if (!urlCheck.valid) {
          return jsonError(400, `Invalid endpoint_url: ${urlCheck.error}`);
        }
      }

      const stream = await streamManager.createStream(body as SSFStreamConfig, owner);
      await writeEventBestEffort(eventJournal, {
        eventType: "ssf.stream.created",
        actorType: actor.actorType,
        actorIdHash: actor.actorIdHash,
        targetType: "ssf_stream",
        targetId: stream.streamId,
        requestMethod: method,
        requestPath: pathname,
        metadata: {
          deliveryMethod: stream.config.delivery.method,
          eventsRequested: stream.config.events_requested.length,
          format: stream.config.format,
        },
      });
      return jsonOk(stream, 201);
    }

    // Routes with stream ID
    const streamId = extractStreamId(pathname);

    if (streamId) {
      // GET /ssf/streams/:id — Get stream
      if (method === "GET") {
        const stream = await streamManager.getStream(streamId, owner);
        if (!stream) {
          return jsonError(404, `Stream not found: ${streamId}`);
        }
        await writeEventBestEffort(eventJournal, {
          eventType: "ssf.stream.read",
          actorType: actor.actorType,
          actorIdHash: actor.actorIdHash,
          targetType: "ssf_stream",
          targetId: streamId,
          requestMethod: method,
          requestPath: pathname,
        });
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

        // SSRF protection: validate endpoint_url if being updated
        if (body.delivery?.endpoint_url) {
          const urlCheck = validatePublicUrl(body.delivery.endpoint_url);
          if (!urlCheck.valid) {
            return jsonError(400, `Invalid endpoint_url: ${urlCheck.error}`);
          }
        }

        try {
          const stream = await streamManager.updateStream(streamId, body, owner);
          await writeEventBestEffort(eventJournal, {
            eventType: "ssf.stream.updated",
            actorType: actor.actorType,
            actorIdHash: actor.actorIdHash,
            targetType: "ssf_stream",
            targetId: streamId,
            requestMethod: method,
            requestPath: pathname,
            metadata: {
              updatedFields: Object.keys(body),
            },
          });
          return jsonOk(stream);
        } catch {
          return jsonError(404, `Stream not found: ${streamId}`);
        }
      }

      // DELETE /ssf/streams/:id — Delete stream
      if (method === "DELETE") {
        try {
          await streamManager.deleteStream(streamId, owner);
          await writeEventBestEffort(eventJournal, {
            eventType: "ssf.stream.deleted",
            actorType: actor.actorType,
            actorIdHash: actor.actorIdHash,
            targetType: "ssf_stream",
            targetId: streamId,
            requestMethod: method,
            requestPath: pathname,
          });
          return jsonOk({ status: "deleted", streamId });
        } catch {
          return jsonError(404, `Stream not found: ${streamId}`);
        }
      }
    }

    return jsonError(404, "Not found");
  };
}
