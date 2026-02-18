import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import {
  EvidenceEngine,
  generateEvidenceReceipts,
  verifyEvidenceReceipt,
} from "../../src/evidence";

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `corsair-evidence-receipts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

describe("Evidence receipts", () => {
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

  test("generate receipt by index and verify", async () => {
    const dir = trackDir(createTestDir());
    fs.mkdirSync(dir, { recursive: true });
    const evidencePath = path.join(dir, "evidence.jsonl");

    const engine = new EvidenceEngine(evidencePath);
    await engine.captureEvidence("recon", { sample: { b: 1, a: 2 } }, evidencePath);
    await engine.captureEvidence("mark", { sample: { c: 3 } }, evidencePath);

    const receipts = generateEvidenceReceipts(evidencePath, { indexes: [1], includeMeta: true });
    expect(receipts).toHaveLength(1);

    const result = verifyEvidenceReceipt(receipts[0]);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("generate receipt by record hash and detect digest mismatch", async () => {
    const dir = trackDir(createTestDir());
    fs.mkdirSync(dir, { recursive: true });
    const evidencePath = path.join(dir, "evidence.jsonl");

    const engine = new EvidenceEngine(evidencePath);
    await engine.captureEvidence("recon", { sample: { x: true } }, evidencePath);

    const records = engine.readJSONLFile(evidencePath);
    const receipts = generateEvidenceReceipts(evidencePath, { recordHashes: [records[0]!.hash] });

    const result = verifyEvidenceReceipt(receipts[0], "deadbeef");
    expect(result.ok).toBe(false);
    expect(result.errors.some(err => err.includes("chainDigest mismatch"))).toBe(true);
  });

  test("tampered proof fails verification", async () => {
    const dir = trackDir(createTestDir());
    fs.mkdirSync(dir, { recursive: true });
    const evidencePath = path.join(dir, "evidence.jsonl");

    const engine = new EvidenceEngine(evidencePath);
    await engine.captureEvidence("recon", { sample: { x: true } }, evidencePath);
    await engine.captureEvidence("mark", { sample: { y: true } }, evidencePath);

    const receipts = generateEvidenceReceipts(evidencePath, { indexes: [0] });
    const tampered = { ...receipts[0], proof: [...receipts[0].proof] };
    if (tampered.proof.length > 0) {
      tampered.proof[0] = { ...tampered.proof[0], hash: "bad" };
    }

    const result = verifyEvidenceReceipt(tampered);
    expect(result.ok).toBe(false);
  });
});
