import { describe, expect, test } from "bun:test";

import {
  GRC_TRANSLATOR_MAX_INPUT_BYTES,
  byteLength,
  parseJsonPayload,
  postGrcTranslation,
} from "../../apps/web/src/lib/grc-translator";

describe("web grc translator helpers", () => {
  test("computes byte length", () => {
    expect(byteLength('{"a":1}')).toBeGreaterThan(0);
  });

  test("parses valid JSON object payload", () => {
    const payload = parseJsonPayload('{"framework":"SOC2"}') as { framework: string };
    expect(payload.framework).toBe("SOC2");
  });

  test("rejects invalid JSON", () => {
    expect(() => parseJsonPayload("{bad-json")).toThrow("Invalid JSON format.");
  });

  test("parses object snippet without surrounding braces", () => {
    const payload = parseJsonPayload('"Sid":"DenyStorageWithoutKMSEncryption","Effect":"Deny"') as {
      Sid: string;
      Effect: string;
    };
    expect(payload.Sid).toBe("DenyStorageWithoutKMSEncryption");
    expect(payload.Effect).toBe("Deny");
  });

  test("parses json fenced code blocks", () => {
    const payload = parseJsonPayload("```json\n{\"framework\":\"SOC2\"}\n```") as { framework: string };
    expect(payload.framework).toBe("SOC2");
  });

  test("parses json with trailing commas", () => {
    const payload = parseJsonPayload('{"framework":"SOC2","controls":[{"id":"CC6.1",}],}') as {
      controls: Array<{ id: string }>;
    };
    expect(payload.controls[0]?.id).toBe("CC6.1");
  });

  test("parses json embedded in wrapper text", () => {
    const payload = parseJsonPayload('policy preview:\n{"framework":"SOC2","controls":[]}\nend') as {
      framework: string;
    };
    expect(payload.framework).toBe("SOC2");
  });

  test("parses json missing final closing brace", () => {
    const payload = parseJsonPayload('{"Sid":"Deny","Condition":{"Null":{"s3:x-amz-server-side-encryption":"true"}}') as {
      Sid: string;
      Condition: { Null: Record<string, string> };
    };
    expect(payload.Sid).toBe("Deny");
    expect(payload.Condition.Null["s3:x-amz-server-side-encryption"]).toBe("true");
  });

  test("rejects oversized payload", () => {
    const oversized = "x".repeat(GRC_TRANSLATOR_MAX_INPUT_BYTES + 10);
    const json = JSON.stringify({ blob: oversized });
    expect(() => parseJsonPayload(json)).toThrow("byte limit");
  });

  test("posts translator request and returns result payload", async () => {
    const response = await postGrcTranslation(
      {
        payload: { framework: "SOC2" },
        mode: "quick",
        redact: true,
      },
      {
        fetcher: async (input, init) => {
          expect(input).toBe("/api/grc-translate");
          expect(init?.method).toBe("POST");
          const requestBody = JSON.parse(String(init?.body)) as {
            payload: { framework: string };
            mode: string;
            redact: boolean;
          };
          expect(requestBody.payload.framework).toBe("SOC2");
          expect(requestBody.mode).toBe("quick");
          expect(requestBody.redact).toBe(true);

          return new Response(
            JSON.stringify({
              result: {
                runId: "run_123",
                mode: "quick",
                input: {
                  bytes: 18,
                  redacted: true,
                  fingerprint: "sha256:test",
                },
                results: [],
                consensus: { themes: [], disagreements: [] },
                cta: { sign: "/sign", verify: "/verify", publish: "/publish" },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      },
    );

    expect(response.runId).toBe("run_123");
  });

  test("surfaces backend error messages", async () => {
    await expect(
      postGrcTranslation(
        {
          payload: { framework: "SOC2" },
          mode: "quick",
          redact: true,
        },
        {
          fetcher: async () =>
            new Response(
              JSON.stringify({ error: "Rate limit exceeded. Try again in 60 seconds." }),
              { status: 429, headers: { "content-type": "application/json" } },
            ),
        },
      ),
    ).rejects.toThrow("Rate limit exceeded. Try again in 60 seconds.");
  });

  test("fails when translator response is missing result payload", async () => {
    await expect(
      postGrcTranslation(
        {
          payload: { framework: "SOC2" },
          mode: "quick",
          redact: true,
        },
        {
          fetcher: async () =>
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
        },
      ),
    ).rejects.toThrow("Translator response missing result payload.");
  });
});
