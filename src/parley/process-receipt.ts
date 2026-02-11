/**
 * Process Receipt — in-toto/SLSA Provenance for Pipeline Steps
 *
 * Each pipeline step (ingest, classify, chart, quarter, marque) produces a
 * COSE-signed receipt following in-toto Statement v1 and SLSA Provenance v1.
 * Receipts form a hash-linked chain registered in SCITT.
 *
 * Standards adopted (formats only, zero new dependencies):
 * - in-toto Statement v1 (CNCF) — envelope format
 * - SLSA Provenance v1 (OpenSSF) — predicate schema
 * - COSE_Sign1 (RFC 9052) — receipt signatures (via cose.ts)
 *
 * Zero new dependencies.
 */

import * as crypto from "crypto";
import { coseSign1, coseVerify1 } from "./cose";
import { sortKeysDeep } from "./marque-generator";

// =============================================================================
// TYPES
// =============================================================================

export type PipelineStep = "ingest" | "classify" | "chart" | "quarter" | "marque";

export interface ProcessReceipt {
  _type: "https://in-toto.io/Statement/v1";
  subject: [{ name: string; digest: { sha256: string } }];
  predicateType: "https://grcorsair.com/provenance/v1";
  predicate: {
    step: PipelineStep;
    builder: {
      id: string;
      version: string;
      codeDigest?: { sha256: string };
      keyAttestation?: {
        type: string;
        provider: string;
        nonExportable: boolean;
      };
    };
    reproducible: boolean;
    materials: [{ uri: string; digest: { sha256: string } }];
    llmAttestation?: {
      model: string;
      promptDigest: { sha256: string };
      temperature: number;
    };
    previousReceipt?: {
      digest: { sha256: string };
      scittEntryId?: string;
    };
    metadata: {
      startedOn: string;
      finishedOn: string;
    };
  };
  signature?: string;
  scittEntryId?: string;
}

// =============================================================================
// HASHING
// =============================================================================

/**
 * Compute SHA-256 hash of data using canonical JSON (sorted keys).
 * Returns hex-encoded hash string.
 */
export function hashData(data: unknown): string {
  const canonical = JSON.stringify(sortKeysDeep(data));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Compute SHA-256 hash of a receipt body (excluding signature and scittEntryId).
 * These fields are added post-signing and must not be part of the hash.
 */
export function hashReceipt(receipt: ProcessReceipt): string {
  const { signature: _sig, scittEntryId: _scitt, ...body } = receipt;
  return hashData(body);
}

// =============================================================================
// RECEIPT GENERATION
// =============================================================================

export interface GenerateReceiptInput {
  step: PipelineStep;
  inputData: unknown;
  outputData: unknown;
  reproducible: boolean;
  codeVersion?: string;
  codeDigest?: string;
  llmAttestation?: {
    model: string;
    promptDigest: string;
    temperature: number;
  };
  previousReceipt?: ProcessReceipt;
  keyAttestation?: {
    type: string;
    provider: string;
    nonExportable: boolean;
  };
}

/**
 * Generate a signed ProcessReceipt for a pipeline step.
 *
 * 1. Builds in-toto Statement v1 envelope with SLSA predicate
 * 2. Computes SHA-256 of the receipt body (without signature)
 * 3. Signs with COSE_Sign1 (Ed25519)
 * 4. Attaches base64-encoded signature
 */
export function generateReceipt(
  input: GenerateReceiptInput,
  privateKeyPem: string,
): ProcessReceipt {
  const inputHash = hashData(input.inputData);
  const outputHash = hashData(input.outputData);
  const now = new Date().toISOString();

  // Build builder object
  const builder: ProcessReceipt["predicate"]["builder"] = {
    id: "https://grcorsair.com/pipeline/v1",
    version: input.codeVersion || "unknown",
  };
  if (input.codeDigest) {
    builder.codeDigest = { sha256: input.codeDigest };
  }
  if (input.keyAttestation) {
    builder.keyAttestation = input.keyAttestation;
  }

  // Build receipt without signature
  const receipt: ProcessReceipt = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{
      name: `${input.step}-output`,
      digest: { sha256: outputHash },
    }],
    predicateType: "https://grcorsair.com/provenance/v1",
    predicate: {
      step: input.step,
      builder,
      reproducible: input.reproducible,
      materials: [{
        uri: `${input.step}-input`,
        digest: { sha256: inputHash },
      }],
      metadata: {
        startedOn: now,
        finishedOn: now,
      },
    },
  };

  // Optional LLM attestation
  if (input.llmAttestation) {
    receipt.predicate.llmAttestation = {
      model: input.llmAttestation.model,
      promptDigest: { sha256: input.llmAttestation.promptDigest },
      temperature: input.llmAttestation.temperature,
    };
  }

  // Optional link to previous receipt
  if (input.previousReceipt) {
    receipt.predicate.previousReceipt = {
      digest: { sha256: hashReceipt(input.previousReceipt) },
    };
    if (input.previousReceipt.scittEntryId) {
      receipt.predicate.previousReceipt.scittEntryId = input.previousReceipt.scittEntryId;
    }
  }

  // Sign: COSE_Sign1 over the receipt hash
  const receiptHashHex = hashReceipt(receipt);
  const payload = Buffer.from(receiptHashHex, "hex");
  const coseBytes = coseSign1(payload, privateKeyPem);
  receipt.signature = coseBytes.toString("base64");

  return receipt;
}

// =============================================================================
// RECEIPT VERIFICATION
// =============================================================================

/**
 * Verify a ProcessReceipt's COSE_Sign1 signature.
 *
 * 1. Strips post-signing fields (signature, scittEntryId)
 * 2. Recomputes the receipt hash
 * 3. Verifies COSE_Sign1 signature against the public key
 * 4. Confirms the signed payload matches the receipt hash
 */
export function verifyReceipt(
  receipt: ProcessReceipt,
  publicKeyPem: string,
): { verified: boolean; payload: Buffer } {
  if (!receipt.signature) {
    return { verified: false, payload: Buffer.alloc(0) };
  }

  const expectedHash = hashReceipt(receipt);
  const expectedPayload = Buffer.from(expectedHash, "hex");

  const coseBytes = Buffer.from(receipt.signature, "base64");
  const result = coseVerify1(coseBytes, publicKeyPem);

  if (!result.verified) {
    return { verified: false, payload: Buffer.alloc(0) };
  }

  // Verify the signed payload matches the expected receipt hash
  if (!result.payload.equals(expectedPayload)) {
    return { verified: false, payload: Buffer.alloc(0) };
  }

  return { verified: true, payload: result.payload };
}
