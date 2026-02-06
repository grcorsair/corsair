/**
 * GitLab Security Review Plugin for Corsair
 *
 * This plugin provides:
 * - GitLab-specific type definitions and snapshot interface
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
export const GITLAB_PROVIDER_ID = "gitlab";

// ===============================================================================
// GITLAB-SPECIFIC TYPE DEFINITIONS
// ===============================================================================

/**
 * Complete snapshot of a GitLab project's security configuration.
 * This is the primary type for RECON operations against GitLab.
 */
export interface GitLabSnapshot {
  projectId: string;
  projectName: string;
  visibility: "public" | "internal" | "private";
  defaultBranch: string;
  branchProtection: {
    protectedBranches: number;
    requireApprovals: boolean;
    minimumApprovals: number;
    forcePushDisabled: boolean;
    codeOwnerApprovalRequired: boolean;
  };
  cicdSecurity: {
    secretVariablesCount: number;
    maskedVariables: boolean;
    protectedVariables: boolean;
    sastEnabled: boolean;
    dastEnabled: boolean;
    secretDetectionEnabled: boolean;
    containerScanningEnabled: boolean;
  };
  accessControl: {
    mfaEnforced: boolean;
    accessTokenCount: number;
    deployTokenCount: number;
    maxTokenAge: number | null; // days, null if no policy
    guestAccessEnabled: boolean;
  };
  mergeRequestSettings: {
    approvalsRequired: number;
    removeApprovalsOnPush: boolean;
    requireCodeOwnerApproval: boolean;
    mergeMethodFastForwardOnly: boolean;
    squashOption: "always" | "default_on" | "default_off" | "never";
  };
  auditSettings: {
    auditEventsEnabled: boolean;
    externalAuditDestination: boolean;
    signedCommitsRequired: boolean;
  };
  observedAt: string;
}

// ===============================================================================
// TYPE GUARDS (Runtime Validation)
// ===============================================================================

/**
 * Main type guard for GitLabSnapshot.
 * Validates all required fields are present and correctly typed.
 */
export function isGitLabSnapshot(obj: unknown): obj is GitLabSnapshot {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const snapshot = obj as Record<string, unknown>;

  return (
    typeof snapshot.projectId === "string" &&
    typeof snapshot.projectName === "string" &&
    (snapshot.visibility === "public" || snapshot.visibility === "internal" || snapshot.visibility === "private") &&
    typeof snapshot.defaultBranch === "string" &&
    typeof snapshot.branchProtection === "object" && snapshot.branchProtection !== null &&
    typeof snapshot.cicdSecurity === "object" && snapshot.cicdSecurity !== null &&
    typeof snapshot.accessControl === "object" && snapshot.accessControl !== null &&
    typeof snapshot.mergeRequestSettings === "object" && snapshot.mergeRequestSettings !== null &&
    typeof snapshot.auditSettings === "object" && snapshot.auditSettings !== null &&
    typeof snapshot.observedAt === "string"
  );
}

// ===============================================================================
// FACTORY FUNCTIONS
// ===============================================================================

/**
 * Options for creating a GitLabSnapshot.
 * Only projectId and projectName are mandatory; others have sensible defaults.
 */
export interface CreateGitLabSnapshotOptions {
  projectId: string;
  projectName: string;
  visibility?: "public" | "internal" | "private";
  defaultBranch?: string;
  branchProtection?: Partial<GitLabSnapshot["branchProtection"]>;
  cicdSecurity?: Partial<GitLabSnapshot["cicdSecurity"]>;
  accessControl?: Partial<GitLabSnapshot["accessControl"]>;
  mergeRequestSettings?: Partial<GitLabSnapshot["mergeRequestSettings"]>;
  auditSettings?: Partial<GitLabSnapshot["auditSettings"]>;
}

/**
 * Factory function to create a valid GitLabSnapshot with sensible defaults.
 * Use this when programmatically creating snapshots for testing or simulation.
 */
