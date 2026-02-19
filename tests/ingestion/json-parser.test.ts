/**
 * JSON Parser Tests — Mapping-First Evidence Ingestion
 */

import { describe, test, expect } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { parseJSON } from "../../src/ingestion/json-parser";
import { deriveProvenance } from "../../src/ingestion/provenance-utils";
import { mapToMarqueInput } from "../../src/ingestion/mapper";
import { resetMappingRegistry } from "../../src/ingestion/mapping-registry";

const tmpDir = join(import.meta.dir, ".tmp-json-parser");

// =============================================================================
// GENERIC JSON FORMAT
// =============================================================================

describe("parseJSON — generic format", () => {
  test("should parse a minimal generic JSON with controls array", () => {
    const input = {
      metadata: {
        title: "Q1 2026 Security Assessment",
        issuer: "Acme Corp",
        date: "2026-01-15",
        scope: "AWS Production Environment",
      },
      controls: [
        {
          id: "MFA-001",
          description: "Multi-factor authentication enabled for all users",
          status: "pass",
          evidence: "Okta MFA policy enforced for all user groups",
        },
        {
          id: "ENC-001",
          description: "Data at rest encrypted with AES-256",
          status: "pass",
          evidence: "S3 default encryption verified via AWS Config",
        },
        {
          id: "LOG-001",
          description: "Audit logging enabled for all services",
          status: "fail",
          severity: "HIGH",
          evidence: "CloudTrail disabled in us-west-2 region",
        },
      ],
    };

    const result = parseJSON(input);

    expect(result.source).toBe("json");
    expect(result.metadata.title).toBe("Q1 2026 Security Assessment");
    expect(result.metadata.issuer).toBe("Acme Corp");
    expect(result.metadata.date).toBe("2026-01-15");
    expect(result.metadata.scope).toBe("AWS Production Environment");
    expect(result.controls).toHaveLength(3);

    // Status normalization: "pass" → "effective", "fail" → "ineffective"
    expect(result.controls[0].status).toBe("effective");
    expect(result.controls[2].status).toBe("ineffective");
    expect(result.controls[2].severity).toBe("HIGH");
  });

  test("should handle string input (parse JSON string)", () => {
    const input = JSON.stringify({
      metadata: {
        title: "Test",
        issuer: "Test Corp",
        date: "2026-01-01",
        scope: "Test scope",
      },
      controls: [
        { id: "C1", description: "Control 1", status: "pass" },
      ],
    });

    const result = parseJSON(input);

    expect(result.source).toBe("json");
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0].status).toBe("effective");
  });

  test("should normalize various status strings", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [
        { id: "C1", description: "D", status: "PASS" },
        { id: "C2", description: "D", status: "FAIL" },
        { id: "C3", description: "D", status: "pass" },
        { id: "C4", description: "D", status: "fail" },
        { id: "C5", description: "D", status: "effective" },
        { id: "C6", description: "D", status: "ineffective" },
        { id: "C7", description: "D", status: "not-tested" },
        { id: "C8", description: "D", status: "skip" },
        { id: "C9", description: "D", status: "INFO" },
        { id: "C10", description: "D", status: "error" },
      ],
    };

    const result = parseJSON(input);

    expect(result.controls[0].status).toBe("effective");
    expect(result.controls[1].status).toBe("ineffective");
    expect(result.controls[6].status).toBe("not-tested");
    expect(result.controls[8].status).toBe("not-tested");
  });

  test("should normalize severity strings", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [
        { id: "C1", description: "D", status: "pass", severity: "critical" },
        { id: "C2", description: "D", status: "pass", severity: "high" },
        { id: "C3", description: "D", status: "pass", severity: "medium" },
        { id: "C4", description: "D", status: "pass", severity: "low" },
        { id: "C5", description: "D", status: "pass", severity: "info" },
      ],
    };

    const result = parseJSON(input);

    expect(result.controls[0].severity).toBe("CRITICAL");
    expect(result.controls[1].severity).toBe("HIGH");
    expect(result.controls[2].severity).toBe("MEDIUM");
    expect(result.controls[3].severity).toBe("LOW");
    expect(result.controls[4].severity).toBe("LOW");
  });

  test("should extract framework references", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [
        { id: "C1", description: "D", status: "pass", framework: "SOC2", controlId: "CC6.1" },
        { id: "C2", description: "D", status: "pass", frameworks: [{ framework: "NIST-800-53", controlId: "AC-2" }] },
      ],
    };

    const result = parseJSON(input);
    expect(result.controls[0].frameworkRefs).toEqual([{ framework: "SOC2", controlId: "CC6.1", controlName: undefined }]);
    expect(result.controls[1].frameworkRefs).toEqual([{ framework: "NIST-800-53", controlId: "AC-2", controlName: undefined }]);
  });

  test("should handle empty controls array", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [],
    };

    const result = parseJSON(input);
    expect(result.controls).toHaveLength(0);
  });

  test("computes deterministic rawTextHash regardless of key order", () => {
    const a = { metadata: { title: "A", issuer: "I", date: "2026-01-01", scope: "S" }, controls: [{ id: "c" }] };
    const b = { controls: [{ id: "c" }], metadata: { scope: "S", date: "2026-01-01", issuer: "I", title: "A" } };

    const resultA = parseJSON(a);
    const resultB = parseJSON(b);
    expect(resultA.metadata.rawTextHash).toBe(resultB.metadata.rawTextHash);
  });

  test("should allow explicit source override", () => {
    const input = {
      metadata: { title: "Generic", issuer: "Generic", date: "2026-01-01", scope: "Test" },
      controls: [],
    };
    const result = parseJSON(input, { source: "manual" });
    expect(result.source).toBe("manual");
  });
});

