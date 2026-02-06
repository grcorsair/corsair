/**
 * AWS IAM Plugin for Corsair
 *
 * This plugin provides:
 * - IAM-specific type definitions and snapshot interface
 * - Type guards for runtime validation
 * - Factory functions for creating valid snapshots
 * - Compliant and non-compliant fixture snapshots
 * - Plugin metadata for registration
 */

// ===============================================================================
// PLUGIN IDENTITY
// ===============================================================================

/**
 * Unique identifier for this plugin.
 * Used by Corsair core for plugin registration and dispatch.
 */
export const IAM_PROVIDER_ID = "aws-iam";

// ===============================================================================
// IAM-SPECIFIC TYPE DEFINITIONS
// ===============================================================================

/**
 * Complete snapshot of an AWS account's IAM security configuration.
 * This is the primary type for RECON operations against IAM.
 */
export interface IAMSnapshot {
  /** AWS account ID */
  accountId: string;
  /** Whether MFA is enabled for IAM users */
  mfaEnabled: boolean;
  /** Whether any policies grant excessive permissions (e.g., * actions) */
  hasOverprivilegedPolicies: boolean;
  /** Whether unused credentials exist (access keys, passwords inactive 90+ days) */
  unusedCredentialsExist: boolean;
  /** Whether access keys have been rotated within policy period */
  accessKeysRotated: boolean;
  /** Whether MFA is enabled on the root account */
  rootAccountMfaEnabled: boolean;
  /** Total number of IAM users */
  users: number;
  /** Total number of IAM roles */
  roles: number;
  /** Total number of IAM policies */
  policies: number;
  /** ISO-8601 timestamp when snapshot was taken */
  observedAt: string;
}

// ===============================================================================
// TYPE GUARDS (Runtime Validation)
// ===============================================================================

/**
 * Main type guard for IAMSnapshot.
 * Validates all required fields are present and correctly typed.
 */
export function isIAMSnapshot(obj: unknown): obj is IAMSnapshot {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const snapshot = obj as Record<string, unknown>;

  return (
    typeof snapshot.accountId === "string" &&
    typeof snapshot.mfaEnabled === "boolean" &&
    typeof snapshot.hasOverprivilegedPolicies === "boolean" &&
    typeof snapshot.unusedCredentialsExist === "boolean" &&
    typeof snapshot.accessKeysRotated === "boolean" &&
    typeof snapshot.rootAccountMfaEnabled === "boolean" &&
    typeof snapshot.users === "number" &&
    typeof snapshot.roles === "number" &&
    typeof snapshot.policies === "number" &&
    typeof snapshot.observedAt === "string"
  );
}

// ===============================================================================
// FACTORY FUNCTIONS
// ===============================================================================

/**
 * Options for creating an IAMSnapshot.
 * Only accountId is mandatory; others have sensible defaults.
 */
export interface CreateIAMSnapshotOptions {
  accountId: string;
  mfaEnabled?: boolean;
  hasOverprivilegedPolicies?: boolean;
  unusedCredentialsExist?: boolean;
  accessKeysRotated?: boolean;
  rootAccountMfaEnabled?: boolean;
  users?: number;
  roles?: number;
  policies?: number;
}

/**
 * Factory function to create a valid IAMSnapshot with sensible defaults.
 * Use this when programmatically creating snapshots for testing or simulation.
 */
export function createIAMSnapshot(options: CreateIAMSnapshotOptions): IAMSnapshot {
  return {
    accountId: options.accountId,
    mfaEnabled: options.mfaEnabled ?? false,
    hasOverprivilegedPolicies: options.hasOverprivilegedPolicies ?? false,
    unusedCredentialsExist: options.unusedCredentialsExist ?? false,
    accessKeysRotated: options.accessKeysRotated ?? true,
    rootAccountMfaEnabled: options.rootAccountMfaEnabled ?? false,
    users: options.users ?? 10,
    roles: options.roles ?? 5,
    policies: options.policies ?? 15,
    observedAt: new Date().toISOString(),
  };
}

// ===============================================================================
// FIXTURE SNAPSHOTS
// ===============================================================================

/**
 * Compliant IAM snapshot - MFA enabled, least privilege, rotated keys, no unused creds.
 */
export const compliantIAMSnapshot: IAMSnapshot = {
  accountId: "123456789012",
  mfaEnabled: true,
  hasOverprivilegedPolicies: false,
  unusedCredentialsExist: false,
  accessKeysRotated: true,
  rootAccountMfaEnabled: true,
  users: 25,
  roles: 15,
  policies: 40,
  observedAt: new Date().toISOString(),
};

/**
 * Non-compliant IAM snapshot - No MFA, overprivileged, stale keys, unused creds.
 */
export const nonCompliantIAMSnapshot: IAMSnapshot = {
  accountId: "987654321098",
  mfaEnabled: false,
  hasOverprivilegedPolicies: true,
  unusedCredentialsExist: true,
  accessKeysRotated: false,
  rootAccountMfaEnabled: false,
  users: 50,
  roles: 30,
  policies: 120,
  observedAt: new Date().toISOString(),
};

// ===============================================================================
// PLUGIN METADATA
// ===============================================================================

/**
 * Plugin metadata for registration with Corsair core.
 */
export const pluginMetadata = {
  id: IAM_PROVIDER_ID,
  name: "AWS IAM",
  version: "1.0.0",
  description: "Corsair plugin for AWS IAM security configuration",
  supportedVectors: [
    "overprivileged-role",
    "unused-credentials",
    "missing-mfa",
    "policy-escalation",
  ] as const,
};

/**
 * Export types for external consumers who want TypeScript support.
 */
export type {
  IAMSnapshot as IAMSnapshotType,
};
