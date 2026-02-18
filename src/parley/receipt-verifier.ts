/**
 * Receipt Verifier — Process Chain Verification
 *
 * Verifies a chain of ProcessReceipts:
 * 1. COSE_Sign1 signature on each receipt (Ed25519)
 * 2. Hash linking: each receipt's previousReceipt.digest matches the previous receipt's hash
 * 3. Temporal ordering: each step starts after the previous step finishes
 * 4. Merkle root computation for comparison against CPOE's processProvenance.chainDigest
 */

import { verifyReceipt, hashReceipt } from "./process-receipt";
import type { ProcessReceipt } from "./process-receipt";
import { computeRootHash } from "./merkle";

// =============================================================================
// TYPES
// =============================================================================

export interface StepVerificationResult {
  step: string;
  signatureValid: boolean;
  hashLinkValid: boolean;
  temporalValid: boolean;
  reproducible: boolean;
  toolAttested: boolean;
  scittRegistered: boolean;
}

export interface ProcessVerificationResult {
  chainValid: boolean;
  receiptsVerified: number;
  receiptsTotal: number;
  reproducibleVerified: number;
  attestedVerified: number;
  toolAttestedVerified: number;
  scittRegistered: number;
  chainDigest: string;
  steps: StepVerificationResult[];
}

// =============================================================================
// CHAIN VERIFICATION
// =============================================================================

/**
 * Verify an entire process receipt chain.
 *
 * Returns per-step results and an overall chain validity flag.
 * The chain is valid if and only if ALL steps have valid signatures
 * AND valid hash links AND valid temporal ordering.
 */
export function verifyProcessChain(
  receipts: ProcessReceipt[],
  publicKeyPem: string,
): ProcessVerificationResult {
  if (receipts.length === 0) {
    return {
      chainValid: false,
      receiptsVerified: 0,
      receiptsTotal: 0,
      reproducibleVerified: 0,
      attestedVerified: 0,
      chainDigest: "",
      steps: [],
    };
  }

  const steps: StepVerificationResult[] = [];
  let allValid = true;
  let reproducibleCount = 0;
  let attestedCount = 0;
  let toolAttestedCount = 0;
  let scittCount = 0;

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i]!;

    // 1. Verify COSE_Sign1 signature
    const sigResult = verifyReceipt(receipt, publicKeyPem);

    // 2. Verify hash link to previous receipt
    let hashLinkValid: boolean;
    if (i === 0) {
      // First receipt should not have a previousReceipt reference
      hashLinkValid = !receipt.predicate.previousReceipt;
    } else {
      const prevReceipt = receipts[i - 1]!;
      const expectedPrevHash = hashReceipt(prevReceipt);
      hashLinkValid = receipt.predicate.previousReceipt?.digest.sha256 === expectedPrevHash;
    }

    // 3. Check temporal ordering
    let temporalValid = true;
    if (i > 0) {
      const prevFinished = new Date(receipts[i - 1]!.predicate.metadata.finishedOn);
      const currentStarted = new Date(receipt.predicate.metadata.startedOn);
      temporalValid = currentStarted >= prevFinished;
    }

    const stepValid = sigResult.verified && hashLinkValid && temporalValid;
    if (!stepValid) allValid = false;

    if (receipt.predicate.reproducible && sigResult.verified) reproducibleCount++;
    if (receipt.predicate.llmAttestation && sigResult.verified) attestedCount++;
    if (receipt.predicate.toolAttestation && sigResult.verified) toolAttestedCount++;
    if (receipt.scittEntryId) scittCount++;

    steps.push({
      step: receipt.predicate.step,
      signatureValid: sigResult.verified,
      hashLinkValid,
      temporalValid,
      reproducible: receipt.predicate.reproducible,
      toolAttested: !!receipt.predicate.toolAttestation,
      scittRegistered: !!receipt.scittEntryId,
    });
  }

  const leafHashes = receipts.map(r => hashReceipt(r));
  const chainDigest = computeRootHash(leafHashes);

  return {
    chainValid: allValid,
    receiptsVerified: steps.filter(s => s.signatureValid && s.hashLinkValid && s.temporalValid).length,
    receiptsTotal: receipts.length,
    reproducibleVerified: reproducibleCount,
    attestedVerified: attestedCount,
    toolAttestedVerified: toolAttestedCount,
    scittRegistered: scittCount,
    chainDigest,
    steps,
  };
}
