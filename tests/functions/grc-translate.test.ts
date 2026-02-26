import { describe, expect, test } from "bun:test";

import { createGrcTranslateRouter } from "../../functions/grc-translate";
import type { GrcTranslateResponse } from "../../src/grc-translator/types";

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("grc translate router", () => {
  test("rejects invalid JSON body", async () => {
    const router = createGrcTranslateRouter({
      executeTranslate: async () => {
        throw new Error("should not execute");
      },
    });
    const req = new Request("http://localhost/grc/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ bad-json",
    });

    const res = await router(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_REQUEST");
  });

  test("accepts /v1/grc/translate path and returns result", async () => {
    const router = createGrcTranslateRouter({
      executeTranslate: async () => ({
        runId: "run_123",
        mode: "quick",
        input: {
          bytes: 28,
          redacted: true,
          fingerprint: "sha256:test",
        },
        results: [
          {
            model: "google/gemini-3-flash-preview",
            label: "Gemini 3 Flash Preview",
            status: "ok",
            latencyMs: 100,
            output: {
              roast: "short roast",
              plainEnglish: "plain",
              grcFindings: ["one finding"],
              nextActions: ["one action"],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 20,
            },
          },
        ],
        consensus: {
          themes: ["theme"],
          disagreements: [],
        },
        cta: {
          sign: "/sign",
          verify: "/verify",
          publish: "/publish",
        },
      } satisfies GrcTranslateResponse),
    });

    const res = await router(jsonRequest("/v1/grc/translate", { payload: { foo: "bar" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.runId).toBe("run_123");
    expect(body.result.mode).toBe("quick");
  });

  test("rejects unsupported routes", async () => {
    const router = createGrcTranslateRouter({
      executeTranslate: async () => {
        throw new Error("should not execute");
      },
    });

    const res = await router(jsonRequest("/grc/not-translate", { payload: { foo: "bar" } }));
    expect(res.status).toBe(404);
  });
});
