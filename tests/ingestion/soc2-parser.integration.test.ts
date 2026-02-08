/**
 * SOC 2 Parser Integration Tests
 *
 * These tests make REAL API calls to Claude with REAL SOC 2 PDFs.
 * Requires: ANTHROPIC_API_KEY environment variable.
 *
 * Run explicitly:
 *   ANTHROPIC_API_KEY=your_key bun test tests/ingestion/soc2-parser.integration.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";

import { parseSOC2 } from "../../src/ingestion/soc2-parser";
import { mapToMarqueInput } from "../../src/ingestion/mapper";
import { MarqueGenerator } from "../../src/parley/marque-generator";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { MarqueVerifier } from "../../src/parley/marque-verifier";
import type { IngestedDocument } from "../../src/ingestion/types";

// =============================================================================
// CONFIG
// =============================================================================

const SOC2_PDF = "/Users/ayoubfandi/Downloads/NayaOne-Limited-2024-SOC-2-Type-II-Final-report.pdf";
const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;
const HAS_PDF = fs.existsSync(SOC2_PDF);

// Shared state across tests (parse once, verify multiple times)
let ingested: IngestedDocument | null = null;
const testKeyDir = path.join(process.cwd(), ".test-keys-soc2-" + crypto.randomUUID().slice(0, 8));

// =============================================================================
// TESTS
// =============================================================================

describe("SOC 2 Parser — Real Document Integration", () => {
  test("should parse a real SOC 2 PDF and extract controls", async () => {
    if (!HAS_API_KEY || !HAS_PDF) {
      console.log("Skipping: needs ANTHROPIC_API_KEY and SOC 2 PDF");
      return;
    }

    ingested = await parseSOC2(SOC2_PDF);

    // Basic structure
    expect(ingested.source).toBe("soc2");
    expect(ingested.metadata.title).toBeDefined();
    expect(ingested.metadata.issuer).toBeDefined();
    expect(ingested.controls).toBeInstanceOf(Array);
    expect(ingested.controls.length).toBeGreaterThan(0);

    console.log(`\n=== SOC 2 Parser Results ===`);
    console.log(`Title:    ${ingested.metadata.title}`);
    console.log(`Issuer:   ${ingested.metadata.issuer}`);
    console.log(`Auditor:  ${ingested.metadata.auditor || "N/A"}`);
    console.log(`Controls: ${ingested.controls.length}`);
    console.log(`  Effective:    ${ingested.controls.filter(c => c.status === "effective").length}`);
    console.log(`  Ineffective:  ${ingested.controls.filter(c => c.status === "ineffective").length}`);
    console.log(`  Not tested:   ${ingested.controls.filter(c => c.status === "not-tested").length}`);

    // Every control should have required fields
    for (const ctrl of ingested.controls) {
      expect(ctrl.id).toBeDefined();
      expect(ctrl.description).toBeDefined();
      expect(["effective", "ineffective", "not-tested"]).toContain(ctrl.status);
    }

    // Should have framework references
    const withRefs = ingested.controls.filter(c => c.frameworkRefs && c.frameworkRefs.length > 0);
    expect(withRefs.length).toBeGreaterThan(0);
    console.log(`  With framework refs: ${withRefs.length}`);

    // Log first 5 controls for inspection
    console.log(`\nFirst 5 controls:`);
    for (const ctrl of ingested.controls.slice(0, 5)) {
      console.log(`  [${ctrl.status.toUpperCase()}] ${ctrl.id}: ${ctrl.description.slice(0, 80)}`);
      if (ctrl.frameworkRefs) {
        console.log(`    Frameworks: ${ctrl.frameworkRefs.map(r => `${r.framework}:${r.controlId}`).join(", ")}`);
      }
    }
  }, 300000); // 5-minute timeout for Claude API call

  test("should produce a valid CPOE from a parsed SOC 2 document", async () => {
    if (!ingested) {
      console.log("Skipping: depends on first test (needs ANTHROPIC_API_KEY and SOC 2 PDF)");
      return;
    }

    // 1. Keys
    const keyManager = new MarqueKeyManager(testKeyDir);
    await keyManager.generateKeypair();

    // 2. Map
    const input = mapToMarqueInput(ingested, { did: "did:web:nayaone.com" });

    // 3. Generate
    const generator = new MarqueGenerator(keyManager, {
      expiryDays: 90,
      format: "vc",
    });
    const output = await generator.generateOutput(input);

    expect(output.format).toBe("vc");
    expect(output.jwt).toBeDefined();
    expect(output.jwt!.split(".")).toHaveLength(3);

    // 4. Verify
    const keypair = await keyManager.loadKeypair();
    const verifier = new MarqueVerifier([keypair!.publicKey]);
    const verification = await verifier.verify(output.jwt!);

    expect(verification.valid).toBe(true);

    console.log(`\n=== CPOE Generated ===`);
    console.log(`MARQUE ID: ${output.marqueId}`);
    console.log(`Format:    JWT-VC`);
    console.log(`Verified:  ${verification.valid}`);
    console.log(`JWT length: ${output.jwt!.length} chars`);
  }, 30000);

  // Cleanup
  afterAll(() => {
    if (fs.existsSync(testKeyDir)) {
      fs.rmSync(testKeyDir, { recursive: true });
    }
  });
});