export function createGitLabSnapshot(options: CreateGitLabSnapshotOptions): GitLabSnapshot {
  return {
    projectId: options.projectId,
    projectName: options.projectName,
    visibility: options.visibility ?? "private",
    defaultBranch: options.defaultBranch ?? "main",
    branchProtection: {
      protectedBranches: options.branchProtection?.protectedBranches ?? 0,
      requireApprovals: options.branchProtection?.requireApprovals ?? false,
      minimumApprovals: options.branchProtection?.minimumApprovals ?? 0,
      forcePushDisabled: options.branchProtection?.forcePushDisabled ?? false,
      codeOwnerApprovalRequired: options.branchProtection?.codeOwnerApprovalRequired ?? false,
    },
    cicdSecurity: {
      secretVariablesCount: options.cicdSecurity?.secretVariablesCount ?? 0,
      maskedVariables: options.cicdSecurity?.maskedVariables ?? false,
      protectedVariables: options.cicdSecurity?.protectedVariables ?? false,
      sastEnabled: options.cicdSecurity?.sastEnabled ?? false,
      dastEnabled: options.cicdSecurity?.dastEnabled ?? false,
      secretDetectionEnabled: options.cicdSecurity?.secretDetectionEnabled ?? false,
      containerScanningEnabled: options.cicdSecurity?.containerScanningEnabled ?? false,
    },
    accessControl: {
      mfaEnforced: options.accessControl?.mfaEnforced ?? false,
      accessTokenCount: options.accessControl?.accessTokenCount ?? 0,
      deployTokenCount: options.accessControl?.deployTokenCount ?? 0,
      maxTokenAge: options.accessControl?.maxTokenAge ?? null,
      guestAccessEnabled: options.accessControl?.guestAccessEnabled ?? false,
    },
    mergeRequestSettings: {
      approvalsRequired: options.mergeRequestSettings?.approvalsRequired ?? 0,
      removeApprovalsOnPush: options.mergeRequestSettings?.removeApprovalsOnPush ?? false,
      requireCodeOwnerApproval: options.mergeRequestSettings?.requireCodeOwnerApproval ?? false,
      mergeMethodFastForwardOnly: options.mergeRequestSettings?.mergeMethodFastForwardOnly ?? false,
      squashOption: options.mergeRequestSettings?.squashOption ?? "default_off",
    },
    auditSettings: {
      auditEventsEnabled: options.auditSettings?.auditEventsEnabled ?? false,
      externalAuditDestination: options.auditSettings?.externalAuditDestination ?? false,
      signedCommitsRequired: options.auditSettings?.signedCommitsRequired ?? false,
    },
    observedAt: new Date().toISOString(),
  };
}

// ===============================================================================
// FIXTURE SNAPSHOTS
// ===============================================================================

/**
 * Compliant GitLab snapshot - private repo, branch protection on, MFA enforced,
 * SAST+DAST+secret detection enabled, 2+ approvals, signed commits required.
 */
export const compliantGitLabSnapshot: GitLabSnapshot = {
  projectId: "12345",
  projectName: "secure-production-app",
  visibility: "private",
  defaultBranch: "main",
  branchProtection: {
    protectedBranches: 3,
    requireApprovals: true,
    minimumApprovals: 2,
    forcePushDisabled: true,
    codeOwnerApprovalRequired: true,
  },
  cicdSecurity: {
    secretVariablesCount: 8,
    maskedVariables: true,
    protectedVariables: true,
    sastEnabled: true,
    dastEnabled: true,
    secretDetectionEnabled: true,
    containerScanningEnabled: true,
  },
  accessControl: {
    mfaEnforced: true,
    accessTokenCount: 3,
    deployTokenCount: 2,
    maxTokenAge: 90,
    guestAccessEnabled: false,
  },
  mergeRequestSettings: {
    approvalsRequired: 2,
    removeApprovalsOnPush: true,
    requireCodeOwnerApproval: true,
    mergeMethodFastForwardOnly: true,
    squashOption: "always",
  },
  auditSettings: {
    auditEventsEnabled: true,
    externalAuditDestination: true,
    signedCommitsRequired: true,
  },
  observedAt: new Date().toISOString(),
};

/**
 * Non-compliant GitLab snapshot - public repo, no branch protection,
 * MFA not enforced, no SAST/DAST, no approvals, guest access enabled, unsigned commits.
 */
export const nonCompliantGitLabSnapshot: GitLabSnapshot = {
  projectId: "99999",
  projectName: "legacy-open-source-fork",
  visibility: "public",
  defaultBranch: "master",
  branchProtection: {
    protectedBranches: 0,
    requireApprovals: false,
    minimumApprovals: 0,
    forcePushDisabled: false,
    codeOwnerApprovalRequired: false,
  },
  cicdSecurity: {
    secretVariablesCount: 12,
    maskedVariables: false,
    protectedVariables: false,
    sastEnabled: false,
    dastEnabled: false,
    secretDetectionEnabled: false,
    containerScanningEnabled: false,
  },
  accessControl: {
    mfaEnforced: false,
    accessTokenCount: 15,
    deployTokenCount: 8,
    maxTokenAge: null,
    guestAccessEnabled: true,
  },
  mergeRequestSettings: {
    approvalsRequired: 0,
    removeApprovalsOnPush: false,
    requireCodeOwnerApproval: false,
    mergeMethodFastForwardOnly: false,
    squashOption: "never",
  },
  auditSettings: {
    auditEventsEnabled: false,
    externalAuditDestination: false,
    signedCommitsRequired: false,
  },
  observedAt: new Date().toISOString(),
};

// ===============================================================================
// PLUGIN METADATA
// ===============================================================================

/**
 * Plugin metadata for registration with Corsair core.
 */
export const pluginMetadata = {
  id: GITLAB_PROVIDER_ID,
  name: "GitLab",
  version: "1.0.0",
  description: "Corsair plugin for GitLab security review",
  supportedVectors: [
    "unprotected-branch-push",
    "secret-exposure",
    "mfa-bypass",
    "ci-pipeline-injection",
    "token-abuse",
  ] as const,
};

/**
 * Export types for external consumers who want TypeScript support.
 */
export type {
  GitLabSnapshot as GitLabSnapshotType,
};
