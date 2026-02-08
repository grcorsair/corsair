/**
 * EvidenceEngine.captureEvidence() — Generic Evidence Capture
 *
 * Validates that captureEvidence() creates a single hash-chained record
 * from arbitrary data, independent of RaidResult shape.
 */

import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { EvidenceEngine } from "../../src/evidence";

describe("EvidenceEngine.captureEvidence()", () => {
  const testDirs: string[] = [];

  function tmpDir(): string {
    const dir = path.join(
      os.tmpdir(),
      `corsair-evidence-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    fs.mkdirSync(dir, { recursive: true });
    testDirs.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const dir of testDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  test("creates a single evidence record from generic data", async () => {
    const dir = tmpDir();
    const evidencePath = path.join(dir, "generic-evidence.jsonl");
    const engine = new EvidenceEngine(evidencePath);

    const result = await engine.captureEvidence(
      "mark",
      { controlId: "CC6.1", status: "effective", source: "soc2-document" },
      evidencePath,
    );

    expect(result.eventCount).toBe(1);
    expect(result.chainVerified).toBe(true);
    expect(result.auditReady).toBe(true);

    const records = engine.readJSONLFile(evidencePath);
    expect(records).toHaveLength(1);
    expect(records[0].operation).toBe("mark");
    expect(records[0].data).toEqual({
      controlId: "CC6.1",
      status: "effective",
      source: "soc2-document",
    });
  });

  test("multiple captureEvidence calls chain correctly", async () => {
    const dir = tmpDir();
    const evidencePath = path.join(dir, "chained.jsonl");
    const engine = new EvidenceEngine(evidencePath);

    await engine.captureEvidence("recon", { step: 1 }, evidencePath);
    await engine.captureEvidence("mark", { step: 2 }, evidencePath);
    await engine.captureEvidence("chart", { step: 3 }, evidencePath);

    const records = engine.readJSONLFile(evidencePath);
    expect(records).toHaveLength(3);
    expect(records[0].previousHash).toBeNull();
    expect(records[1].previousHash).toBe(records[0].hash);
    expect(records[2].previousHash).toBe(records[1].hash);

    const verification = engine.verifyEvidenceChain(evidencePath);
    expect(verification.valid).toBe(true);
    expect(verification.recordCount).toBe(3);
  });

  test("captureEvidence works alongside plunder()", async () => {
    const dir = tmpDir();
    const evidencePath = path.join(dir, "mixed.jsonl");
    const engine = new EvidenceEngine(evidencePath);

    // Generic evidence first
    await engine.captureEvidence("mark", { generic: true }, evidencePath);

    // Then traditional plunder
    await engine.plunder({
      raidId: "raid-1",
      target: "test",
      vector: "mfa-bypass",
      success: false,
      controlsHeld: true,
      findings: [],
      timeline: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      serialized: false,
      durationMs: 100,
    }, evidencePath);

    const records = engine.readJSONLFile(evidencePath);
    expect(records).toHaveLength(4); // 1 generic + 3 from plunder
    expect(engine.verifyHashChain(evidencePath)).toBe(true);
  });
});
