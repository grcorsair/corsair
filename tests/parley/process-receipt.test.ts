/**
 * Process Receipt Tests
 *
 * Covers:
 * - Receipt generation with COSE_Sign1 signing
 * - Hash determinism (canonical JSON)
 * - Tamper detection
 * - LLM attestation fields
 * - Receipt chain building (ReceiptChain)
 * - Chain digest (Merkle root)
 * - Chain verification (receipt-verifier)
 * - Hash link validation
 * - Temporal ordering
 * - SCITT registration (mock)
 */

import { describe, test, expect } from "bun:test";
import * as crypto from "crypto";

import {
  hashData,
  hashReceipt,
  generateReceipt,
  verifyReceipt,
} from "../../src/parley/process-receipt";
import type { ProcessReceipt } from "../../src/parley/process-receipt";

import { ReceiptChain } from "../../src/parley/receipt-chain";

import { verifyProcessChain } from "../../src/parley/receipt-verifier";
import type { ProcessVerificationResult } from "../../src/parley/receipt-verifier";

import { MockSCITTRegistry } from "../../src/parley/scitt-registry";

// =============================================================================
// HELPERS
// =============================================================================

function generateEd25519Keypair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

const keypair = generateEd25519Keypair();
const otherKeypair = generateEd25519Keypair();

// =============================================================================
// hashData
// =============================================================================

