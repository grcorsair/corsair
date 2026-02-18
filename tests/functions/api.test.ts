/**
 * API Functions Test Contract
 *
 * Tests health check, SSF configuration, SSF stream CRUD,
 * and SCITT registration API endpoints.
 *
 * Uses Bun-native HTTP handlers — no Express.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { VERSION } from "../../src/version";
import { handleHealth, createHealthHandler } from "../../functions/health";
import { handleSSFConfiguration, createSSFConfigHandler } from "../../functions/ssf-configuration";
import {
  createSSFStreamRouter,
  type SSFStreamRouterDeps,
} from "../../functions/ssf-stream";
import {
  createSCITTRouter,
  type SCITTRouterDeps,
} from "../../functions/scitt-register";
import { SSFStreamManager } from "../../src/flagship/ssf-stream";
import { MockSCITTRegistry } from "../../src/parley/scitt-registry";
import { FLAGSHIP_EVENTS } from "../../src/flagship/flagship-types";

// =============================================================================
// HELPERS
// =============================================================================

function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
): Request {
  const url = `http://localhost${path}`;
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

async function jsonResponse(response: Response): Promise<unknown> {
  expect(response.headers.get("content-type")).toContain("application/json");
  return response.json();
}

// =============================================================================
// HEALTH ENDPOINT
// =============================================================================

describe("Health Endpoint", () => {
  test("GET /health returns status ok", async () => {
    const req = jsonRequest("GET", "/health");
    const res = await handleHealth(req);

    expect(res.status).toBe(200);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.version).toBe(VERSION);
    expect(typeof body.timestamp).toBe("string");
  });

  test("health response has valid ISO timestamp", async () => {
    const req = jsonRequest("GET", "/health");
    const res = await handleHealth(req);
    const body = (await jsonResponse(res)) as Record<string, unknown>;

    const ts = new Date(body.timestamp as string);
    expect(ts.getTime()).not.toBeNaN();
  });

  test("createHealthHandler returns ok with connected DB", async () => {
    const mockDb = { [Symbol.for("bun.sql.query")]: true } as any;
    // Mock the tagged template by making db callable as tagged template
    const db = Object.assign(
      (strings: TemplateStringsArray, ..._values: unknown[]) => Promise.resolve([{ "?column?": 1 }]),
      mockDb,
    );
    const handler = createHealthHandler({ db });
    const req = jsonRequest("GET", "/health");
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    const checks = body.checks as Record<string, unknown>;
    expect(checks.database).toBe("connected");
  });

  test("createHealthHandler returns degraded when DB fails", async () => {
    const db = Object.assign(
      (_strings: TemplateStringsArray, ..._values: unknown[]) => Promise.reject(new Error("connection refused")),
      {},
    );
    const handler = createHealthHandler({ db });
    const req = jsonRequest("GET", "/health");
    const res = await handler(req);
    expect(res.status).toBe(503);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.status).toBe("degraded");
    const checks = body.checks as Record<string, unknown>;
    expect(checks.database).toBe("unreachable");
  });

  test("legacy handleHealth still works", async () => {
    const req = jsonRequest("GET", "/health");
    const res = await handleHealth(req);
    expect(res.status).toBe(200);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });
});

// =============================================================================
// SSF CONFIGURATION ENDPOINT
// =============================================================================

describe("SSF Configuration Endpoint", () => {
  test("GET /.well-known/ssf-configuration returns transmitter metadata", async () => {
    const req = jsonRequest("GET", "/.well-known/ssf-configuration");
    const res = await handleSSFConfiguration(req);

    expect(res.status).toBe(200);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.issuer).toBe("https://grcorsair.com");
    expect(body.jwks_uri).toBe("https://grcorsair.com/.well-known/jwks.json");
  });

  test("SSF configuration includes all FLAGSHIP event types", async () => {
    const req = jsonRequest("GET", "/.well-known/ssf-configuration");
    const res = await handleSSFConfiguration(req);
    const body = (await jsonResponse(res)) as Record<string, unknown>;

    const events = body.supported_events as string[];
    expect(events).toContain(FLAGSHIP_EVENTS.COLORS_CHANGED);
    expect(events).toContain(FLAGSHIP_EVENTS.FLEET_ALERT);
    expect(events).toContain(FLAGSHIP_EVENTS.PAPERS_CHANGED);
    expect(events).toContain(FLAGSHIP_EVENTS.MARQUE_REVOKED);
  });

  test("SSF configuration includes delivery methods", async () => {
    const req = jsonRequest("GET", "/.well-known/ssf-configuration");
    const res = await handleSSFConfiguration(req);
    const body = (await jsonResponse(res)) as Record<string, unknown>;

    const methods = body.delivery_methods_supported as string[];
    expect(methods).toContain("urn:ietf:rfc:8935");
    expect(methods).toContain("urn:ietf:rfc:8936");
  });

  test("SSF configuration includes configuration and status endpoints", async () => {
    const req = jsonRequest("GET", "/.well-known/ssf-configuration");
    const res = await handleSSFConfiguration(req);
    const body = (await jsonResponse(res)) as Record<string, unknown>;

    expect(body.configuration_endpoint).toBe(
      "https://api.grcorsair.com/ssf/streams",
    );
    expect(body.status_endpoint).toBe(
      "https://api.grcorsair.com/ssf/streams/{stream_id}/status",
    );
  });

  test("createSSFConfigHandler uses custom domain", async () => {
    const handler = createSSFConfigHandler("custom.example.com");
    const req = jsonRequest("GET", "/.well-known/ssf-configuration");
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.issuer).toBe("https://custom.example.com");
    expect(body.jwks_uri).toBe("https://custom.example.com/.well-known/jwks.json");
    expect(body.configuration_endpoint).toBe("https://api.custom.example.com/ssf/streams");
  });
});

// =============================================================================
// SSF STREAM CRUD
// =============================================================================

describe("SSF Stream API", () => {
  let streamManager: SSFStreamManager;
  let router: (req: Request) => Promise<Response>;

  beforeEach(() => {
    streamManager = new SSFStreamManager();
    const deps: SSFStreamRouterDeps = { streamManager };
    router = createSSFStreamRouter(deps);
  });

  test("POST /ssf/streams creates a new stream", async () => {
    const req = jsonRequest("POST", "/ssf/streams", {
      delivery: { method: "push", endpoint_url: "https://example.com/events" },
      events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
      format: "jwt",
    });

    const res = await router(req);
    expect(res.status).toBe(201);

    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.streamId).toBeDefined();
    expect(body.status).toBe("active");
    expect(typeof body.streamId).toBe("string");
  });

  test("GET /ssf/streams/:id returns stream config", async () => {
    // Create a stream first
    const createReq = jsonRequest("POST", "/ssf/streams", {
      delivery: { method: "poll" },
      events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
      format: "jwt",
    });
    const createRes = await router(createReq);
    const created = (await createRes.json()) as Record<string, unknown>;
    const streamId = created.streamId as string;

    // Get it
    const getReq = jsonRequest("GET", `/ssf/streams/${streamId}`);
    const getRes = await router(getReq);
    expect(getRes.status).toBe(200);

    const body = (await jsonResponse(getRes)) as Record<string, unknown>;
    expect(body.streamId).toBe(streamId);
    expect(body.status).toBe("active");
  });

  test("GET /ssf/streams/:id returns 404 for unknown stream", async () => {
    const req = jsonRequest("GET", "/ssf/streams/nonexistent-id");
    const res = await router(req);
    expect(res.status).toBe(404);
  });

  test("PATCH /ssf/streams/:id updates stream config", async () => {
    // Create a stream
    const createReq = jsonRequest("POST", "/ssf/streams", {
      delivery: { method: "poll" },
      events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
      format: "jwt",
    });
    const createRes = await router(createReq);
    const created = (await createRes.json()) as Record<string, unknown>;
    const streamId = created.streamId as string;

    // Update it
    const patchReq = jsonRequest("PATCH", `/ssf/streams/${streamId}`, {
      events_requested: [
        FLAGSHIP_EVENTS.FLEET_ALERT,
        FLAGSHIP_EVENTS.COLORS_CHANGED,
      ],
    });
    const patchRes = await router(patchReq);
    expect(patchRes.status).toBe(200);

    const body = (await jsonResponse(patchRes)) as Record<string, unknown>;
    const config = body.config as Record<string, unknown>;
    const events = config.events_requested as string[];
    expect(events).toHaveLength(2);
  });

  test("PATCH /ssf/streams/:id returns 404 for unknown stream", async () => {
    const req = jsonRequest("PATCH", "/ssf/streams/nonexistent-id", {
      events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
    });
    const res = await router(req);
    expect(res.status).toBe(404);
  });

  test("DELETE /ssf/streams/:id marks stream as deleted", async () => {
    // Create a stream
    const createReq = jsonRequest("POST", "/ssf/streams", {
      delivery: { method: "poll" },
      events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
      format: "jwt",
    });
    const createRes = await router(createReq);
    const created = (await createRes.json()) as Record<string, unknown>;
    const streamId = created.streamId as string;

    // Delete it
    const deleteReq = jsonRequest("DELETE", `/ssf/streams/${streamId}`);
    const deleteRes = await router(deleteReq);
    expect(deleteRes.status).toBe(200);

    // Verify it's deleted
    const getReq = jsonRequest("GET", `/ssf/streams/${streamId}`);
    const getRes = await router(getReq);
    const body = (await getRes.json()) as Record<string, unknown>;
    expect(body.status).toBe("deleted");
  });

  test("DELETE /ssf/streams/:id returns 404 for unknown stream", async () => {
    const req = jsonRequest("DELETE", "/ssf/streams/nonexistent-id");
    const res = await router(req);
    expect(res.status).toBe(404);
  });

  test("POST /ssf/streams returns 400 for missing required fields", async () => {
    const req = jsonRequest("POST", "/ssf/streams", {});
    const res = await router(req);
    expect(res.status).toBe(400);
  });

  // SSRF protection — endpoint_url validation
  test("POST /ssf/streams rejects private IP in endpoint_url", async () => {
    const req = jsonRequest("POST", "/ssf/streams", {
      delivery: { method: "push", endpoint_url: "http://169.254.169.254/latest/meta-data/" },
      events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
      format: "jwt",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain("endpoint_url");
  });

  test("POST /ssf/streams rejects localhost in endpoint_url", async () => {
    const req = jsonRequest("POST", "/ssf/streams", {
      delivery: { method: "push", endpoint_url: "http://localhost:3000/events" },
      events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
      format: "jwt",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("POST /ssf/streams allows public endpoint_url", async () => {
    const req = jsonRequest("POST", "/ssf/streams", {
      delivery: { method: "push", endpoint_url: "https://webhook.site/test-uuid" },
      events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
      format: "jwt",
    });
    const res = await router(req);
    expect(res.status).toBe(201);
  });

  test("PATCH /ssf/streams/:id rejects private endpoint_url", async () => {
    // Create a valid stream first
    const createReq = jsonRequest("POST", "/ssf/streams", {
      delivery: { method: "push", endpoint_url: "https://example.com/hooks" },
      events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
      format: "jwt",
    });
    const createRes = await router(createReq);
    const created = (await createRes.json()) as Record<string, unknown>;
    const streamId = created.streamId as string;

    // Try to update with private endpoint
    const patchReq = jsonRequest("PATCH", `/ssf/streams/${streamId}`, {
      delivery: { endpoint_url: "http://10.0.0.1:8080/internal" },
    });
    const patchRes = await router(patchReq);
    expect(patchRes.status).toBe(400);
  });

  test("full CRUD lifecycle", async () => {
    // Create
    const createRes = await router(
      jsonRequest("POST", "/ssf/streams", {
        delivery: {
          method: "push",
          endpoint_url: "https://example.com/hooks",
        },
        events_requested: [FLAGSHIP_EVENTS.PAPERS_CHANGED],
        format: "jwt",
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Record<string, unknown>;
    const id = created.streamId as string;

    // Read
    const readRes = await router(jsonRequest("GET", `/ssf/streams/${id}`));
    expect(readRes.status).toBe(200);

    // Update
    const updateRes = await router(
      jsonRequest("PATCH", `/ssf/streams/${id}`, {
        audience: "https://receiver.example.com",
      }),
    );
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as Record<string, unknown>;
    const config = updated.config as Record<string, unknown>;
    expect(config.audience).toBe("https://receiver.example.com");

    // Delete
    const deleteRes = await router(
      jsonRequest("DELETE", `/ssf/streams/${id}`),
    );
    expect(deleteRes.status).toBe(200);
  });
});

// =============================================================================
// SCITT REGISTRATION
// =============================================================================

describe("SCITT Registration API", () => {
  let registry: MockSCITTRegistry;
  let router: (req: Request) => Promise<Response>;

  beforeEach(() => {
    registry = new MockSCITTRegistry("test-scitt-log");
    const deps: SCITTRouterDeps = { registry };
    router = createSCITTRouter(deps);
  });

  test("POST /scitt/entries registers a signed statement", async () => {
    const req = jsonRequest("POST", "/scitt/entries", {
      statement: "eyJhbGciOiJFZERTQSJ9.test.signature",
    });

    const res = await router(req);
    expect(res.status).toBe(201);

    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.entryId).toBeDefined();
    expect(body.status).toBe("registered");
    expect(typeof body.registrationTime).toBe("string");
  });

  test("POST /scitt/entries supports proofOnly mode", async () => {
    const req = jsonRequest("POST", "/scitt/entries", {
      statement: "eyJhbGciOiJFZERTQSJ9.test.signature",
      proofOnly: true,
    });

    const res = await router(req);
    expect(res.status).toBe(201);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.proofOnly).toBe(true);
  });

  test("POST /scitt/entries returns 400 for missing statement", async () => {
    const req = jsonRequest("POST", "/scitt/entries", {});
    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("GET /scitt/entries/:id returns entry metadata", async () => {
    // Register first
    const createReq = jsonRequest("POST", "/scitt/entries", {
      statement: "eyJhbGciOiJFZERTQSJ9.test.signature",
    });
    const createRes = await router(createReq);
    const created = (await createRes.json()) as Record<string, unknown>;
    const entryId = created.entryId as string;

    // Get entry receipt (which contains metadata)
    const getReq = jsonRequest("GET", `/scitt/entries/${entryId}`);
    const getRes = await router(getReq);
    expect(getRes.status).toBe(200);

    const body = (await jsonResponse(getRes)) as Record<string, unknown>;
    expect(body.entryId).toBe(entryId);
  });

  test("GET /scitt/entries/:id returns 404 for unknown entry", async () => {
    const req = jsonRequest("GET", "/scitt/entries/nonexistent");
    const res = await router(req);
    expect(res.status).toBe(404);
  });

  test("GET /scitt/entries/:id/receipt returns COSE receipt", async () => {
    // Register first
    const createReq = jsonRequest("POST", "/scitt/entries", {
      statement: "eyJhbGciOiJFZERTQSJ9.test.signature",
    });
    const createRes = await router(createReq);
    const created = (await createRes.json()) as Record<string, unknown>;
    const entryId = created.entryId as string;

    // Get receipt
    const receiptReq = jsonRequest(
      "GET",
      `/scitt/entries/${entryId}/receipt`,
    );
    const receiptRes = await router(receiptReq);
    expect(receiptRes.status).toBe(200);

    const body = (await jsonResponse(receiptRes)) as Record<string, unknown>;
    expect(body.entryId).toBe(entryId);
    expect(body.logId).toBeDefined();
    expect(typeof body.proof).toBe("string");
    expect((body.proof as string).length).toBeGreaterThan(0);
  });

  test("GET /scitt/entries/:id/receipt returns 404 for unknown entry", async () => {
    const req = jsonRequest("GET", "/scitt/entries/nonexistent/receipt");
    const res = await router(req);
    expect(res.status).toBe(404);
  });

  test("POST /scitt/entries rejects non-JWT statement (no dots)", async () => {
    const req = jsonRequest("POST", "/scitt/entries", {
      statement: "this-is-not-a-jwt",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.error).toContain("JWT");
  });

  test("POST /scitt/entries rejects statement with wrong number of parts", async () => {
    const req = jsonRequest("POST", "/scitt/entries", {
      statement: "part1.part2",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("POST /scitt/entries rejects statement with invalid base64url header", async () => {
    const req = jsonRequest("POST", "/scitt/entries", {
      statement: "!!!invalid!!!.payload.signature",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("POST /scitt/entries rejects oversized statement (>50KB)", async () => {
    const bigPayload = "a".repeat(51_000);
    const req = jsonRequest("POST", "/scitt/entries", {
      statement: `eyJhbGciOiJFZERTQSJ9.${bigPayload}.signature`,
    });
    const res = await router(req);
    expect(res.status).toBe(400);
    const body = (await jsonResponse(res)) as Record<string, unknown>;
    expect(body.error).toContain("size");
  });

  test("POST /scitt/entries accepts valid JWT-format statement", async () => {
    const req = jsonRequest("POST", "/scitt/entries", {
      statement: "eyJhbGciOiJFZERTQSJ9.eyJ0ZXN0IjoxfQ.validSignature",
    });
    const res = await router(req);
    expect(res.status).toBe(201);
  });

  test("full SCITT registration flow", async () => {
    const statement = "eyJhbGciOiJFZERTQSJ9.cpoe-payload.ed25519-sig";

    // Register
    const registerRes = await router(
      jsonRequest("POST", "/scitt/entries", { statement }),
    );
    expect(registerRes.status).toBe(201);
    const registration = (await registerRes.json()) as Record<string, unknown>;
    const entryId = registration.entryId as string;

    // Get metadata
    const metaRes = await router(
      jsonRequest("GET", `/scitt/entries/${entryId}`),
    );
    expect(metaRes.status).toBe(200);

    // Get receipt
    const receiptRes = await router(
      jsonRequest("GET", `/scitt/entries/${entryId}/receipt`),
    );
    expect(receiptRes.status).toBe(200);
    const receipt = (await receiptRes.json()) as Record<string, unknown>;
    expect(receipt.proof).toBeDefined();
  });
});

// =============================================================================
// ROUTE MATCHING
// =============================================================================

describe("Route matching", () => {
  test("SSF router returns 404 for unknown routes", async () => {
    const streamManager = new SSFStreamManager();
    const router = createSSFStreamRouter({ streamManager });

    const req = jsonRequest("GET", "/ssf/unknown");
    const res = await router(req);
    expect(res.status).toBe(404);
  });

  test("SCITT router returns 404 for unknown routes", async () => {
    const registry = new MockSCITTRegistry();
    const router = createSCITTRouter({ registry });

    const req = jsonRequest("GET", "/scitt/unknown");
    const res = await router(req);
    expect(res.status).toBe(404);
  });
});
