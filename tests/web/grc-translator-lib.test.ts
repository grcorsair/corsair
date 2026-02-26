import { describe, expect, test } from "bun:test";

import {
  GRC_TRANSLATOR_MAX_INPUT_BYTES,
  byteLength,
  parseJsonPayload,
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

  test("rejects oversized payload", () => {
    const oversized = "x".repeat(GRC_TRANSLATOR_MAX_INPUT_BYTES + 10);
    const json = JSON.stringify({ blob: oversized });
    expect(() => parseJsonPayload(json)).toThrow("byte limit");
  });
});
