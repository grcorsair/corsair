/**
 * compliance catalog Test Contract
 *
 * Tests parsing, validation, and resolution of compliance catalog snapshots.
 * Catalogs are JSON snapshots with per-CPOE metadata for human-friendly indexing.
 */

import { describe, test, expect } from "bun:test";
import {
  parseComplianceCatalog,
  validateComplianceCatalog,
  resolveComplianceCatalog,
} from "../../src/parley/compliance-catalog";
import type { ComplianceCatalog } from "../../src/parley/compliance-catalog";

// =============================================================================
// PARSE
// =============================================================================

describe("compliance catalog - parseComplianceCatalog", () => {
  test("parses a full catalog payload", () => {
    const input = JSON.stringify({
      version: "1",
      issuer: "did:web:acme.com",
      generatedAt: "2026-02-10T12:00:00Z",
      cpoes: [
        {
          url: "https://acme.com/compliance/soc2-2026-q1.jwt",
          framework: "SOC2",
          scope: "Production",
          source: "tool",
          issuedAt: "2026-02-01T00:00:00Z",
          expiresAt: "2026-05-01T00:00:00Z",
          hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    });

    const catalog = parseComplianceCatalog(input);
    expect(catalog.version).toBe("1");
    expect(catalog.issuer).toBe("did:web:acme.com");
    expect(catalog.generatedAt).toBe("2026-02-10T12:00:00Z");
    expect(catalog.cpoes).toHaveLength(1);
    expect(catalog.cpoes[0].framework).toBe("SOC2");
  });
});

// =============================================================================
// VALIDATE
// =============================================================================

describe("compliance catalog - validateComplianceCatalog", () => {
  test("valid catalog passes validation", () => {
    const input: ComplianceCatalog = {
      version: "1",
      issuer: "did:web:acme.com",
      generatedAt: "2026-02-10T12:00:00Z",
      cpoes: [
        {
          url: "https://acme.com/compliance/soc2-2026-q1.jwt",
          framework: "SOC2",
          scope: "Production",
          source: "tool",
          issuedAt: "2026-02-01T00:00:00Z",
          expiresAt: "2026-05-01T00:00:00Z",
          hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };

    const result = validateComplianceCatalog(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("non-HTTPS entry URL fails validation", () => {
    const input: ComplianceCatalog = {
      version: "1",
      cpoes: [
        {
          url: "http://acme.com/compliance/soc2.jwt",
        },
      ],
    };

    const result = validateComplianceCatalog(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("HTTPS"))).toBe(true);
  });

  test("invalid hash format fails validation", () => {
    const input: ComplianceCatalog = {
      version: "1",
      cpoes: [
        {
          url: "https://acme.com/compliance/soc2.jwt",
          hash: "deadbeef",
        },
      ],
    };

    const result = validateComplianceCatalog(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("hash"))).toBe(true);
  });

  test("invalid source value fails validation", () => {
    const input: ComplianceCatalog = {
      version: "1",
      cpoes: [
        {
          url: "https://acme.com/compliance/soc2.jwt",
          source: "robot",
        },
      ],
    };

    const result = validateComplianceCatalog(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("source"))).toBe(true);
  });
});

// =============================================================================
// RESOLVE
// =============================================================================

describe("compliance catalog - resolveComplianceCatalog", () => {
  test("resolves catalog from a URL via mock fetch", async () => {
    const mockCatalog = JSON.stringify({
      version: "1",
      cpoes: [
        {
          url: "https://acme.com/compliance/soc2.jwt",
        },
      ],
    });

    const mockFetch = async (url: string) => {
      expect(url).toBe("https://acme.com/compliance/catalog.json");
      return {
        ok: true,
        text: async () => mockCatalog,
      } as unknown as Response;
    };

    const result = await resolveComplianceCatalog("https://acme.com/compliance/catalog.json", mockFetch);
    expect(result.catalog).not.toBeNull();
    expect(result.catalog!.cpoes).toHaveLength(1);
  });

  test("blocks private/reserved catalog host (SSRF)", async () => {
    const result = await resolveComplianceCatalog("https://127.0.0.1/catalog.json");
    expect(result.catalog).toBeNull();
    expect(result.error).toContain("Blocked");
  });
});