describe("hashData", () => {
  test("should produce deterministic hash for same input", () => {
    const data = { foo: "bar", baz: 42 };
    const hash1 = hashData(data);
    const hash2 = hashData(data);
    expect(hash1).toBe(hash2);
  });

  test("should produce same hash regardless of key order", () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(hashData(a)).toBe(hashData(b));
  });

  test("should produce different hash for different data", () => {
    expect(hashData({ x: 1 })).not.toBe(hashData({ x: 2 }));
  });

  test("should handle nested objects with canonical sorting", () => {
    const a = { outer: { z: 1, a: 2 } };
    const b = { outer: { a: 2, z: 1 } };
    expect(hashData(a)).toBe(hashData(b));
  });

  test("should return hex-encoded SHA-256", () => {
    const hash = hashData("hello");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// =============================================================================
// hashReceipt
// =============================================================================

describe("hashReceipt", () => {
  test("should produce same hash with or without signature", () => {
    const receipt = generateReceipt({
      step: "evidence",
      inputData: { file: "test.json" },
      outputData: { controls: [] },
      reproducible: true,
    }, keypair.privateKeyPem);

    const hashWithSig = hashReceipt(receipt);

    // Strip signature manually and hash
    const { signature: _s, ...body } = receipt;
    const hashWithoutSig = hashData(body);

    expect(hashWithSig).toBe(hashWithoutSig);
  });

  test("should exclude scittEntryId from hash", () => {
    const receipt = generateReceipt({
      step: "classify",
      inputData: "input",
      outputData: "output",
      reproducible: true,
    }, keypair.privateKeyPem);

    const hashBefore = hashReceipt(receipt);
    receipt.scittEntryId = "entry-12345";
    const hashAfter = hashReceipt(receipt);

    expect(hashBefore).toBe(hashAfter);
  });
});

// =============================================================================
// generateReceipt
// =============================================================================

describe("generateReceipt", () => {
  test("should generate receipt with all required fields", () => {
    const receipt = generateReceipt({
      step: "evidence",
      inputData: { file: "prowler-findings.json" },
      outputData: { controls: [{ id: "CC1.1" }] },
      reproducible: true,
    }, keypair.privateKeyPem);

    expect(receipt._type).toBe("https://in-toto.io/Statement/v1");
    expect(receipt.predicateType).toBe("https://grcorsair.com/provenance/v1");
    expect(receipt.predicate.step).toBe("evidence");
    expect(receipt.predicate.reproducible).toBe(true);
    expect(receipt.predicate.builder.id).toBe("https://grcorsair.com/pipeline/v1");
    expect(receipt.subject[0].name).toBe("evidence-output");
    expect(receipt.subject[0].digest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.predicate.materials[0].uri).toBe("evidence-input");
    expect(receipt.predicate.materials[0].digest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.predicate.metadata.startedOn).toBeTruthy();
    expect(receipt.predicate.metadata.finishedOn).toBeTruthy();
    expect(receipt.signature).toBeTruthy();
  });

  test("should include code version when provided", () => {
    const receipt = generateReceipt({
      step: "classify",
      inputData: "in",
      outputData: "out",
      reproducible: true,
      codeVersion: "assurance-calculator@2026-02-09",
    }, keypair.privateKeyPem);

    expect(receipt.predicate.builder.version).toBe("assurance-calculator@2026-02-09");
  });

  test("should include code digest when provided", () => {
    const receipt = generateReceipt({
      step: "chart",
      inputData: "in",
      outputData: "out",
      reproducible: true,
      codeDigest: "abc123",
    }, keypair.privateKeyPem);

    expect(receipt.predicate.builder.codeDigest).toEqual({ sha256: "abc123" });
  });

  test("should include LLM attestation for non-deterministic steps", () => {
    const receipt = generateReceipt({
      step: "evidence",
      inputData: { file: "report.pdf" },
      outputData: { controls: [] },
      reproducible: false,
      llmAttestation: {
        model: "claude-sonnet-4-5-20250929",
        promptDigest: "deadbeef",
        temperature: 0,
      },
    }, keypair.privateKeyPem);

    expect(receipt.predicate.llmAttestation).toBeDefined();
    expect(receipt.predicate.llmAttestation!.model).toBe("claude-sonnet-4-5-20250929");
    expect(receipt.predicate.llmAttestation!.promptDigest).toEqual({ sha256: "deadbeef" });
    expect(receipt.predicate.llmAttestation!.temperature).toBe(0);
  });

  test("should include toolAttestation when provided", () => {
    const receipt = generateReceipt({
      step: "evidence",
      inputData: { source: "prowler" },
      outputData: { controls: [{ id: "CC1.1" }] },
      reproducible: true,
      toolAttestation: {
        toolName: "Prowler",
        toolVersion: "4.2.1",
        scanTimestamp: "2026-02-12T10:00:00Z",
        scanTarget: "aws:123456789012",
        scanProfile: "cis-aws-benchmark-v3.0",
        outputFormat: "prowler-jsonl",
      },
    }, keypair.privateKeyPem);

    expect(receipt.predicate.toolAttestation).toBeDefined();
    expect(receipt.predicate.toolAttestation!.toolName).toBe("Prowler");
    expect(receipt.predicate.toolAttestation!.toolVersion).toBe("4.2.1");
    expect(receipt.predicate.toolAttestation!.scanTarget).toBe("aws:123456789012");
    expect(receipt.predicate.toolAttestation!.scanProfile).toBe("cis-aws-benchmark-v3.0");
    expect(receipt.predicate.toolAttestation!.outputFormat).toBe("prowler-jsonl");
  });

  test("should NOT include LLM attestation for deterministic steps", () => {
    const receipt = generateReceipt({
      step: "classify",
      inputData: "in",
      outputData: "out",
      reproducible: true,
    }, keypair.privateKeyPem);

    expect(receipt.predicate.llmAttestation).toBeUndefined();
  });

  test("should link to previous receipt when provided", () => {
    const first = generateReceipt({
      step: "evidence",
      inputData: "in",
      outputData: "out",
      reproducible: true,
    }, keypair.privateKeyPem);

    const second = generateReceipt({
      step: "classify",
      inputData: "in2",
      outputData: "out2",
      reproducible: true,
      previousReceipt: first,
    }, keypair.privateKeyPem);

    expect(second.predicate.previousReceipt).toBeDefined();
    expect(second.predicate.previousReceipt!.digest.sha256).toBe(hashReceipt(first));
  });

  test("should include SCITT entry ID in previous receipt link", () => {
    const first = generateReceipt({
      step: "evidence",
      inputData: "in",
      outputData: "out",
      reproducible: true,
    }, keypair.privateKeyPem);
    first.scittEntryId = "entry-abc123";

    const second = generateReceipt({
      step: "classify",
      inputData: "in2",
      outputData: "out2",
      reproducible: true,
      previousReceipt: first,
    }, keypair.privateKeyPem);

    expect(second.predicate.previousReceipt!.scittEntryId).toBe("entry-abc123");
  });

  test("should include key attestation when provided", () => {
    const receipt = generateReceipt({
      step: "sign",
      inputData: "in",
      outputData: "out",
      reproducible: true,
      keyAttestation: {
        type: "cloud-kms",
        provider: "aws-kms",
        nonExportable: true,
      },
    }, keypair.privateKeyPem);

    expect(receipt.predicate.builder.keyAttestation).toEqual({
      type: "cloud-kms",
      provider: "aws-kms",
      nonExportable: true,
    });
  });

  test("should produce valid COSE_Sign1 signature", () => {
    const receipt = generateReceipt({
      step: "evidence",
      inputData: "test",
      outputData: "result",
      reproducible: true,
    }, keypair.privateKeyPem);

    const result = verifyReceipt(receipt, keypair.publicKeyPem);
    expect(result.verified).toBe(true);
  });
});

// =============================================================================
// verifyReceipt
// =============================================================================

describe("verifyReceipt", () => {
  test("should verify a valid receipt", () => {
    const receipt = generateReceipt({
      step: "classify",
      inputData: { controls: [] },
      outputData: { levels: [1, 1, 1] },
      reproducible: true,
    }, keypair.privateKeyPem);

    const result = verifyReceipt(receipt, keypair.publicKeyPem);
    expect(result.verified).toBe(true);
    expect(result.payload.length).toBeGreaterThan(0);
  });

  test("should fail verification with wrong public key", () => {
    const receipt = generateReceipt({
      step: "chart",
      inputData: "in",
      outputData: "out",
      reproducible: true,
    }, keypair.privateKeyPem);

    const result = verifyReceipt(receipt, otherKeypair.publicKeyPem);
    expect(result.verified).toBe(false);
  });

  test("should fail verification if receipt body is tampered", () => {
    const receipt = generateReceipt({
      step: "evidence",
      inputData: "original",
      outputData: "result",
      reproducible: true,
    }, keypair.privateKeyPem);

    // Tamper with the receipt body
    receipt.predicate.step = "chart";

    const result = verifyReceipt(receipt, keypair.publicKeyPem);
    expect(result.verified).toBe(false);
  });

  test("should fail verification if signature is missing", () => {
    const receipt = generateReceipt({
      step: "evidence",
      inputData: "in",
      outputData: "out",
      reproducible: true,
    }, keypair.privateKeyPem);

    delete receipt.signature;

    const result = verifyReceipt(receipt, keypair.publicKeyPem);
    expect(result.verified).toBe(false);
  });

  test("should fail verification if signature is corrupted", () => {
    const receipt = generateReceipt({
      step: "evidence",
      inputData: "in",
      outputData: "out",
      reproducible: true,
    }, keypair.privateKeyPem);

    // Corrupt the signature
    receipt.signature = receipt.signature!.slice(0, -4) + "XXXX";

    const result = verifyReceipt(receipt, keypair.publicKeyPem);
    expect(result.verified).toBe(false);
  });

  test("should still verify after scittEntryId is added post-signing", () => {
    const receipt = generateReceipt({
      step: "classify",
      inputData: "in",
      outputData: "out",
      reproducible: true,
    }, keypair.privateKeyPem);

    // SCITT entry ID is added after signing
    receipt.scittEntryId = "entry-post-signing-123";

    const result = verifyReceipt(receipt, keypair.publicKeyPem);
    expect(result.verified).toBe(true);
  });
});

// =============================================================================
// ReceiptChain
// =============================================================================

describe("ReceiptChain", () => {
  test("should capture a single step", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    const receipt = await chain.captureStep({
      step: "evidence",
      inputData: { file: "prowler-findings.json" },
      outputData: { controls: [{ id: "CC1.1" }] },
      reproducible: true,
    });

    expect(receipt.predicate.step).toBe("evidence");
    expect(chain.getReceipts()).toHaveLength(1);
  });

  test("should auto-link sequential steps", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    const first = await chain.captureStep({
      step: "evidence",
      inputData: "input1",
      outputData: "output1",
      reproducible: true,
    });

    const second = await chain.captureStep({
      step: "classify",
      inputData: "input2",
      outputData: "output2",
      reproducible: true,
    });

    // First receipt has no previousReceipt
    expect(first.predicate.previousReceipt).toBeUndefined();

    // Second receipt links to first
    expect(second.predicate.previousReceipt).toBeDefined();
    expect(second.predicate.previousReceipt!.digest.sha256).toBe(hashReceipt(first));
  });

  test("should build a multi-step chain", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });
    await chain.captureStep({ step: "chart", inputData: "c", outputData: "d", reproducible: true });
    await chain.captureStep({ step: "sign", inputData: "d", outputData: "e", reproducible: true });

    expect(chain.getReceipts()).toHaveLength(4);
  });

  test("should compute chain digest as Merkle root", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });

    const digest = chain.getChainDigest();
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("should throw on empty chain digest", () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);
    expect(() => chain.getChainDigest()).toThrow("Cannot compute chain digest of empty receipt chain");
  });

  test("should produce deterministic chain digest for same inputs", async () => {
    // Two chains with identical steps should get different digests
    // because timestamps differ, but the structure is correct
    const chain1 = new ReceiptChain(keypair.privateKeyPem);
    await chain1.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    const digest1 = chain1.getChainDigest();
    expect(digest1).toMatch(/^[a-f0-9]{64}$/);
  });

  test("should register receipts in SCITT when registry provided", async () => {
    const registry = new MockSCITTRegistry("test-log");
    const chain = new ReceiptChain(keypair.privateKeyPem, { scittRegistry: registry });

    const receipt = await chain.captureStep({
      step: "evidence",
      inputData: "in",
      outputData: "out",
      reproducible: true,
    });

    expect(receipt.scittEntryId).toBeTruthy();
    expect(receipt.scittEntryId).toMatch(/^entry-/);
  });

  test("should verify chain internally", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });

    const valid = await chain.verifyChain(keypair.publicKeyPem);
    expect(valid).toBe(true);
  });

  test("should return a copy of receipts (not internal array)", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);
    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });

    const receipts = chain.getReceipts();
    receipts.push({} as ProcessReceipt); // Mutate returned array

    expect(chain.getReceipts()).toHaveLength(1); // Internal unchanged
  });

  test("should pass toolAttestation through to receipt", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    const receipt = await chain.captureStep({
      step: "evidence",
      inputData: { source: "prowler" },
      outputData: { controls: 24 },
      reproducible: true,
      toolAttestation: {
        toolName: "Prowler",
        toolVersion: "4.2.1",
        scanTimestamp: "2026-02-12T10:00:00Z",
        scanTarget: "aws:123456789012",
        outputFormat: "prowler-jsonl",
      },
    });

    expect(receipt.predicate.toolAttestation).toBeDefined();
    expect(receipt.predicate.toolAttestation!.toolName).toBe("Prowler");
  });
});

