/**
 * trust.txt Test Contract
 *
 * Tests parsing, generation, validation, and resolution of trust.txt files.
 * Modeled after security.txt (RFC 9116) — a discovery layer for compliance proofs.
 *
 * Spec: /.well-known/trust.txt
 * Origin: @toufik-airane (GitHub issue #2)
 */

import { describe, test, expect } from "bun:test";
import {
  parseTrustTxt,
  generateTrustTxt,
  validateTrustTxt,
  resolveTrustTxt,
} from "../../src/parley/trust-txt";
import type { TrustTxt } from "../../src/parley/trust-txt";

// =============================================================================
// PARSE
// =============================================================================

describe("trust.txt - parseTrustTxt", () => {
  test("parses a full trust.txt with all fields", () => {
    const input = `# Corsair Trust Discovery
DID: did:web:acme.com
CPOE: https://acme.com/compliance/soc2-2026-q1.jwt
CPOE: https://acme.com/compliance/iso27001-2026.jwt
SCITT: https://log.grcorsair.com/v1/entries?issuer=did:web:acme.com
CATALOG: https://acme.com/compliance/catalog.json
FLAGSHIP: https://signals.grcorsair.com/v1/streams/acme-prod
Frameworks: SOC2, ISO27001, NIST-800-53
Contact: compliance@acme.com
Expires: 2026-12-31T23:59:59Z
`;

    const result = parseTrustTxt(input);
    expect(result.did).toBe("did:web:acme.com");
    expect(result.cpoes).toEqual([
      "https://acme.com/compliance/soc2-2026-q1.jwt",
      "https://acme.com/compliance/iso27001-2026.jwt",
    ]);
    expect(result.scitt).toBe("https://log.grcorsair.com/v1/entries?issuer=did:web:acme.com");
    expect(result.catalog).toBe("https://acme.com/compliance/catalog.json");
    expect(result.flagship).toBe("https://signals.grcorsair.com/v1/streams/acme-prod");
    expect(result.frameworks).toEqual(["SOC2", "ISO27001", "NIST-800-53"]);
    expect(result.contact).toBe("compliance@acme.com");
    expect(result.expires).toBe("2026-12-31T23:59:59Z");
  });

  test("parses minimal trust.txt (DID only)", () => {
    const input = `DID: did:web:acme.com\n`;
    const result = parseTrustTxt(input);
    expect(result.did).toBe("did:web:acme.com");
    expect(result.cpoes).toEqual([]);
    expect(result.scitt).toBeUndefined();
    expect(result.flagship).toBeUndefined();
    expect(result.frameworks).toEqual([]);
    expect(result.contact).toBeUndefined();
    expect(result.expires).toBeUndefined();
  });

  test("ignores comment lines starting with #", () => {
    const input = `# This is a comment
# Another comment
DID: did:web:acme.com
# Inline comment
CPOE: https://acme.com/cpoe.jwt
`;

    const result = parseTrustTxt(input);
    expect(result.did).toBe("did:web:acme.com");
    expect(result.cpoes).toEqual(["https://acme.com/cpoe.jwt"]);
  });

  test("ignores blank lines", () => {
    const input = `
DID: did:web:acme.com

CPOE: https://acme.com/cpoe.jwt

`;

    const result = parseTrustTxt(input);
    expect(result.did).toBe("did:web:acme.com");
    expect(result.cpoes).toEqual(["https://acme.com/cpoe.jwt"]);
  });

  test("handles multiple CPOE entries (repeatable key)", () => {
    const input = `DID: did:web:acme.com
CPOE: https://acme.com/soc2.jwt
CPOE: https://acme.com/iso27001.jwt
CPOE: https://acme.com/pentest.jwt
`;

    const result = parseTrustTxt(input);
    expect(result.cpoes).toHaveLength(3);
    expect(result.cpoes[0]).toBe("https://acme.com/soc2.jwt");
    expect(result.cpoes[1]).toBe("https://acme.com/iso27001.jwt");
    expect(result.cpoes[2]).toBe("https://acme.com/pentest.jwt");
  });

  test("trims whitespace from values", () => {
    const input = `DID:   did:web:acme.com
CPOE:  https://acme.com/cpoe.jwt
Contact:  compliance@acme.com
`;

    const result = parseTrustTxt(input);
    expect(result.did).toBe("did:web:acme.com");
    expect(result.cpoes).toEqual(["https://acme.com/cpoe.jwt"]);
    expect(result.contact).toBe("compliance@acme.com");
  });

  test("handles frameworks with various spacing", () => {
    const input = `DID: did:web:acme.com
Frameworks: SOC2,ISO27001, NIST-800-53 , PCI-DSS
`;

    const result = parseTrustTxt(input);
    expect(result.frameworks).toEqual(["SOC2", "ISO27001", "NIST-800-53", "PCI-DSS"]);
  });

  test("is case-insensitive for keys", () => {
    const input = `did: did:web:acme.com
cpoe: https://acme.com/cpoe.jwt
scitt: https://log.grcorsair.com/v1/entries
catalog: https://acme.com/compliance/catalog.json
flagship: https://signals.grcorsair.com/v1/streams/acme
frameworks: SOC2
contact: compliance@acme.com
expires: 2026-12-31T23:59:59Z
`;

    const result = parseTrustTxt(input);
    expect(result.did).toBe("did:web:acme.com");
    expect(result.cpoes).toEqual(["https://acme.com/cpoe.jwt"]);
    expect(result.scitt).toBe("https://log.grcorsair.com/v1/entries");
    expect(result.catalog).toBe("https://acme.com/compliance/catalog.json");
    expect(result.flagship).toBe("https://signals.grcorsair.com/v1/streams/acme");
    expect(result.frameworks).toEqual(["SOC2"]);
    expect(result.contact).toBe("compliance@acme.com");
    expect(result.expires).toBe("2026-12-31T23:59:59Z");
  });

  test("ignores unknown keys", () => {
    const input = `DID: did:web:acme.com
UnknownKey: some value
CPOE: https://acme.com/cpoe.jwt
`;

    const result = parseTrustTxt(input);
    expect(result.did).toBe("did:web:acme.com");
    expect(result.cpoes).toEqual(["https://acme.com/cpoe.jwt"]);
  });

  test("returns empty structure for empty input", () => {
    const result = parseTrustTxt("");
    expect(result.did).toBeUndefined();
    expect(result.cpoes).toEqual([]);
    expect(result.frameworks).toEqual([]);
  });

  test("returns empty structure for comments-only input", () => {
    const result = parseTrustTxt("# Just comments\n# Nothing else\n");
    expect(result.did).toBeUndefined();
    expect(result.cpoes).toEqual([]);
  });

  test("last DID wins if multiple are specified", () => {
    const input = `DID: did:web:first.com
DID: did:web:second.com
`;
    const result = parseTrustTxt(input);
    expect(result.did).toBe("did:web:second.com");
  });
});

