/**
 * Ingestion Contract Tests — Minimum required fields
 */

import { describe, test, expect } from "bun:test";
import type { IngestedDocument } from "../../src/ingestion/types";
import { validateIngestionContract } from "../../src/ingestion/contract";

const baseDoc: IngestedDocument = {
  source: "json",
  metadata: {
    title: "Sample",
    issuer: "Unknown",
    date: "not-a-date",
    scope: "Unknown",
  },
  controls: [],
};

describe("validateIngestionContract", () => {
  test("returns warnings for missing required fields", () => {
    const result = validateIngestionContract(baseDoc);
    expect(result.warnings.join(" ")).toContain("Missing issuer");
    expect(result.warnings.join(" ")).toContain("Missing scope");
    expect(result.warnings.join(" ")).toContain("Missing or invalid assessment date");
  });

  test("returns errors when strict is enabled", () => {
    const result = validateIngestionContract(baseDoc, { strict: true });
    expect(result.errors.join(" ")).toContain("Missing issuer");
    expect(result.errors.join(" ")).toContain("Missing scope");
    expect(result.errors.join(" ")).toContain("Missing or invalid assessment date");
  });

  test("respects input metadata warnings", () => {
    const doc: IngestedDocument = {
      source: "json",
      metadata: {
        title: "Sample",
        issuer: "Acme",
        date: "2026-01-01",
        scope: "Prod",
      },
      controls: [{ id: "C1", description: "Control", status: "effective" }],
    };
    const result = validateIngestionContract(doc, {
      inputMetadataWarnings: ["Missing or invalid assessment date"],
    });
    expect(result.warnings.join(" ")).toContain("Missing or invalid assessment date");
  });

  test("warns when human evidence is missing auditor", () => {
    const doc: IngestedDocument = {
      source: "soc2",
      metadata: {
        title: "SOC 2 Report",
        issuer: "Acme",
        date: "2026-01-01",
        scope: "Prod",
      },
      controls: [{ id: "C1", description: "Control", status: "effective" }],
    };
    const result = validateIngestionContract(doc);
    expect(result.warnings.join(" ")).toContain("Missing auditor for human-reviewed evidence");
  });
});
