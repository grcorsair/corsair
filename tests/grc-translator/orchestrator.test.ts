import { describe, expect, test } from "bun:test";

import { executeGrcTranslate, type ExecuteGrcTranslateDeps } from "../../src/grc-translator/orchestrator";
import type { GrcTranslateRequest } from "../../src/grc-translator/types";

function request(body: Partial<GrcTranslateRequest> = {}): GrcTranslateRequest {
  return {
    payload: { controls: [{ id: "AC-1", status: "pass" }] },
    mode: "quick",
    redact: true,
    style: "funny",
    audience: "grc-buyer",
    ...body,
  };
}

describe("executeGrcTranslate", () => {
  test("rejects missing payload", async () => {
    const deps: ExecuteGrcTranslateDeps = {
      apiKey: "test",
      callModel: async () => {
        throw new Error("should not call model");
      },
      now: () => new Date("2026-02-26T00:00:00.000Z"),
    };

    await expect(executeGrcTranslate(
      {
        payload: undefined as unknown as Record<string, unknown>,
        mode: "quick",
      },
      deps,
    )).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  test("returns fallback when model output is invalid json", async () => {
    const deps: ExecuteGrcTranslateDeps = {
      apiKey: "test",
      defaultModels: ["cheap/model-a"],
      callModel: async () => ({
        text: "not json",
        inputTokens: 12,
        outputTokens: 40,
      }),
      now: () => new Date("2026-02-26T00:00:00.000Z"),
    };

    const result = await executeGrcTranslate(request(), deps);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.status).toBe("fallback");
    expect(result.results[0]?.output.headline.length).toBeGreaterThan(0);
  });

  test("redacts sensitive values before sending to model", async () => {
    let lastPrompt = "";
    const deps: ExecuteGrcTranslateDeps = {
      apiKey: "test",
      defaultModels: ["cheap/model-a"],
      callModel: async (input) => {
        lastPrompt = input.prompt;
        return {
          text: JSON.stringify({
            headline: "Funny",
            plainEnglish: "Clear",
            grcFindings: ["Found something"],
            nextActions: ["Fix something"],
          }),
          inputTokens: 50,
          outputTokens: 50,
        };
      },
      now: () => new Date("2026-02-26T00:00:00.000Z"),
    };

    const result = await executeGrcTranslate(
      request({
        payload: {
          owner: "security@acme.com",
          apiKey: "sk-live-super-secret",
          accountId: "123456789012",
        },
      }),
      deps,
    );

    expect(result.input.redacted).toBeTrue();
    expect(lastPrompt).not.toContain("security@acme.com");
    expect(lastPrompt).not.toContain("sk-live-super-secret");
    expect(lastPrompt).not.toContain("123456789012");
  });
});