// =============================================================================
// GENERATE
// =============================================================================

describe("trust.txt - generateTrustTxt", () => {
  test("generates a full trust.txt with all fields", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [
        "https://acme.com/compliance/soc2.jwt",
        "https://acme.com/compliance/iso27001.jwt",
      ],
      scitt: "https://log.grcorsair.com/v1/entries?issuer=did:web:acme.com",
      catalog: "https://acme.com/compliance/catalog.json",
      flagship: "https://signals.grcorsair.com/v1/streams/acme-prod",
      frameworks: ["SOC2", "ISO27001", "NIST-800-53"],
      contact: "compliance@acme.com",
      expires: "2026-12-31T23:59:59Z",
    };

    const output = generateTrustTxt(input);
    expect(output).toContain("DID: did:web:acme.com");
    expect(output).toContain("CPOE: https://acme.com/compliance/soc2.jwt");
    expect(output).toContain("CPOE: https://acme.com/compliance/iso27001.jwt");
    expect(output).toContain("SCITT: https://log.grcorsair.com/v1/entries?issuer=did:web:acme.com");
    expect(output).toContain("CATALOG: https://acme.com/compliance/catalog.json");
    expect(output).toContain("FLAGSHIP: https://signals.grcorsair.com/v1/streams/acme-prod");
    expect(output).toContain("Frameworks: SOC2, ISO27001, NIST-800-53");
    expect(output).toContain("Contact: compliance@acme.com");
    expect(output).toContain("Expires: 2026-12-31T23:59:59Z");
  });

  test("generates minimal trust.txt with DID only", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
    };

    const output = generateTrustTxt(input);
    expect(output).toContain("DID: did:web:acme.com");
    expect(output).not.toContain("CPOE:");
    expect(output).not.toContain("SCITT:");
    expect(output).not.toContain("FLAGSHIP:");
    expect(output).not.toContain("Contact:");
    expect(output).not.toContain("Expires:");
  });

  test("includes header comment with spec URL", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
    };

    const output = generateTrustTxt(input);
    expect(output).toContain("# Corsair Trust Discovery");
    expect(output).toContain("# Spec: https://grcorsair.com/spec/trust-txt");
  });

  test("omits Frameworks line when array is empty", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
    };

    const output = generateTrustTxt(input);
    expect(output).not.toContain("Frameworks:");
  });
});

