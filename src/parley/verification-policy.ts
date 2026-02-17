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
}

export interface PolicyEvaluationResult {
  ok: boolean;
  errors: string[];
}

export function evaluateVerificationPolicy(
  payload: Record<string, unknown>,
  policy: VerificationPolicy,
): PolicyEvaluationResult {
  const errors: string[] = [];

  const issuer = payload.iss as string | undefined;
  const vc = payload.vc as Record<string, unknown> | undefined;
  const cs = vc?.credentialSubject as Record<string, unknown> | undefined;

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
    const provenance = cs?.provenance as { sourceDate?: string } | undefined;
    const sourceDate = provenance?.sourceDate;
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

  return {
    ok: errors.length === 0,
    errors,
  };
}
