/**
 * Receipt Chain — Pipeline Step Accumulator
 *
 * Wraps the ingestion pipeline to capture a ProcessReceipt at each step.
 * Each receipt is hash-linked to the previous one, forming a verifiable chain.
 * Optionally registers each receipt in SCITT for transparency.
 *
 * Usage:
 *   const chain = new ReceiptChain(privateKeyPem);
 *   await chain.captureStep({ step: "ingest", inputData, outputData, reproducible: false, ... });
 *   await chain.captureStep({ step: "classify", inputData, outputData, reproducible: true, ... });
 *   const digest = chain.getChainDigest();  // Merkle root of all receipt hashes
 */

import { generateReceipt, hashReceipt } from "./process-receipt";
import type { ProcessReceipt, PipelineStep } from "./process-receipt";
import { computeRootHash } from "./merkle";
import type { SCITTRegistry } from "./scitt-types";

// =============================================================================
// TYPES
// =============================================================================

export interface CaptureStepInput {
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
  keyAttestation?: {
    type: string;
    provider: string;
    nonExportable: boolean;
  };
}

// =============================================================================
// RECEIPT CHAIN
// =============================================================================

export class ReceiptChain {
  private receipts: ProcessReceipt[] = [];
  private privateKeyPem: string;
  private scittRegistry?: SCITTRegistry;

  constructor(privateKeyPem: string, options?: { scittRegistry?: SCITTRegistry }) {
    this.privateKeyPem = privateKeyPem;
    this.scittRegistry = options?.scittRegistry;
  }

  /**
   * Capture a pipeline step as a signed ProcessReceipt.
   *
   * Automatically links to the previous receipt in the chain.
   * If a SCITT registry is configured, registers the receipt and
   * attaches the entry ID.
   */
  async captureStep(config: CaptureStepInput): Promise<ProcessReceipt> {
    const previousReceipt = this.receipts.length > 0
      ? this.receipts[this.receipts.length - 1]
      : undefined;

    const receipt = generateReceipt({
      ...config,
      previousReceipt,
    }, this.privateKeyPem);

    // Register in SCITT if registry is available
    if (this.scittRegistry) {
      const registration = await this.scittRegistry.register(JSON.stringify(receipt));
      if (registration.status === "registered") {
        receipt.scittEntryId = registration.entryId;
      }
    }

    this.receipts.push(receipt);
    return receipt;
  }

  /** Get a copy of all receipts in the chain. */
  getReceipts(): ProcessReceipt[] {
    return [...this.receipts];
  }

  /**
   * Compute the chain digest — Merkle root of all receipt hashes.
   * This becomes the `processProvenance.chainDigest` in the CPOE.
   *
   * @throws If the chain is empty
   */
  getChainDigest(): string {
    if (this.receipts.length === 0) {
      throw new Error("Cannot compute chain digest of empty receipt chain");
    }
    const leafHashes = this.receipts.map(r => hashReceipt(r));
    return computeRootHash(leafHashes);
  }

  /**
   * Verify the entire chain: all signatures valid and all hash links intact.
   */
  async verifyChain(publicKeyPem: string): Promise<boolean> {
    const { verifyProcessChain } = await import("./receipt-verifier");
    const result = verifyProcessChain(this.receipts, publicKeyPem);
    return result.chainValid;
  }
}
