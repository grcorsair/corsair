import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createSSFStream, getSSFStream, updateSSFStream, deleteSSFStream } from "../../src/flagship/ssf-client";
import { withPreconnect } from "../helpers/mock-fetch";

const originalFetch = globalThis.fetch;

function mockFetch(responseBody: unknown, status = 200) {
  globalThis.fetch = withPreconnect(async (_input: Request | URL | string, _init?: RequestInit) => {
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}

beforeEach(() => {
  mockFetch({});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ssf-client", () => {
  test("createSSFStream posts to /ssf/streams", async () => {
    let captured: { input?: Request | URL | string; init?: RequestInit } = {};
    globalThis.fetch = withPreconnect(async (input: Request | URL | string, init?: RequestInit) => {
      captured = { input, init };
      return new Response(JSON.stringify({
        streamId: "stream-123",
        status: "active",
        config: {
          delivery: { method: "poll" },
          events_requested: ["https://grcorsair.com/events/colors-changed/v1"],
          format: "jwt",
        },
        createdAt: "2026-02-01T00:00:00Z",
        updatedAt: "2026-02-01T00:00:00Z",
      }), { status: 201, headers: { "content-type": "application/json" } });
    });

    const stream = await createSSFStream({
      delivery: { method: "poll" },
      events_requested: ["https://grcorsair.com/events/colors-changed/v1"],
      format: "jwt",
    }, {
      apiUrl: "https://api.example.com/v1",
      authToken: "token",
    });

    expect(String(captured.input)).toBe("https://api.example.com/v1/ssf/streams");
    expect(captured.init?.method).toBe("POST");
    expect((captured.init?.headers as Record<string, string>)?.authorization).toBe("Bearer token");
    expect(stream.streamId).toBe("stream-123");
  });

  test("get/update/delete use stream id", async () => {
    globalThis.fetch = withPreconnect(async (input: Request | URL | string, init?: RequestInit) => {
      const method = init?.method || "GET";
      if (method === "GET") {
        return new Response(JSON.stringify({ streamId: "stream-1", status: "active", config: { delivery: { method: "poll" }, events_requested: [], format: "jwt" }, createdAt: "", updatedAt: "" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "PATCH") {
        return new Response(JSON.stringify({ streamId: "stream-1", status: "active", config: { delivery: { method: "poll" }, events_requested: [], format: "jwt" }, createdAt: "", updatedAt: "" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ status: "deleted", streamId: "stream-1" }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const base = "https://api.example.com";
    const opts = { apiUrl: base, authToken: "token" };
    const stream = await getSSFStream("stream-1", opts);
    expect(stream.streamId).toBe("stream-1");

    const updated = await updateSSFStream("stream-1", { delivery: { method: "poll" } }, opts);
    expect(updated.streamId).toBe("stream-1");

    const deleted = await deleteSSFStream("stream-1", opts);
    expect(deleted.status).toBe("deleted");
  });
});