// =============================================================================
// MAPPING REGISTRY INTEGRATION
// =============================================================================

describe("parseJSON — mapping registry", () => {
  test("should use mapping registry when match rules apply", () => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });

    const mapping = {
      id: "toolx-mapping",
      match: { allOf: ["$.tool", "$.findings"] },
      metadata: {
        title: "Tool X Export",
        issuer: "Tool X",
        reportType: "Tool X",
      },
      controls: {
        path: "$.findings[*]",
        idPath: "@.id",
        descriptionPath: "@.title",
        statusPath: "@.status",
        statusMap: { pass: "effective", fail: "ineffective" },
      },
    };

    writeFileSync(join(tmpDir, "toolx.json"), JSON.stringify(mapping, null, 2));
    process.env.CORSAIR_MAPPING_DIR = tmpDir;
    resetMappingRegistry();

    const input = {
      tool: "toolx",
      findings: [
        { id: "X-1", title: "MFA enabled", status: "pass" },
      ],
    };

    const result = parseJSON(input);
    expect(result.metadata.title).toBe("Tool X Export");
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0].id).toBe("X-1");

    delete process.env.CORSAIR_MAPPING_DIR;
    resetMappingRegistry();
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

describe("parseJSON — error handling", () => {
  test("should throw on invalid JSON string", () => {
    expect(() => parseJSON("{bad json" as any)).toThrow("invalid JSON");
  });

  test("should throw on null input", () => {
    expect(() => parseJSON(null as any)).toThrow("null/undefined");
  });

  test("should throw on number input", () => {
    expect(() => parseJSON(123 as any)).toThrow("string or object");
  });
});

// =============================================================================
// PIPELINE INTEGRATION
// =============================================================================

describe("parseJSON — pipeline integration", () => {
  test("should produce output compatible with provenance derivation and mapper", () => {
    const input = {
      metadata: { title: "Test", issuer: "Acme", date: "2026-01-01", scope: "Test" },
      controls: [
        { id: "C1", description: "Control", status: "pass" },
      ],
    };

    const doc = parseJSON(input);
    const provenance = deriveProvenance(doc.source, doc.metadata);
    expect(provenance.source).toBe("tool");

    const marque = mapToMarqueInput(doc);
    expect(marque.markResults[0]?.findings).toHaveLength(1);
  });
});
