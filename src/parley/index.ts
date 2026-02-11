/**
 * Parley Module — Trust Exchange Protocol
 *
 * JWT-VC (proof) + SCITT (log) + SSF/CAEP (signal)
 *
 * Note: This barrel export covers the process provenance subsystem.
 * Individual parley modules (vc-generator, marque-generator, etc.) are
 * imported directly to avoid circular dependency issues.
 */

export {
  type ProcessReceipt,
  type PipelineStep,
  type GenerateReceiptInput,
  hashData,
  hashReceipt,
  generateReceipt,
  verifyReceipt,
} from "./process-receipt";

export { ReceiptChain, type CaptureStepInput } from "./receipt-chain";

export {
  type ProcessVerificationResult,
  type StepVerificationResult,
  verifyProcessChain,
} from "./receipt-verifier";
