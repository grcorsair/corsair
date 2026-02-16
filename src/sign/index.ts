/**
 * Sign Module — Barrel Exports
 */

export { signEvidence, signDocument, SignError } from "./sign-core";
export type { SignInput, SignOutput, EvidenceFormat } from "./sign-core";
export { signBatch } from "./batch-sign";
export type { BatchSignOptions, BatchSignResult } from "./batch-sign";
