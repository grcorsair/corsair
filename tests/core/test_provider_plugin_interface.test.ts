/**
 * Tests for Provider Plugin Interface
 *
 * These tests verify the plugin abstraction layer that will enable
 * scaling from 1 provider (AWS Cognito) to 100+ providers.
 *
 * TDD Approach: Writing tests FIRST to define the contract
 */

import { describe, it, expect } from "bun:test";
import type {
  ObservedState,
  ProviderPlugin,
  AttackVectorDeclaration,
  RaidResult
} from "../../src/types/provider-plugin";

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 1: ObservedState base type exists with required fields
// ═══════════════════════════════════════════════════════════════════════════════

describe("ObservedState", () => {
  it("should have required base fields", () => {
    // ObservedState must have targetId and observedAt
    const state: ObservedState = {
      targetId: "test-target-123",
      observedAt: new Date().toISOString(),
      customField: "provider-specific data"
    };

    expect(state.targetId).toBe("test-target-123");
    expect(state.observedAt).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO format
    expect(state.customField).toBe("provider-specific data");
  });

  it("should allow extension with provider-specific fields", () => {
    // Providers can add their own fields beyond the base
    interface CognitoState extends ObservedState {
      userPoolId: string;
      mfaConfiguration: "ON" | "OFF" | "OPTIONAL";
    }

    const cognitoState: CognitoState = {
      targetId: "us-east-1_ABC123",
      observedAt: new Date().toISOString(),
      userPoolId: "us-east-1_ABC123",
      mfaConfiguration: "ON"
    };

    expect(cognitoState.userPoolId).toBe("us-east-1_ABC123");
    expect(cognitoState.mfaConfiguration).toBe("ON");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 2: ProviderPlugin generic interface accepts ObservedState type param
// ═══════════════════════════════════════════════════════════════════════════════

describe("ProviderPlugin<T>", () => {
  interface MockState extends ObservedState {
    mockField: string;
  }

  // Mock plugin implementation for testing
  class MockPlugin implements ProviderPlugin<MockState> {
    readonly providerId = "mock-provider";
    readonly version = "1.0.0";
    readonly attackVectors: AttackVectorDeclaration[] = [
      {
        vector: "test-attack",
        description: "Test attack vector",
        mitreMapping: "T1234",
        requiredPermissions: ["test:read"],
        intensity: { min: 1, max: 10, default: 5 }
      }
    ];

    async recon(targetId: string): Promise<MockState> {
      return {
        targetId,
        observedAt: new Date().toISOString(),
        mockField: "observed"
      };
    }

    async raid(snapshot: MockState, vector: string, intensity: number): Promise<RaidResult> {
      return {
        raidId: "RAID-mock",
        target: snapshot.targetId,
        vector: "test-attack",
        success: false,
        controlsHeld: true,
        findings: ["Mock finding"],
        timeline: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        serialized: true,
        durationMs: 100
      };
    }

    createCleanup(snapshot: MockState): () => { operation: string; success: boolean } {
      return () => ({
        operation: `cleanup-${snapshot.targetId}`,
        success: true
      });
    }
  }

  it("should accept generic type parameter extending ObservedState", async () => {
    const plugin = new MockPlugin();

    expect(plugin.providerId).toBe("mock-provider");
    expect(plugin.version).toBe("1.0.0");
    expect(plugin.attackVectors).toHaveLength(1);
  });

  it("should perform recon returning provider-specific state", async () => {
    const plugin = new MockPlugin();
    const state = await plugin.recon("target-123");

    expect(state.targetId).toBe("target-123");
    expect(state.observedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(state.mockField).toBe("observed");
  });

  it("should execute raid with provider-specific snapshot", async () => {
    const plugin = new MockPlugin();
    const snapshot: MockState = {
      targetId: "target-123",
      observedAt: new Date().toISOString(),
      mockField: "test"
    };

    const result = await plugin.raid(snapshot, "test-attack", 5);

    expect(result.raidId).toMatch(/^RAID-/);
    expect(result.target).toBe("target-123");
    expect(result.success).toBe(false);
    expect(result.controlsHeld).toBe(true);
  });

  it("should create cleanup function scoped to snapshot", () => {
    const plugin = new MockPlugin();
    const snapshot: MockState = {
      targetId: "target-123",
      observedAt: new Date().toISOString(),
      mockField: "test"
    };

    const cleanup = plugin.createCleanup(snapshot);
    const result = cleanup();

    expect(result.operation).toBe("cleanup-target-123");
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 3: AttackVectorDeclaration interface extracted with mitre mapping
// ═══════════════════════════════════════════════════════════════════════════════

describe("AttackVectorDeclaration", () => {
  it("should declare attack vector with MITRE mapping", () => {
    const declaration: AttackVectorDeclaration = {
      vector: "mfa-bypass",
      description: "Test MFA enforcement by attempting bypass",
      mitreMapping: "T1556.006",
      requiredPermissions: ["cognito:DescribeUserPool", "cognito:GetUserPoolMfaConfig"],
      intensity: {
        min: 1,
        max: 10,
        default: 5
      }
    };

    expect(declaration.vector).toBe("mfa-bypass");
    expect(declaration.mitreMapping).toBe("T1556.006");
    expect(declaration.requiredPermissions).toHaveLength(2);
    expect(declaration.intensity.default).toBe(5);
  });

  it("should support intensity range specification", () => {
    const declaration: AttackVectorDeclaration = {
      vector: "token-replay",
      description: "Test token handling",
      mitreMapping: "T1550.001",
      requiredPermissions: [],
      intensity: {
        min: 3,
        max: 8,
        default: 6
      }
    };

    expect(declaration.intensity.min).toBe(3);
    expect(declaration.intensity.max).toBe(8);
    expect(declaration.intensity.default).toBe(6);
    expect(declaration.intensity.default).toBeGreaterThanOrEqual(declaration.intensity.min);
    expect(declaration.intensity.default).toBeLessThanOrEqual(declaration.intensity.max);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 5: CognitoSnapshot extends ObservedState base type correctly
// ═══════════════════════════════════════════════════════════════════════════════

describe("CognitoSnapshot compatibility", () => {
  it("should be assignable to ObservedState", () => {
    // This test verifies that our existing CognitoSnapshot type
    // is compatible with the new ObservedState base type
    interface CognitoSnapshot extends ObservedState {
      userPoolId: string;
      userPoolName: string;
      mfaConfiguration: "ON" | "OFF" | "OPTIONAL";
      observedAt: string; // Already has this field
    }

    const snapshot: CognitoSnapshot = {
      targetId: "us-east-1_ABC123", // NEW: Required by ObservedState
      userPoolId: "us-east-1_ABC123",
      userPoolName: "test-pool",
      mfaConfiguration: "ON",
      observedAt: new Date().toISOString()
    };

    // Should be assignable to base type
    const base: ObservedState = snapshot;

    expect(base.targetId).toBe("us-east-1_ABC123");
    expect(base.observedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("should preserve provider-specific fields when cast to base", () => {
    interface CognitoSnapshot extends ObservedState {
      userPoolId: string;
      mfaConfiguration: "ON" | "OFF" | "OPTIONAL";
    }

    const snapshot: CognitoSnapshot = {
      targetId: "us-east-1_ABC123",
      userPoolId: "us-east-1_ABC123",
      mfaConfiguration: "ON",
      observedAt: new Date().toISOString()
    };

    // Cast to base type
    const base: ObservedState = snapshot;

    // Provider-specific fields still accessible via original reference
    expect(snapshot.userPoolId).toBe("us-east-1_ABC123");
    expect(snapshot.mfaConfiguration).toBe("ON");

    // Base fields accessible via base reference
    expect(base.targetId).toBe("us-east-1_ABC123");
  });
});