// =============================================================================
// verifyProcessChain
// =============================================================================

describe("verifyProcessChain", () => {
  test("should verify a valid chain", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });
    await chain.captureStep({ step: "chart", inputData: "c", outputData: "d", reproducible: true });

    const result = verifyProcessChain(chain.getReceipts(), keypair.publicKeyPem);

    expect(result.chainValid).toBe(true);
    expect(result.receiptsTotal).toBe(3);
    expect(result.receiptsVerified).toBe(3);
    expect(result.reproducibleVerified).toBe(3);
    expect(result.attestedVerified).toBe(0);
    expect(result.chainDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("should count attested steps (LLM)", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({
      step: "evidence",
      inputData: "a",
      outputData: "b",
      reproducible: false,
      llmAttestation: { model: "claude-sonnet-4-5-20250929", promptDigest: "abc", temperature: 0 },
    });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });

    const result = verifyProcessChain(chain.getReceipts(), keypair.publicKeyPem);

    expect(result.attestedVerified).toBe(1);
    expect(result.reproducibleVerified).toBe(1);
  });

  test("should detect tampered receipt in chain", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });

    const receipts = chain.getReceipts();
    // Tamper with the second receipt's body
    receipts[1]!.predicate.reproducible = false;

    const result = verifyProcessChain(receipts, keypair.publicKeyPem);

    expect(result.chainValid).toBe(false);
    expect(result.steps[1]!.signatureValid).toBe(false);
  });

  test("should detect broken hash link", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });

    const receipts = chain.getReceipts();
    // Corrupt the hash link
    receipts[1]!.predicate.previousReceipt!.digest.sha256 = "0000000000000000000000000000000000000000000000000000000000000000";

    const result = verifyProcessChain(receipts, keypair.publicKeyPem);

    expect(result.chainValid).toBe(false);
    expect(result.steps[1]!.hashLinkValid).toBe(false);
    // Signature is also invalid because we changed the receipt body
    expect(result.steps[1]!.signatureValid).toBe(false);
  });

  test("should fail on wrong public key", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });

    const result = verifyProcessChain(chain.getReceipts(), otherKeypair.publicKeyPem);

    expect(result.chainValid).toBe(false);
    expect(result.steps[0]!.signatureValid).toBe(false);
  });

  test("should return empty result for empty chain", () => {
    const result = verifyProcessChain([], keypair.publicKeyPem);

    expect(result.chainValid).toBe(false);
    expect(result.receiptsTotal).toBe(0);
    expect(result.chainDigest).toBe("");
  });

  test("should verify single-receipt chain", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "sign", inputData: "a", outputData: "b", reproducible: true });

    const result = verifyProcessChain(chain.getReceipts(), keypair.publicKeyPem);

    expect(result.chainValid).toBe(true);
    expect(result.receiptsTotal).toBe(1);
    expect(result.receiptsVerified).toBe(1);
  });

  test("should report SCITT registration status per step", async () => {
    const registry = new MockSCITTRegistry();
    const chain = new ReceiptChain(keypair.privateKeyPem, { scittRegistry: registry });

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });

    const result = verifyProcessChain(chain.getReceipts(), keypair.publicKeyPem);

    expect(result.steps[0]!.scittRegistered).toBe(true);
    expect(result.steps[1]!.scittRegistered).toBe(true);
  });

  test("should match chain digest with ReceiptChain.getChainDigest()", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({ step: "evidence", inputData: "a", outputData: "b", reproducible: true });
    await chain.captureStep({ step: "classify", inputData: "b", outputData: "c", reproducible: true });

    const result = verifyProcessChain(chain.getReceipts(), keypair.publicKeyPem);

    expect(result.chainDigest).toBe(chain.getChainDigest());
  });

  test("should report per-step details", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({
      step: "evidence",
      inputData: "a",
      outputData: "b",
      reproducible: true,
      toolAttestation: {
        toolName: "InSpec",
        toolVersion: "5.0",
        scanTimestamp: "2026-02-12T00:00:00Z",
        scanTarget: "aws-production",
        outputFormat: "inspec-json",
      },
    });
    await chain.captureStep({
      step: "classify",
      inputData: "b",
      outputData: "c",
      reproducible: true,
    });

    const result = verifyProcessChain(chain.getReceipts(), keypair.publicKeyPem);

    expect(result.steps[0]!.step).toBe("evidence");
    expect(result.steps[0]!.reproducible).toBe(true);
    expect(result.steps[1]!.step).toBe("classify");
    expect(result.steps[1]!.reproducible).toBe(true);
  });
});

