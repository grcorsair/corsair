import { describe, test, expect } from "bun:test";
import { createHash } from "crypto";
import { createIntelligenceEventsRouter } from "../../functions/intelligence-events";

function jsonRequest(path: string, options?: RequestInit): Request {
  return new Request(`http://localhost${path}`, options);
}

function withApiKeyAuth(req: Request, key: string): Request {
  (req as Request & { corsairAuth?: unknown }).corsairAuth = {
    type: "api_key",
    key,
  };
  return req;
}

describe("intelligence events router", () => {
  test("returns events for authenticated actor scope", async () => {
    const calls: Array<{ query: string; values: unknown[] }> = [];
    const db = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ query: strings.join("?"), values });
      return [{
        event_id: "evt_1",
        event_type: "trusttxt.hosted.upsert",
        event_version: 1,
        status: "success",
        occurred_at: "2026-02-28T10:00:00.000Z",
        actor_type: "api_key",
        target_type: "domain",
        target_id: "acme.com",
        request_path: "/trust-txt/host",
        request_method: "POST",
        request_id: "req_1",
        idempotency_key: null,
        metadata: { frameworks: ["SOC2"] },
      }];
    };

    const router = createIntelligenceEventsRouter({ db: db as any });
    const req = withApiKeyAuth(
      jsonRequest("/intelligence/events?limit=10&eventType=trusttxt.hosted.upsert"),
      "api-key-1",
    );

    const res = await router(req);
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    const events = body.events as Array<Record<string, unknown>>;

    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("trusttxt.hosted.upsert");
    expect(events[0].targetId).toBe("acme.com");

    expect(calls.length).toBe(1);
    expect(calls[0].query).toContain("FROM event_journal");
    expect(calls[0].values).toContain("api_key");
    expect(calls[0].values).toContain(
      createHash("sha256").update("api-key-1").digest("hex"),
    );
  });

  test("supports /v1 prefix", async () => {
    const db = async () => [];
    const router = createIntelligenceEventsRouter({ db: db as any });
    const req = withApiKeyAuth(jsonRequest("/v1/intelligence/events"), "api-key-1");

    const res = await router(req);
    expect(res.status).toBe(200);
  });

  test("rejects invalid status", async () => {
    const db = async () => [];
    const router = createIntelligenceEventsRouter({ db: db as any });
    const req = withApiKeyAuth(jsonRequest("/intelligence/events?status=maybe"), "api-key-1");

    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("rejects invalid timestamps", async () => {
    const db = async () => [];
    const router = createIntelligenceEventsRouter({ db: db as any });
    const req = withApiKeyAuth(jsonRequest("/intelligence/events?since=not-a-date"), "api-key-1");

    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("rejects when unauthenticated actor scope is unavailable", async () => {
    const db = async () => [];
    const router = createIntelligenceEventsRouter({ db: db as any });
    const req = jsonRequest("/intelligence/events");

    const res = await router(req);
    expect(res.status).toBe(403);
  });

  test("rejects non-GET methods", async () => {
    const db = async () => [];
    const router = createIntelligenceEventsRouter({ db: db as any });
    const req = withApiKeyAuth(
      jsonRequest("/intelligence/events", { method: "POST" }),
      "api-key-1",
    );

    const res = await router(req);
    expect(res.status).toBe(405);
  });
});
