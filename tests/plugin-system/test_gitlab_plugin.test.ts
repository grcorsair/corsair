/**
 * GitLab Security Review Plugin Tests
 *
 * Validates GitLab plugin manifest, type guards, factory functions,
 * fixture snapshots, and integration with Mark engine and STRIDE analysis.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, SpyglassEngine } from "../../src/corsair-mvp";
import {
  isGitLabSnapshot,
  createGitLabSnapshot,
  compliantGitLabSnapshot,
  nonCompliantGitLabSnapshot,
  GITLAB_PROVIDER_ID,
} from "../../plugins/gitlab/gitlab-plugin";
import type { GitLabSnapshot } from "../../plugins/gitlab/gitlab-plugin";

// =============================================================================
// PLUGIN MANIFEST
// =============================================================================

describe("GitLab Plugin - Manifest", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("GitLab plugin manifest has providerId gitlab", () => {
    const plugin = corsair.getPlugin("gitlab");
    expect(plugin).toBeDefined();
    expect(plugin!.manifest.providerId).toBe("gitlab");
  });

  test("GitLab plugin has providerName GitLab", () => {
    const plugin = corsair.getPlugin("gitlab");
    expect(plugin!.manifest.providerName).toBe("GitLab");
  });

  test("GitLab plugin has version 1.0.0", () => {
    const plugin = corsair.getPlugin("gitlab");
    expect(plugin!.manifest.version).toBe("1.0.0");
  });

  test("GitLab plugin has >= 5 attack vectors", () => {
    const plugin = corsair.getPlugin("gitlab");
    expect(plugin!.manifest.attackVectors.length).toBeGreaterThanOrEqual(5);
  });

  test("attack vectors include required IDs", () => {
    const plugin = corsair.getPlugin("gitlab");
    const vectorIds = plugin!.manifest.attackVectors.map((v) => v.id);
    expect(vectorIds).toContain("unprotected-branch-push");
    expect(vectorIds).toContain("secret-exposure");
    expect(vectorIds).toContain("mfa-bypass");
    expect(vectorIds).toContain("ci-pipeline-injection");
    expect(vectorIds).toContain("token-abuse");
  });

  test("plugin manifest has framework mappings for drift and attack vectors", () => {
    const plugin = corsair.getPlugin("gitlab");
    expect(plugin!.manifest.frameworkMappings).toBeDefined();
    expect(plugin!.manifest.frameworkMappings!.drift).toBeDefined();
    expect(plugin!.manifest.frameworkMappings!.attackVectors).toBeDefined();
  });

  test("plugin discovery finds gitlab", () => {
    expect(corsair.hasPlugin("gitlab")).toBe(true);
  });
});

// =============================================================================
// TYPE GUARDS
// =============================================================================

describe("GitLab Plugin - Type Guards", () => {
  test("isGitLabSnapshot validates compliant snapshot", () => {
    expect(isGitLabSnapshot(compliantGitLabSnapshot)).toBe(true);
  });

  test("isGitLabSnapshot validates non-compliant snapshot", () => {
    expect(isGitLabSnapshot(nonCompliantGitLabSnapshot)).toBe(true);
  });

  test("isGitLabSnapshot rejects null", () => {
    expect(isGitLabSnapshot(null)).toBe(false);
  });

  test("isGitLabSnapshot rejects empty object", () => {
    expect(isGitLabSnapshot({})).toBe(false);
  });

  test("isGitLabSnapshot rejects missing required fields", () => {
    expect(isGitLabSnapshot({ projectId: "123" })).toBe(false);
  });
});

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

describe("GitLab Plugin - Factory Functions", () => {
  test("createGitLabSnapshot with defaults creates valid snapshot", () => {
    const snapshot = createGitLabSnapshot({ projectId: "12345", projectName: "test-project" });
    expect(isGitLabSnapshot(snapshot)).toBe(true);
    expect(snapshot.projectId).toBe("12345");
    expect(snapshot.projectName).toBe("test-project");
    expect(snapshot.visibility).toBe("private");
    expect(snapshot.defaultBranch).toBe("main");
    expect(snapshot.branchProtection.requireApprovals).toBe(false);
    expect(snapshot.cicdSecurity.sastEnabled).toBe(false);
    expect(snapshot.accessControl.mfaEnforced).toBe(false);
  });

  test("createGitLabSnapshot applies overrides", () => {
    const snapshot = createGitLabSnapshot({
      projectId: "99999",
      projectName: "secure-app",
      visibility: "public",
      branchProtection: {
        protectedBranches: 5,
        requireApprovals: true,
        minimumApprovals: 3,
        forcePushDisabled: true,
        codeOwnerApprovalRequired: true,
      },
      cicdSecurity: {
        sastEnabled: true,
        dastEnabled: true,
        secretDetectionEnabled: true,
      },
      accessControl: {
        mfaEnforced: true,
        guestAccessEnabled: false,
      },
    });

    expect(snapshot.visibility).toBe("public");
    expect(snapshot.branchProtection.protectedBranches).toBe(5);
    expect(snapshot.branchProtection.requireApprovals).toBe(true);
    expect(snapshot.branchProtection.minimumApprovals).toBe(3);
    expect(snapshot.branchProtection.forcePushDisabled).toBe(true);
    expect(snapshot.cicdSecurity.sastEnabled).toBe(true);
    expect(snapshot.cicdSecurity.dastEnabled).toBe(true);
    expect(snapshot.cicdSecurity.secretDetectionEnabled).toBe(true);
    expect(snapshot.accessControl.mfaEnforced).toBe(true);
    expect(snapshot.accessControl.guestAccessEnabled).toBe(false);
  });
});

// =============================================================================
// FIXTURE SNAPSHOTS
// =============================================================================

describe("GitLab Plugin - Fixture Snapshots", () => {
  test("compliant GitLab snapshot has private visibility, branch protection, MFA, SAST, signed commits", () => {
    expect(compliantGitLabSnapshot.visibility).toBe("private");
    expect(compliantGitLabSnapshot.branchProtection.requireApprovals).toBe(true);
    expect(compliantGitLabSnapshot.branchProtection.forcePushDisabled).toBe(true);
    expect(compliantGitLabSnapshot.branchProtection.codeOwnerApprovalRequired).toBe(true);
    expect(compliantGitLabSnapshot.cicdSecurity.sastEnabled).toBe(true);
    expect(compliantGitLabSnapshot.cicdSecurity.dastEnabled).toBe(true);
    expect(compliantGitLabSnapshot.cicdSecurity.secretDetectionEnabled).toBe(true);
    expect(compliantGitLabSnapshot.accessControl.mfaEnforced).toBe(true);
    expect(compliantGitLabSnapshot.accessControl.guestAccessEnabled).toBe(false);
    expect(compliantGitLabSnapshot.auditSettings.signedCommitsRequired).toBe(true);
  });

  test("non-compliant GitLab snapshot has public visibility, no protection, no MFA, no SAST, unsigned commits", () => {
    expect(nonCompliantGitLabSnapshot.visibility).toBe("public");
    expect(nonCompliantGitLabSnapshot.branchProtection.requireApprovals).toBe(false);
    expect(nonCompliantGitLabSnapshot.branchProtection.forcePushDisabled).toBe(false);
    expect(nonCompliantGitLabSnapshot.cicdSecurity.sastEnabled).toBe(false);
    expect(nonCompliantGitLabSnapshot.cicdSecurity.dastEnabled).toBe(false);
    expect(nonCompliantGitLabSnapshot.cicdSecurity.secretDetectionEnabled).toBe(false);
    expect(nonCompliantGitLabSnapshot.accessControl.mfaEnforced).toBe(false);
    expect(nonCompliantGitLabSnapshot.accessControl.guestAccessEnabled).toBe(true);
    expect(nonCompliantGitLabSnapshot.auditSettings.signedCommitsRequired).toBe(false);
  });
});

// =============================================================================
// PLUGIN IDENTITY
// =============================================================================

describe("GitLab Plugin - Plugin Identity", () => {
  test("GitLab provider ID is correct", () => {
    expect(GITLAB_PROVIDER_ID).toBe("gitlab");
  });
});

// =============================================================================
// MARK ENGINE INTEGRATION
// =============================================================================

describe("GitLab Plugin - Mark Engine Integration", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("MARK detects drift on non-compliant GitLab snapshot (>= 3 findings)", async () => {
    const result = await corsair.mark(
      nonCompliantGitLabSnapshot as unknown as Record<string, unknown>,
      [
        { field: "visibility", operator: "eq", value: "private" },
        { field: "branchProtection.forcePushDisabled", operator: "eq", value: true },
        { field: "branchProtection.requireApprovals", operator: "eq", value: true },
        { field: "accessControl.mfaEnforced", operator: "eq", value: true },
        { field: "cicdSecurity.secretDetectionEnabled", operator: "eq", value: true },
      ]
    );

    expect(result.driftDetected).toBe(true);
    const driftFindings = result.findings.filter((f) => f.drift);
    expect(driftFindings.length).toBeGreaterThanOrEqual(3);
  });

  test("MARK finds no drift on compliant GitLab snapshot", async () => {
    const result = await corsair.mark(
      compliantGitLabSnapshot as unknown as Record<string, unknown>,
      [
        { field: "visibility", operator: "eq", value: "private" },
        { field: "branchProtection.forcePushDisabled", operator: "eq", value: true },
        { field: "branchProtection.requireApprovals", operator: "eq", value: true },
        { field: "accessControl.mfaEnforced", operator: "eq", value: true },
        { field: "cicdSecurity.secretDetectionEnabled", operator: "eq", value: true },
      ]
    );

    expect(result.driftDetected).toBe(false);
    expect(result.findings.every((f) => !f.drift)).toBe(true);
  });
});

// =============================================================================
// SPYGLASS INTEGRATION
// =============================================================================

describe("GitLab Plugin - SPYGLASS Integration", () => {
  test("SPYGLASS rules exist for gitlab provider (>= 3 threats)", () => {
    const engine = new SpyglassEngine();
    const result = engine.spyglassAnalyze(
      nonCompliantGitLabSnapshot as unknown as Record<string, unknown>,
      "gitlab"
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(3);
    expect(result.provider).toBe("gitlab");
    expect(result.methodology).toBe("STRIDE-automated");
  });

  test("SPYGLASS identifies CRITICAL threats on non-compliant GitLab", () => {
    const engine = new SpyglassEngine();
    const result = engine.spyglassAnalyze(
      nonCompliantGitLabSnapshot as unknown as Record<string, unknown>,
      "gitlab"
    );

    const criticalThreats = result.threats.filter((t) => t.severity === "CRITICAL");
    expect(criticalThreats.length).toBeGreaterThanOrEqual(1);
  });

  test("SPYGLASS compliant GitLab snapshot generates 0 CRITICAL threats", () => {
    const engine = new SpyglassEngine();
    const result = engine.spyglassAnalyze(
      compliantGitLabSnapshot as unknown as Record<string, unknown>,
      "gitlab"
    );

    const criticalThreats = result.threats.filter((t) => t.severity === "CRITICAL");
    expect(criticalThreats.length).toBe(0);
  });
});