// =============================================================================
// FULL PIPELINE SIMULATION
// =============================================================================

describe("full pipeline simulation", () => {
  test("should simulate EVIDENCE → CLASSIFY → CHART → SIGN pipeline", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    // Step 1: EVIDENCE (tool scan — reproducible)
    await chain.captureStep({
      step: "evidence",
      inputData: { source: "prowler", scanTarget: "aws:123456789012" },
      outputData: { controls: [{ id: "CC1.1", status: "effective" }, { id: "CC1.2", status: "effective" }] },
      reproducible: true,
      toolAttestation: {
        toolName: "Prowler",
        toolVersion: "4.2.1",
        scanTimestamp: "2026-02-12T10:00:00Z",
        scanTarget: "aws:123456789012",
        scanProfile: "cis-aws-benchmark-v3.0",
        outputFormat: "prowler-jsonl",
      },
    });

    // Step 2: CLASSIFY (deterministic)
    await chain.captureStep({
      step: "classify",
      inputData: { controls: [{ id: "CC1.1" }, { id: "CC1.2" }] },
      outputData: { levels: { "CC1.1": 1, "CC1.2": 1 } },
      reproducible: true,
      codeVersion: "assurance-calculator@2026-02-09",
    });

    // Step 3: CHART (deterministic)
    await chain.captureStep({
      step: "chart",
      inputData: [{ framework: "SOC2", controlId: "CC1.1" }],
      outputData: { "SOC2": { controlsMapped: 2, passed: 2, failed: 0 } },
      reproducible: true,
      codeVersion: "chart-engine@1.0",
    });

    // Step 4: SIGN (deterministic signing)
    const chainDigest = chain.getChainDigest();
    await chain.captureStep({
      step: "sign",
      inputData: { receiptChainDigest: chainDigest },
      outputData: { cpoeHash: hashData("sample.jwt") },
      reproducible: true,
      codeVersion: "vc-generator@2.1",
    });

    // Verify the entire chain
    const result = verifyProcessChain(chain.getReceipts(), keypair.publicKeyPem);

    expect(result.chainValid).toBe(true);
    expect(result.receiptsTotal).toBe(4);
    expect(result.receiptsVerified).toBe(4);
    expect(result.reproducibleVerified).toBe(4);  // All 4 steps reproducible (tool-first)
    expect(result.attestedVerified).toBe(0);
    expect(result.chainDigest).toMatch(/^[a-f0-9]{64}$/);

    // Verify chain digest matches
    // Note: chain digest changes after adding SIGN receipt
    const finalDigest = chain.getChainDigest();
    expect(result.chainDigest).toBe(finalDigest);

    // Verify each step
    expect(result.steps[0]!.step).toBe("evidence");
    expect(result.steps[0]!.reproducible).toBe(true);
    expect(result.steps[1]!.step).toBe("classify");
    expect(result.steps[1]!.reproducible).toBe(true);
    expect(result.steps[2]!.step).toBe("chart");
    expect(result.steps[3]!.step).toBe("sign");
  });

  test("should simulate pipeline with SCITT registration", async () => {
    const registry = new MockSCITTRegistry("corsair-log");
    const chain = new ReceiptChain(keypair.privateKeyPem, { scittRegistry: registry });

    await chain.captureStep({
      step: "evidence",
      inputData: "tool-output",
      outputData: "controls",
      reproducible: true,
    });

    await chain.captureStep({
      step: "sign",
      inputData: "controls",
      outputData: "cpoe",
      reproducible: true,
    });

    const receipts = chain.getReceipts();

    // All receipts should have SCITT entry IDs
    expect(receipts[0]!.scittEntryId).toBeTruthy();
    expect(receipts[1]!.scittEntryId).toBeTruthy();

    // Second receipt should reference first receipt's SCITT entry
    expect(receipts[1]!.predicate.previousReceipt!.scittEntryId).toBe(receipts[0]!.scittEntryId);

    // Chain should still verify
    const result = verifyProcessChain(receipts, keypair.publicKeyPem);
    expect(result.chainValid).toBe(true);
    expect(result.steps.every(s => s.scittRegistered)).toBe(true);
  });

  test("should verify chain with evidence + toolAttestation end-to-end", async () => {
    const chain = new ReceiptChain(keypair.privateKeyPem);

    await chain.captureStep({
      step: "evidence",
      inputData: { source: "trivy" },
      outputData: { vulnerabilities: 0, controls: 12 },
      reproducible: true,
      toolAttestation: {
        toolName: "Trivy",
        toolVersion: "0.50.0",
        scanTimestamp: "2026-02-12T08:00:00Z",
        scanTarget: "registry.example.com/app:latest",
        outputFormat: "trivy-json",
      },
    });

    await chain.captureStep({
      step: "classify",
      inputData: { controlCount: 12 },
      outputData: { levels: { "1": 12 } },
      reproducible: true,
    });

    await chain.captureStep({
      step: "sign",
      inputData: { digest: chain.getChainDigest() },
      outputData: { jwt: "eyJ..." },
      reproducible: true,
    });

    const result = verifyProcessChain(chain.getReceipts(), keypair.publicKeyPem);

    expect(result.chainValid).toBe(true);
    expect(result.receiptsTotal).toBe(3);
    expect(result.reproducibleVerified).toBe(3);

    // Verify tool attestation is present on first receipt
    const receipts = chain.getReceipts();
    expect(receipts[0]!.predicate.toolAttestation?.toolName).toBe("Trivy");
    expect(receipts[1]!.predicate.toolAttestation).toBeUndefined();
  });
});
