import { describe, test, expect } from "bun:test";
import { readPDF } from "../../src/ingestion/pdf-extractor";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// PDF EXTRACTOR TESTS (no API key needed)
// =============================================================================

describe("PDF Extractor", () => {
  test("should throw on missing file", () => {
    expect(() => readPDF("/nonexistent/file.pdf")).toThrow("PDF file not found");
  });

  test("should read a real PDF file and produce base64 + hash", () => {
    // Use the smallest SOC 2 report available
    const pdfPath = "/Users/ayoubfandi/Downloads/01_2025_gptw_soc_2_type_1_final_report.pdf";

    if (!fs.existsSync(pdfPath)) {
      console.log("Skipping: SOC 2 PDF not found at expected path");
      return;
    }

    const result = readPDF(pdfPath);

    expect(result.base64).toBeDefined();
    expect(result.base64.length).toBeGreaterThan(0);
    expect(result.hash).toBeDefined();
    expect(result.hash).toHaveLength(64); // SHA-256 hex = 64 chars
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.filename).toBe("01_2025_gptw_soc_2_type_1_final_report.pdf");
  });

  test("should produce consistent hash for same file", () => {
    const pdfPath = "/Users/ayoubfandi/Downloads/01_2025_gptw_soc_2_type_1_final_report.pdf";

    if (!fs.existsSync(pdfPath)) {
      console.log("Skipping: SOC 2 PDF not found");
      return;
    }

    const result1 = readPDF(pdfPath);
    const result2 = readPDF(pdfPath);

    expect(result1.hash).toBe(result2.hash);
  });
});

// =============================================================================
// SOC 2 PARSER INTEGRATION TESTS (requires ANTHROPIC_API_KEY)
// =============================================================================

// These tests are in a separate file: soc2-parser.integration.test.ts
// They require a real API key and make real API calls.
// Run them explicitly: bun test tests/ingestion/soc2-parser.integration.test.ts
