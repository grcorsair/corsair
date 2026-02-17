import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { parseJSON } from "../../src/ingestion/json-parser";
import { resetMappingRegistry } from "../../src/ingestion/mapping-registry";

const tmpDir = join(import.meta.dir, ".tmp-mappings");

beforeEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  const mapping = [
    {
      id: "toolx-evidence-only",
      priority: 5,
      match: { allOf: ["$.evidenceOnly"] },
      metadata: {
        titlePath: "$.meta.title",
        issuer: "Tool X",
        datePath: "$.meta.date",
        scopePath: "$.meta.scope",
        reportType: "Tool X Evidence",
      },
      passthrough: {
        paths: {
          summary: "$.summary",
          tool: "$.tool",
        },
      },
    },
    {
      id: "toolx-controls",
      priority: 5,
      match: { allOf: ["$.findings"] },
      metadata: {
        titlePath: "$.meta.title",
        issuer: "Tool X",
        datePath: "$.meta.date",
        scopePath: "$.meta.scope",
        reportType: "Tool X Findings",
      },
      controls: {
        path: "$.findings",
        idPath: "@.id",
        descriptionPath: "@.title",
        statusPath: "@.status",
        statusMap: { pass: "effective", fail: "ineffective" },
        severityPath: "@.severity",
      },
    },
  ];

  writeFileSync(join(tmpDir, "toolx.json"), JSON.stringify(mapping, null, 2));

  const priorityMapping = [
    {
      id: "low-priority",
      priority: 1,
      match: { allOf: ["$.priority"] },
      metadata: {
        title: "Low Priority",
        issuer: "Tool X",
        date: "2026-01-01",
        scope: "Test",
        reportType: "Priority Test",
      },
      passthrough: {
        paths: { note: "$.priority" },
      },
    },
    {
      id: "high-priority",
      priority: 10,
      match: { allOf: ["$.priority"] },
      metadata: {
        title: "High Priority",
        issuer: "Tool X",
        date: "2026-01-01",
        scope: "Test",
        reportType: "Priority Test",
      },
      passthrough: {
        paths: { note: "$.priority" },
      },
    },
  ];

  writeFileSync(join(tmpDir, "priority.json"), JSON.stringify(priorityMapping, null, 2));
  process.env.CORSAIR_MAPPING_DIR = tmpDir;
  resetMappingRegistry();
});

afterEach(() => {
  delete process.env.CORSAIR_MAPPING_DIR;
  resetMappingRegistry();
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

describe("mapping registry", () => {
  test("creates evidence-only document with passthrough fields", () => {
    const input = {
      evidenceOnly: true,
      tool: "Tool X",
      meta: { title: "Tool X Export", date: "2026-01-10", scope: "Prod" },
      summary: { passed: 12, failed: 2 },
    };

    const doc = parseJSON(input);
    expect(doc.controls).toHaveLength(0);
    expect(doc.metadata.title).toBe("Tool X Export");
    expect(doc.extensions?.passthrough).toEqual({ summary: { passed: 12, failed: 2 }, tool: "Tool X" });
    expect((doc.extensions?.mapping as { evidenceOnly?: boolean })?.evidenceOnly).toBe(true);
  });

  test("maps controls from findings array", () => {
    const input = {
      meta: { title: "Tool X Findings", date: "2026-01-12", scope: "AWS Prod" },
      findings: [
        { id: "F-1", title: "MFA enabled", status: "pass", severity: "high" },
        { id: "F-2", title: "S3 public access", status: "fail", severity: "critical" },
      ],
    };

    const doc = parseJSON(input);
    expect(doc.controls).toHaveLength(2);
    expect(doc.controls[0].id).toBe("F-1");
    expect(doc.controls[0].status).toBe("effective");
    expect(doc.controls[0].severity).toBe("HIGH");
    expect(doc.controls[1].status).toBe("ineffective");
  });

  test("uses higher priority mapping when multiple match", () => {
    const input = {
      priority: true,
    };

    const doc = parseJSON(input);
    expect((doc.extensions?.mapping as { id?: string })?.id).toBe("high-priority");
    expect(doc.metadata.title).toBe("High Priority");
  });

  test("rejects invalid mappings and surfaces diagnostics", async () => {
    const { getMappingsWithDiagnostics, resetMappingRegistry } = await import("../../src/ingestion/mapping-registry");
    const invalidMapping = {
      id: "invalid-mapping",
      match: { },
      controls: { },
    };
    writeFileSync(join(tmpDir, "invalid.json"), JSON.stringify(invalidMapping, null, 2));

    resetMappingRegistry();
    const result = getMappingsWithDiagnostics();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.mappings.some((m) => m.id === "invalid-mapping")).toBe(false);
  });

  test("loads signed mapping pack when signature is valid", async () => {
    const { generateKeyPairSync, sign } = await import("crypto");
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const pack = {
      pack: {
        id: "test-pack",
        version: "1",
        issuedAt: "2026-02-10T12:00:00Z",
      },
      mappings: [
        {
          id: "pack-mapping",
          match: { allOf: ["$.pack"] },
          passthrough: { paths: { note: "$.note" } },
        },
      ],
    };

    const canonical = JSON.stringify(sortKeysDeep(pack));
    const signature = sign(null, Buffer.from(canonical), privateKey).toString("base64");
    const signedPack = { ...pack, signature };

    writeFileSync(join(tmpDir, "pack.json"), JSON.stringify(signedPack, null, 2));

    process.env.CORSAIR_MAPPING_PACK_PUBKEY = publicKey;
    const { getMappingsWithDiagnostics, resetMappingRegistry } = await import("../../src/ingestion/mapping-registry");
    resetMappingRegistry();

    const result = getMappingsWithDiagnostics();
    expect(result.errors.length).toBe(0);
    expect(result.mappings.some((m) => m.id === "pack-mapping")).toBe(true);

    delete process.env.CORSAIR_MAPPING_PACK_PUBKEY;
  });

  test("rejects mapping pack with invalid signature", async () => {
    const { generateKeyPairSync, sign } = await import("crypto");
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const pack = {
      pack: {
        id: "test-pack",
        version: "1",
        issuedAt: "2026-02-10T12:00:00Z",
      },
      mappings: [
        {
          id: "pack-mapping",
          match: { allOf: ["$.pack"] },
          passthrough: { paths: { note: "$.note" } },
        },
      ],
    };

    const canonical = JSON.stringify(sortKeysDeep(pack));
    const signature = sign(null, Buffer.from(canonical), privateKey).toString("base64");
    const signedPack = { ...pack, signature: signature.slice(2) + "aa" };

    writeFileSync(join(tmpDir, "pack-bad.json"), JSON.stringify(signedPack, null, 2));

    process.env.CORSAIR_MAPPING_PACK_PUBKEY = publicKey;
    const { getMappingsWithDiagnostics, resetMappingRegistry } = await import("../../src/ingestion/mapping-registry");
    resetMappingRegistry();

    const result = getMappingsWithDiagnostics();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.mappings.some((m) => m.id === "pack-mapping")).toBe(false);

    delete process.env.CORSAIR_MAPPING_PACK_PUBKEY;
  });
});

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
