import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { EvidenceEngine, compareEvidenceChain } from "../../src/evidence";

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `corsair-evidence-compare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

describe("Evidence chain comparison", () => {
  const testDirs: string[] = [];

  function trackDir(dir: string): string {
    testDirs.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const dir of testDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
    }
  });

  test("compareEvidenceChain matches computed summary", async () => {
    const dir = trackDir(createTestDir());
    fs.mkdirSync(dir, { recursive: true });
    const evidencePath = path.join(dir, "evidence.jsonl");

    const engine = new EvidenceEngine(evidencePath);
    await engine.captureEvidence("recon", { sample: { b: 1, a: 2 } }, evidencePath);

    const summary = engine.summarizeChains([evidencePath]);
    expect(summary).not.toBeNull();

    const expected = {
      chainType: "hash-linked",
      algorithm: "sha256",
      canonicalization: "sorted-json-v1",
      recordCount: 1,
      chainVerified: true,
      chainDigest: summary!.chainDigest,
    };

    const result = compareEvidenceChain(expected, summary);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("compareEvidenceChain detects digest mismatch", async () => {
    const dir = trackDir(createTestDir());
    fs.mkdirSync(dir, { recursive: true });
    const evidencePath = path.join(dir, "evidence.jsonl");

    const engine = new EvidenceEngine(evidencePath);
    await engine.captureEvidence("recon", { sample: { x: true } }, evidencePath);

    const summary = engine.summarizeChains([evidencePath]);
    expect(summary).not.toBeNull();

    const expected = {
      chainType: "hash-linked",
      algorithm: "sha256",
      canonicalization: "sorted-json-v1",
      recordCount: 1,
      chainVerified: true,
      chainDigest: "deadbeef",
    };

    const result = compareEvidenceChain(expected, summary);
    expect(result.ok).toBe(false);
    expect(result.errors.some(err => err.includes("chainDigest mismatch"))).toBe(true);
  });
});
