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

  test("rejects oversized payload", () => {
    const oversized = "x".repeat(GRC_TRANSLATOR_MAX_INPUT_BYTES + 10);
    const json = JSON.stringify({ blob: oversized });
    expect(() => parseJsonPayload(json)).toThrow("byte limit");
  });
});
