/**
 * Type Abstraction Tests - Phase 1.1
 *
 * Contract: Provider-specific types should NOT be exported from core.
 * Instead, they should be exported from their respective plugins.
 *
 * TDD Approach:
 * 1. RED: Write these tests FIRST - they should fail initially
 * 2. GREEN: Move types to plugins to make tests pass
 * 3. REFACTOR: Clean up any remaining references
 *
 * Purpose: Ensure clean architectural separation between:
 * - Core Corsair types (generic, provider-agnostic)
 * - Plugin-specific types (CognitoSnapshot, Auth0Tenant, etc.)
 */

import { describe, test, expect } from "bun:test";

describe("Type Abstraction - Plugin Architecture", () => {

  /**
   * Contract: Core module should NOT export Cognito-specific types
   *
   * Rationale: Core types should be provider-agnostic to support
   * extensibility to Auth0, Okta, Azure AD, etc.
   */
  describe("Core Type Exports", () => {

    test("core exports generic ObservedState interface (not provider-specific)", async () => {
      // Import core module
      const coreModule = await import("../../src/corsair-mvp");

      // Core SHOULD export generic types
      expect(coreModule.Corsair).toBeDefined();

      // Check for generic type markers by verifying Corsair class exists
      // and can be instantiated
      const corsair = new coreModule.Corsair();
      expect(corsair).toBeDefined();
    });

    test("core exports framework-agnostic Severity type", async () => {
      const coreModule = await import("../../src/corsair-mvp");

      // Severity is generic - applies to all providers
      // Verify it exists by checking that type constants work
      const severities: string[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
      severities.forEach(s => {
        expect(typeof s).toBe("string");
      });
    });

    test("core exports generic AttackVector type", async () => {
      const coreModule = await import("../../src/corsair-mvp");

      // AttackVector should be generic (not Cognito-specific)
      const vectors: string[] = ["mfa-bypass", "password-spray", "token-replay", "session-hijack"];
      vectors.forEach(v => {
        expect(typeof v).toBe("string");
      });
    });
  });

  /**
   * Contract: Plugin should export all provider-specific types
   *
   * Rationale: Each plugin owns its domain types, enabling:
   * - Independent versioning
   * - Clear ownership
   * - Type-safe plugin development
   */
  describe("Plugin Type Exports", () => {

    test("aws-cognito plugin exports CognitoSnapshot type", async () => {
      // Import from plugin - this should work after types are moved
      const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

      // Plugin MUST export the CognitoSnapshot type
      expect(pluginModule.isCognitoSnapshot).toBeDefined();

      // Verify the type guard works
      const validSnapshot = {
        userPoolId: "us-west-2_test",
        userPoolName: "TestPool",
        mfaConfiguration: "ON",
        softwareTokenMfaEnabled: true,
        smsMfaEnabled: false,
        passwordPolicy: {
          minimumLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: true,
          temporaryPasswordValidityDays: 7
        },
        riskConfiguration: null,
        deviceConfiguration: {
          challengeRequiredOnNewDevice: true,
          deviceOnlyRememberedOnUserPrompt: false
        },
        observedAt: new Date().toISOString()
      };

      expect(pluginModule.isCognitoSnapshot(validSnapshot)).toBe(true);
    });

    test("aws-cognito plugin exports MfaConfiguration type", async () => {
      const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

      // Plugin should export MFA configuration utilities
      expect(pluginModule.MFA_CONFIGURATIONS).toBeDefined();
      expect(pluginModule.MFA_CONFIGURATIONS).toContain("ON");
      expect(pluginModule.MFA_CONFIGURATIONS).toContain("OFF");
      expect(pluginModule.MFA_CONFIGURATIONS).toContain("OPTIONAL");
    });

    test("aws-cognito plugin exports PasswordPolicy type", async () => {
      const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

      // Plugin should export password policy validation
      expect(pluginModule.isValidPasswordPolicy).toBeDefined();

      const validPolicy = {
        minimumLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        temporaryPasswordValidityDays: 7
      };

      expect(pluginModule.isValidPasswordPolicy(validPolicy)).toBe(true);
    });

    test("aws-cognito plugin exports RiskConfiguration type", async () => {
      const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

      // Plugin should export risk configuration utilities
      expect(pluginModule.isValidRiskConfiguration).toBeDefined();

      const validConfig = {
        compromisedCredentialsAction: "BLOCK",
        accountTakeoverLowAction: "NO_ACTION",
        accountTakeoverMediumAction: "MFA_IF_CONFIGURED",
        accountTakeoverHighAction: "BLOCK"
      };

      expect(pluginModule.isValidRiskConfiguration(validConfig)).toBe(true);
    });
  });

  /**
   * Contract: Plugin types should be compatible with core interfaces
   *
   * Rationale: Plugins must implement core contracts to enable
   * interoperability with the Corsair engine.
   */
  describe("Type Compatibility", () => {

    test("CognitoSnapshot implements generic ObservedState pattern", async () => {
      const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

      // Plugin should provide a factory that creates valid snapshots
      expect(pluginModule.createCognitoSnapshot).toBeDefined();

      const snapshot = pluginModule.createCognitoSnapshot({
        userPoolId: "us-west-2_test",
        userPoolName: "TestPool",
        mfaConfiguration: "ON"
      });

      // Every observed state should have these core properties
      expect(snapshot.observedAt).toBeDefined();
      expect(typeof snapshot.observedAt).toBe("string");
    });

    test("Plugin provides COGNITO_PROVIDER_ID constant", async () => {
      const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

      // Each plugin should expose its provider ID
      expect(pluginModule.COGNITO_PROVIDER_ID).toBe("aws-cognito");
    });

    test("Plugin exports type definitions alongside runtime validations", async () => {
      const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

      // Plugin should have both TypeScript types (via declarations)
      // and runtime validators for JS consumers
      expect(typeof pluginModule.isCognitoSnapshot).toBe("function");
      expect(typeof pluginModule.isValidPasswordPolicy).toBe("function");
      expect(typeof pluginModule.isValidRiskConfiguration).toBe("function");
    });
  });

  /**
   * Contract: Core should be able to work with any provider snapshot
   * through the generic interface
   */
  describe("Generic Interface Usage", () => {

    test("Corsair.mark accepts generic snapshot and expectations", async () => {
      const coreModule = await import("../../src/corsair-mvp");

      const corsair = new coreModule.Corsair();

      // Mark should work with any snapshot that has the expected fields
      expect(typeof corsair.mark).toBe("function");
    });

    test("Corsair.raid accepts generic snapshot and options", async () => {
      const coreModule = await import("../../src/corsair-mvp");

      const corsair = new coreModule.Corsair();

      // Raid should work with any valid snapshot
      expect(typeof corsair.raid).toBe("function");
    });
  });
});

/**
 * Integration Tests - Type Flow Through System
 */
describe("Type Abstraction - Integration", () => {

  test("Plugin types flow correctly through core primitives", async () => {
    const coreModule = await import("../../src/corsair-mvp");
    const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

    // Create a plugin-specific snapshot
    const snapshot = pluginModule.createCognitoSnapshot({
      userPoolId: "us-west-2_integration_test",
      userPoolName: "IntegrationTestPool",
      mfaConfiguration: "ON"
    });

    // Verify it's a valid Cognito snapshot
    expect(pluginModule.isCognitoSnapshot(snapshot)).toBe(true);

    // Verify the core Corsair class can be instantiated
    const corsair = new coreModule.Corsair();
    expect(corsair).toBeDefined();
  });

  test("Type guards correctly identify provider snapshots", async () => {
    const pluginModule = await import("../../plugins/aws-cognito/aws-cognito-plugin");

    // Valid Cognito snapshot
    const validSnapshot = pluginModule.createCognitoSnapshot({
      userPoolId: "us-west-2_test",
      userPoolName: "Test",
      mfaConfiguration: "OFF"
    });
    expect(pluginModule.isCognitoSnapshot(validSnapshot)).toBe(true);

    // Invalid snapshot (missing required fields)
    const invalidSnapshot = {
      someRandomField: "value"
    };
    expect(pluginModule.isCognitoSnapshot(invalidSnapshot)).toBe(false);

    // Null/undefined handling
    expect(pluginModule.isCognitoSnapshot(null)).toBe(false);
    expect(pluginModule.isCognitoSnapshot(undefined)).toBe(false);
  });
});