// =============================================================================
// ROUND-TRIP
// =============================================================================

describe("trust.txt - round-trip", () => {
  test("parse(generate(obj)) preserves all fields", () => {
    const original: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [
        "https://acme.com/compliance/soc2.jwt",
        "https://acme.com/compliance/iso27001.jwt",
      ],
      scitt: "https://log.grcorsair.com/v1/entries?issuer=did:web:acme.com",
      catalog: "https://acme.com/compliance/catalog.json",
      flagship: "https://signals.grcorsair.com/v1/streams/acme-prod",
      frameworks: ["SOC2", "ISO27001"],
      contact: "compliance@acme.com",
      expires: "2026-12-31T23:59:59Z",
    };

    const generated = generateTrustTxt(original);
    const parsed = parseTrustTxt(generated);

    expect(parsed.did).toBe(original.did);
    expect(parsed.cpoes).toEqual(original.cpoes);
    expect(parsed.scitt).toBe(original.scitt);
    expect(parsed.catalog).toBe(original.catalog);
    expect(parsed.flagship).toBe(original.flagship);
    expect(parsed.frameworks).toEqual(original.frameworks);
    expect(parsed.contact).toBe(original.contact);
    expect(parsed.expires).toBe(original.expires);
  });

  test("round-trip with zero CPOEs", () => {
    const original: TrustTxt = {
      did: "did:web:minimal.com",
      cpoes: [],
      frameworks: [],
    };

    const generated = generateTrustTxt(original);
    const parsed = parseTrustTxt(generated);

    expect(parsed.did).toBe(original.did);
    expect(parsed.cpoes).toEqual([]);
    expect(parsed.frameworks).toEqual([]);
  });

  test("round-trip with many CPOEs", () => {
    const original: TrustTxt = {
      did: "did:web:big.com",
      cpoes: Array.from({ length: 10 }, (_, i) => `https://big.com/cpoe-${i}.jwt`),
      frameworks: ["SOC2", "ISO27001", "NIST-800-53", "PCI-DSS", "HIPAA"],
    };

    const generated = generateTrustTxt(original);
    const parsed = parseTrustTxt(generated);

    expect(parsed.cpoes).toHaveLength(10);
    expect(parsed.frameworks).toHaveLength(5);
  });
});

// =============================================================================
// VALIDATE
// =============================================================================

