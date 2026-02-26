import { describe, expect, test } from "bun:test";

import {
  isValidDomain,
  normalizeDomain,
  scoreTone,
  verdictTone,
} from "../../apps/web/src/lib/roast";

describe("web roast helpers", () => {
  test("normalizes domains", () => {
    expect(normalizeDomain(" Acme.COM. ")).toBe("acme.com");
    expect(normalizeDomain("https://trust.acme.com/security")).toBe("trust.acme.com");
  });

  test("validates domains", () => {
    expect(isValidDomain("acme.com")).toBeTrue();
    expect(isValidDomain("localhost")).toBeFalse();
    expect(isValidDomain("10.0.0.1")).toBeFalse();
    expect(isValidDomain("bad domain")).toBeFalse();
  });

  test("maps verdict and score tones", () => {
    expect(verdictTone("CORSAIR READY")).toContain("text-corsair-green");
    expect(verdictTone("COMPLIANCE GHOST")).toContain("text-corsair-crimson");
    expect(scoreTone(8.8)).toBe("bg-corsair-green");
    expect(scoreTone(5.1)).toBe("bg-corsair-cyan");
  });
});
