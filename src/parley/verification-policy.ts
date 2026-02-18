/**
 * Verification Policy — Optional post-verification checks
 *
 * Evaluates issuer, framework, freshness, and score constraints
 * against a decoded VC JWT payload.
 */

export interface VerificationPolicy {
  /** Require a specific issuer DID */
  requireIssuer?: string;
  /** Require one or more frameworks to be present */
  requireFramework?: string[];
  /** Maximum age in days based on provenance.sourceDate */
  maxAgeDays?: number;
  /** Minimum overall score */
  minScore?: number;
  /** Require a specific provenance source type */
  requireSource?: "self" | "tool" | "auditor";
  /** Require one of the listed source identities */
  requireSourceIdentity?: string[];
  /** Require tool attestation in process receipts */
  requireToolAttestation?: boolean;
  /** Require source document binding (hash match) */
  requireInputBinding?: boolean;
  /** Require evidence chain presence + verification */
  requireEvidenceChain?: boolean;
  /** Require process receipts and verified chain */
  requireReceipts?: boolean;
  /** Require SCITT entry IDs */
  requireScitt?: boolean;
}

export interface PolicyEvaluationResult {
  ok: boolean;
  errors: string[];
}

export interface VerificationPolicyContext {
  process?: {
    chainValid: boolean;
    receiptsTotal: number;
    receiptsVerified: number;
    toolAttestedVerified?: number;
    scittRegistered?: number;
  } | null;
  evidence?: {
    ok: boolean;
    errors?: string[];
  } | null;
  inputBinding?: {
    ok: boolean;
    errors: string[];
  } | null;
}

export function evaluateVerificationPolicy(
  payload: Record<string, unknown>,
  policy: VerificationPolicy,
  context?: VerificationPolicyContext,
): PolicyEvaluationResult {
  const errors: string[] = [];

  const issuer = payload.iss as string | undefined;
  const vc = payload.vc as Record<string, unknown> | undefined;
  const cs = vc?.credentialSubject as Record<string, unknown> | undefined;
  const provenance = cs?.provenance as { source?: string; sourceIdentity?: string; sourceDocument?: string } | undefined;
  const processProvenance = cs?.processProvenance as {
    receiptCount?: number;
    chainVerified?: boolean;
    toolAttestedSteps?: number;
    scittEntryIds?: string[];
  } | undefined;
  const evidenceChain = cs?.evidenceChain as { chainVerified?: boolean } | undefined;

  if (policy.requireIssuer && issuer !== policy.requireIssuer) {
    errors.push(`issuer mismatch: expected ${policy.requireIssuer}`);
  }

  if (policy.requireFramework && policy.requireFramework.length > 0) {
    const frameworks = cs?.frameworks as Record<string, unknown> | undefined;
    const present = frameworks ? Object.keys(frameworks) : [];
    for (const fw of policy.requireFramework) {
      if (!present.includes(fw)) {
        errors.push(`missing required framework: ${fw}`);
      }
    }
  }

  if (policy.minScore !== undefined) {
    const summary = cs?.summary as { overallScore?: number } | undefined;
    if (typeof summary?.overallScore !== "number") {
      errors.push("missing overallScore for policy check");
    } else if (summary.overallScore < policy.minScore) {
      errors.push(`overallScore ${summary.overallScore} below minimum ${policy.minScore}`);
    }
  }

  if (policy.maxAgeDays !== undefined) {
    const provenanceForAge = cs?.provenance as { sourceDate?: string } | undefined;
    const sourceDate = provenanceForAge?.sourceDate;
    if (!sourceDate) {
      errors.push("missing provenance.sourceDate for age check");
    } else {
      const date = new Date(sourceDate);
      if (Number.isNaN(date.getTime())) {
        errors.push("invalid provenance.sourceDate for age check");
      } else {
        const ageDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays > policy.maxAgeDays) {
          errors.push(`evidence age ${ageDays}d exceeds max ${policy.maxAgeDays}d`);
        }
      }
    }
  }

  if (policy.requireSource) {
    const source = provenance?.source;
    if (!source) {
      errors.push("missing provenance.source for policy check");
    } else if (source !== policy.requireSource) {
      errors.push(`source mismatch: expected ${policy.requireSource}`);
    }
  }

  if (policy.requireSourceIdentity && policy.requireSourceIdentity.length > 0) {
    const identity = provenance?.sourceIdentity;
    if (!identity) {
      errors.push("missing provenance.sourceIdentity for policy check");
    } else if (!policy.requireSourceIdentity.includes(identity)) {
      errors.push(`sourceIdentity not allowed: ${identity}`);
    }
  }

  if (policy.requireToolAttestation) {
    const toolAttested = typeof processProvenance?.toolAttestedSteps === "number"
      ? processProvenance.toolAttestedSteps > 0
      : (context?.process?.toolAttestedVerified ?? 0) > 0;
    if (!toolAttested) {
      errors.push("missing tool attestation in process receipts");
    }
  }

  if (policy.requireInputBinding) {
    if (!provenance?.sourceDocument) {
      errors.push("missing provenance.sourceDocument for input binding");
    }
    if (context?.inputBinding) {
      if (!context.inputBinding.ok) {
        errors.push(...context.inputBinding.errors);
      }
    } else {
      errors.push("input binding not verified (provide sourceDocumentHash or --source-document)");
    }
  }

  if (policy.requireEvidenceChain) {
    if (!evidenceChain) {
      errors.push("missing evidenceChain for policy check");
    } else if (evidenceChain.chainVerified === false) {
      errors.push("evidenceChain.chainVerified is false");
    }
    if (context?.evidence) {
      if (!context.evidence.ok) {
        if (context.evidence.errors?.length) {
          errors.push(...context.evidence.errors);
        } else {
          errors.push("evidence chain verification failed");
        }
      }
    } else {
      errors.push("evidence chain not verified (provide --evidence)");
    }
  }

  if (policy.requireReceipts) {
    if (!processProvenance) {
      errors.push("missing processProvenance for policy check");
    }
    if (context?.process) {
      if (!context.process.chainValid) {
        errors.push("process receipts chain invalid");
      }
    } else {
      errors.push("process receipts not verified (provide receipts)");
    }
  }

  if (policy.requireScitt) {
    const scittIds = processProvenance?.scittEntryIds;
    if (!scittIds || scittIds.length === 0) {
      errors.push("missing SCITT entry IDs in processProvenance");
    }
    if (context?.process) {
      if ((context.process.scittRegistered ?? 0) < context.process.receiptsTotal) {
        errors.push("not all process receipts are SCITT-registered");
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