describe("trust.txt - validateTrustTxt", () => {
  test("valid trust.txt passes validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: ["https://acme.com/cpoe.jwt"],
      frameworks: ["SOC2"],
      contact: "compliance@acme.com",
      expires: "2026-12-31T23:59:59Z",
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("missing DID fails validation", () => {
    const input: TrustTxt = {
      cpoes: ["https://acme.com/cpoe.jwt"],
      frameworks: ["SOC2"],
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("DID"))).toBe(true);
  });

  test("invalid DID format fails validation", () => {
    const input: TrustTxt = {
      did: "not-a-did",
      cpoes: [],
      frameworks: [],
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("did:web:"))).toBe(true);
  });

  test("non-HTTPS CPOE URL fails validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: ["http://acme.com/cpoe.jwt"],
      frameworks: [],
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("HTTPS"))).toBe(true);
  });

  test("malformed CPOE URL fails validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: ["not-a-url"],
      frameworks: [],
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("URL"))).toBe(true);
  });

  test("expired Expires date fails validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
      expires: "2020-01-01T00:00:00Z",
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("expired"))).toBe(true);
  });

  test("invalid Expires date format fails validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
      expires: "not-a-date",
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Expires"))).toBe(true);
  });

  test("non-HTTPS SCITT URL fails validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
      scitt: "http://log.example.com/entries",
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("SCITT"))).toBe(true);
  });

  test("non-HTTPS FLAGSHIP URL fails validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
      flagship: "http://signals.example.com/stream",
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("FLAGSHIP"))).toBe(true);
  });

  test("non-HTTPS CATALOG URL fails validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
      catalog: "http://acme.com/compliance/catalog.json",
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("CATALOG"))).toBe(true);
  });

  test("private/reserved CPOE URL fails validation", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: ["https://192.168.1.1/cpoe.jwt"],
      frameworks: [],
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("private") || e.includes("Blocked"))).toBe(true);
  });

  test("minimal valid trust.txt passes", () => {
    const input: TrustTxt = {
      did: "did:web:acme.com",
      cpoes: [],
      frameworks: [],
    };

    const result = validateTrustTxt(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// =============================================================================
// RESOLVE
// =============================================================================

describe("trust.txt - resolveTrustTxt", () => {
  test("resolves trust.txt from a domain via mock fetch", async () => {
    const mockTxt = `DID: did:web:acme.com
CPOE: https://acme.com/soc2.jwt
Frameworks: SOC2
Contact: compliance@acme.com
Expires: 2030-12-31T23:59:59Z
`;

    const mockFetch = async (url: string) => {
      expect(url).toBe("https://acme.com/.well-known/trust.txt");
      return {
        ok: true,
        text: async () => mockTxt,
      } as unknown as Response;
    };

    const result = await resolveTrustTxt("acme.com", mockFetch);
    expect(result.trustTxt).not.toBeNull();
    expect(result.trustTxt!.did).toBe("did:web:acme.com");
    expect(result.trustTxt!.cpoes).toEqual(["https://acme.com/soc2.jwt"]);
    expect(result.error).toBeUndefined();
  });

  test("constructs correct URL for domain", async () => {
    let capturedUrl = "";
    const mockFetch = async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        text: async () => "DID: did:web:example.com\n",
      } as unknown as Response;
    };

    await resolveTrustTxt("example.com", mockFetch);
    expect(capturedUrl).toBe("https://example.com/.well-known/trust.txt");
  });

  test("returns error for HTTP failure", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
    }) as unknown as Response;

    const result = await resolveTrustTxt("unknown.example.com", mockFetch);
    expect(result.trustTxt).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error).toContain("404");
  });

  test("returns error for network failure", async () => {
    const mockFetch = async (): Promise<Response> => {
      throw new Error("Network error");
    };

    const result = await resolveTrustTxt("unreachable.example.com", mockFetch);
    expect(result.trustTxt).toBeNull();
    expect(result.error).toBeDefined();
  });

  test("blocks private/reserved domains (SSRF)", async () => {
    const result = await resolveTrustTxt("192.168.1.1");
    expect(result.trustTxt).toBeNull();
    expect(result.error).toContain("Blocked");
  });

  test("blocks localhost (SSRF)", async () => {
    const result = await resolveTrustTxt("localhost");
    expect(result.trustTxt).toBeNull();
    expect(result.error).toContain("Blocked");
  });

  test("blocks 127.0.0.1 (SSRF)", async () => {
    const result = await resolveTrustTxt("127.0.0.1");
    expect(result.trustTxt).toBeNull();
    expect(result.error).toContain("Blocked");
  });

  test("blocks cloud metadata service (SSRF)", async () => {
    const result = await resolveTrustTxt("169.254.169.254");
    expect(result.trustTxt).toBeNull();
    expect(result.error).toContain("Blocked");
  });
});
