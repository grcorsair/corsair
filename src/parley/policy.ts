/**
 * Policy Artifacts — Portable verification policies
 *
 * A policy artifact is a signed or unsigned JSON file that encodes the
 * relying party's acceptance criteria. Policies are deterministic and
 * map directly to the verification policy engine.
 */

import type { VerificationPolicy } from "./verification-policy";

export interface PolicyArtifact extends VerificationPolicy {
  /** Policy schema version */
  version: "1.0";
  /** Human-friendly name */
  name?: string;
  /** Description of what this policy enforces */
  description?: string;
  /** Owning organization */
  owner?: string;
  /** Contact for policy questions */
  contact?: string;
  /** ISO 8601 creation timestamp */
  createdAt?: string;
}

export interface PolicyValidationResult {
  ok: boolean;
  errors: string[];
  policy?: PolicyArtifact;
}

export function validatePolicyArtifact(input: unknown): PolicyValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["policy must be a JSON object"] };
  }

  const policy = input as Record<string, unknown>;

  if (policy.version !== "1.0") {
    errors.push("policy.version must be \"1.0\"");
  }

  if (policy.name !== undefined && typeof policy.name !== "string") {
    errors.push("policy.name must be a string");
  }
  if (policy.description !== undefined && typeof policy.description !== "string") {
    errors.push("policy.description must be a string");
  }
  if (policy.owner !== undefined && typeof policy.owner !== "string") {
    errors.push("policy.owner must be a string");
  }
  if (policy.contact !== undefined && typeof policy.contact !== "string") {
    errors.push("policy.contact must be a string");
  }
  if (policy.createdAt !== undefined && typeof policy.createdAt !== "string") {
    errors.push("policy.createdAt must be an ISO 8601 string");
  }

  if (policy.requireIssuer !== undefined && typeof policy.requireIssuer !== "string") {
    errors.push("policy.requireIssuer must be a string");
  }
  if (policy.requireFramework !== undefined && !Array.isArray(policy.requireFramework)) {
    errors.push("policy.requireFramework must be an array of strings");
  }
  if (Array.isArray(policy.requireFramework) && policy.requireFramework.some((f) => typeof f !== "string")) {
    errors.push("policy.requireFramework must be an array of strings");
  }
  if (policy.maxAgeDays !== undefined && typeof policy.maxAgeDays !== "number") {
    errors.push("policy.maxAgeDays must be a number");
  }
  if (policy.minScore !== undefined && typeof policy.minScore !== "number") {
    errors.push("policy.minScore must be a number");
  }
  if (policy.requireSource !== undefined && typeof policy.requireSource !== "string") {
    errors.push("policy.requireSource must be a string");
  }
  if (policy.requireSource && !["self", "tool", "auditor"].includes(policy.requireSource as string)) {
    errors.push("policy.requireSource must be one of: self, tool, auditor");
  }
  if (policy.requireSourceIdentity !== undefined && !Array.isArray(policy.requireSourceIdentity)) {
    errors.push("policy.requireSourceIdentity must be an array of strings");
  }
  if (Array.isArray(policy.requireSourceIdentity) && policy.requireSourceIdentity.some((id) => typeof id !== "string")) {
    errors.push("policy.requireSourceIdentity must be an array of strings");
  }
  if (policy.requireToolAttestation !== undefined && typeof policy.requireToolAttestation !== "boolean") {
    errors.push("policy.requireToolAttestation must be a boolean");
  }
  if (policy.requireInputBinding !== undefined && typeof policy.requireInputBinding !== "boolean") {
    errors.push("policy.requireInputBinding must be a boolean");
  }
  if (policy.requireEvidenceChain !== undefined && typeof policy.requireEvidenceChain !== "boolean") {
    errors.push("policy.requireEvidenceChain must be a boolean");
  }
  if (policy.requireReceipts !== undefined && typeof policy.requireReceipts !== "boolean") {
    errors.push("policy.requireReceipts must be a boolean");
  }
  if (policy.requireScitt !== undefined && typeof policy.requireScitt !== "boolean") {
    errors.push("policy.requireScitt must be a boolean");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    policy: policy as PolicyArtifact,
  };
}

