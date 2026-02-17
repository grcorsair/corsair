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
});
