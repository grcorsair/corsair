/**
 * Source Tier Tests — Derivation rules
 */

import { describe, test, expect } from "bun:test";
import { deriveSourceTier } from "../../src/ingestion/source-tier";

// =============================================================================
// DERIVATION
// =============================================================================

describe("deriveSourceTier", () => {
  test("derives tiers from document source", () => {
    expect(deriveSourceTier("tool")).toBe("tool");
    expect(deriveSourceTier("json")).toBe("tool");
    expect(deriveSourceTier("soc2")).toBe("human");
    expect(deriveSourceTier("iso27001")).toBe("human");
    expect(deriveSourceTier("pentest")).toBe("human");
    expect(deriveSourceTier("manual")).toBe("human");
  });

  test("prefers explicit overrides", () => {
    expect(deriveSourceTier("json", "platform")).toBe("platform");
    expect(deriveSourceTier("tool", "native")).toBe("native");
  });
});
