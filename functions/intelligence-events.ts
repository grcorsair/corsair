/**
 * Intelligence Events Read API
 *
 * GET /intelligence/events — Authenticated event_journal query surface.
 * GET /v1/intelligence/events — Versioned alias.
 */

import { getRequestActor } from "../src/intelligence/request-context";

export interface IntelligenceEvent {
  eventId: string;
  eventType: string;
  eventVersion: number;
  status: "success" | "failure";
  occurredAt: string;
  actorType: "api_key" | "oidc" | "anonymous" | "legacy";
  targetType?: string;
  targetId?: string;
  requestPath?: string;
  requestMethod?: string;
  requestId?: string;
  idempotencyKey?: string;
  metadata: Record<string, unknown>;
}

export interface IntelligenceEventsResponse {
  events: IntelligenceEvent[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
  filters: {
    eventType?: string;
    status?: "success" | "failure";
    targetType?: string;
    targetId?: string;
    since?: string;
    until?: string;
  };
  scope: {
    actorType: "api_key" | "oidc";
  };
}

interface IntelligenceDb {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

export interface IntelligenceEventsRouterDeps {
  db: IntelligenceDb;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

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

function jsonOk(data: unknown): Response {
  return Response.json(data, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

function normalizePath(pathname: string): string {
  if (pathname.startsWith("/v1/")) {
    return pathname.slice(3);
  }
  return pathname;
}

function parseIntParam(value: string | null, defaultValue: number, min: number, max: number): number {
  if (value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

function parseOptionalIsoTime(value: string | null, paramName: string): { value?: string; error?: string } {
  if (!value) return {};
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${paramName} must be a valid ISO timestamp` };
  }
  return { value: parsed.toISOString() };
}

export function createIntelligenceEventsRouter(
  deps: IntelligenceEventsRouterDeps,
): (req: Request) => Promise<Response> {
  const { db } = deps;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);

    if (path !== "/intelligence/events") {
      return jsonError(404, "Not found");
    }

    if (req.method !== "GET") {
      return jsonError(405, "Method not allowed. Use GET.");
    }

    const actor = getRequestActor(req);
    if ((actor.actorType !== "api_key" && actor.actorType !== "oidc") || !actor.actorIdHash) {
      return jsonError(403, "Intelligence events require authenticated actor scope");
    }

    const params = url.searchParams;
    const limit = parseIntParam(params.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = parseIntParam(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

    const eventType = params.get("eventType")?.trim() || undefined;
    const targetType = params.get("targetType")?.trim() || undefined;
    const targetId = params.get("targetId")?.trim() || undefined;
    const statusRaw = params.get("status")?.trim() || undefined;
    const statusFilter: "success" | "failure" | undefined = statusRaw === "success" || statusRaw === "failure"
      ? statusRaw
      : undefined;

    if (statusRaw && !statusFilter) {
      return jsonError(400, 'status must be "success" or "failure"');
    }

    const sinceParsed = parseOptionalIsoTime(params.get("since"), "since");
    if (sinceParsed.error) return jsonError(400, sinceParsed.error);

    const untilParsed = parseOptionalIsoTime(params.get("until"), "until");
    if (untilParsed.error) return jsonError(400, untilParsed.error);

    if (sinceParsed.value && untilParsed.value && sinceParsed.value > untilParsed.value) {
      return jsonError(400, "since must be earlier than or equal to until");
    }

    const rows = await db`
      SELECT
        event_id,
        event_type,
        event_version,
        status,
        occurred_at,
        actor_type,
        target_type,
        target_id,
        request_path,
        request_method,
        request_id,
        idempotency_key,
        metadata
      FROM event_journal
      WHERE actor_type = ${actor.actorType}
        AND actor_id_hash = ${actor.actorIdHash}
        AND (${eventType || null}::text IS NULL OR event_type = ${eventType || null})
        AND (${statusFilter || null}::text IS NULL OR status = ${statusFilter || null})
        AND (${targetType || null}::text IS NULL OR target_type = ${targetType || null})
        AND (${targetId || null}::text IS NULL OR target_id = ${targetId || null})
        AND (${sinceParsed.value || null}::timestamptz IS NULL OR occurred_at >= ${sinceParsed.value || null}::timestamptz)
        AND (${untilParsed.value || null}::timestamptz IS NULL OR occurred_at <= ${untilParsed.value || null}::timestamptz)
      ORDER BY occurred_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const events: IntelligenceEvent[] = (rows as Array<Record<string, unknown>>).map((row) => ({
      eventId: String(row.event_id),
      eventType: String(row.event_type),
      eventVersion: Number(row.event_version),
      status: row.status === "failure" ? "failure" : "success",
      occurredAt: new Date(String(row.occurred_at)).toISOString(),
      actorType: row.actor_type === "oidc"
        ? "oidc"
        : row.actor_type === "api_key"
          ? "api_key"
          : row.actor_type === "legacy"
            ? "legacy"
            : "anonymous",
      targetType: typeof row.target_type === "string" ? row.target_type : undefined,
      targetId: typeof row.target_id === "string" ? row.target_id : undefined,
      requestPath: typeof row.request_path === "string" ? row.request_path : undefined,
      requestMethod: typeof row.request_method === "string" ? row.request_method : undefined,
      requestId: typeof row.request_id === "string" ? row.request_id : undefined,
      idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : undefined,
      metadata: typeof row.metadata === "object" && row.metadata !== null
        ? row.metadata as Record<string, unknown>
        : {},
    }));

    const response: IntelligenceEventsResponse = {
      events,
      pagination: {
        limit,
        offset,
        count: events.length,
      },
      filters: {
        eventType,
        status: statusFilter,
        targetType,
        targetId,
        since: sinceParsed.value,
        until: untilParsed.value,
      },
      scope: {
        actorType: actor.actorType,
      },
    };

    return jsonOk(response);
  };
}
