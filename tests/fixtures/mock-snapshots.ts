/**
 * Mock Snapshots for Corsair Tests
 *
 * These mock snapshots replace the legacy recon() fixture loading.
 * They provide typed, predictable test data for all primitives.
 *
 * Usage:
 *   import { compliantSnapshot, nonCompliantSnapshot } from "../fixtures/mock-snapshots";
 */

import type { CognitoSnapshot } from "../../src/corsair-mvp";

/**
 * Compliant snapshot - MFA ON, strong password policy, risk config enabled
 */
export const compliantSnapshot: CognitoSnapshot = {
  userPoolId: "us-west-2_COMPLIANT001",
  userPoolName: "compliant-production-pool",
  mfaConfiguration: "ON",
  softwareTokenMfaEnabled: true,
  smsMfaEnabled: true,
  passwordPolicy: {
    minimumLength: 14,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    temporaryPasswordValidityDays: 1,
  },
  riskConfiguration: {
    compromisedCredentialsAction: "BLOCK",
    accountTakeoverLowAction: "NOTIFY",
    accountTakeoverMediumAction: "MFA_IF_CONFIGURED",
    accountTakeoverHighAction: "BLOCK",
  },
  deviceConfiguration: {
    challengeRequiredOnNewDevice: true,
    deviceOnlyRememberedOnUserPrompt: true,
  },
  observedAt: new Date().toISOString(),
};

/**
 * Non-compliant snapshot - MFA OFF, weak password policy, no risk config
 */
export const nonCompliantSnapshot: CognitoSnapshot = {
  userPoolId: "us-west-2_NONCOMP001",
  userPoolName: "legacy-development-pool",
  mfaConfiguration: "OFF",
  softwareTokenMfaEnabled: false,
  smsMfaEnabled: false,
  passwordPolicy: {
    minimumLength: 6,
    requireUppercase: false,
    requireLowercase: true,
    requireNumbers: false,
    requireSymbols: false,
    temporaryPasswordValidityDays: 90,
  },
  riskConfiguration: null,
  deviceConfiguration: {
    challengeRequiredOnNewDevice: false,
    deviceOnlyRememberedOnUserPrompt: false,
  },
  observedAt: new Date().toISOString(),
};

/**
 * Optional MFA snapshot - MFA OPTIONAL
 */
export const optionalMfaSnapshot: CognitoSnapshot = {
  userPoolId: "us-west-2_OPTMFA001",
  userPoolName: "optional-mfa-pool",
  mfaConfiguration: "OPTIONAL",
  softwareTokenMfaEnabled: true,
  smsMfaEnabled: false,
  passwordPolicy: {
    minimumLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false,
    temporaryPasswordValidityDays: 7,
  },
  riskConfiguration: {
    compromisedCredentialsAction: "NOTIFY",
    accountTakeoverLowAction: "NOTIFY",
    accountTakeoverMediumAction: "NOTIFY",
    accountTakeoverHighAction: "NOTIFY",
  },
  deviceConfiguration: {
    challengeRequiredOnNewDevice: false,
    deviceOnlyRememberedOnUserPrompt: true,
  },
  observedAt: new Date().toISOString(),
};

/**
 * Weak password policy snapshot
 */
export const weakPasswordSnapshot: CognitoSnapshot = {
  userPoolId: "us-west-2_WEAKPW001",
  userPoolName: "weak-password-pool",
  mfaConfiguration: "ON",
  softwareTokenMfaEnabled: true,
  smsMfaEnabled: false,
  passwordPolicy: {
    minimumLength: 8,
    requireUppercase: false,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false,
    temporaryPasswordValidityDays: 30,
  },
  riskConfiguration: {
    compromisedCredentialsAction: "BLOCK",
    accountTakeoverLowAction: "NOTIFY",
    accountTakeoverMediumAction: "MFA_IF_CONFIGURED",
    accountTakeoverHighAction: "BLOCK",
  },
  deviceConfiguration: {
    challengeRequiredOnNewDevice: true,
    deviceOnlyRememberedOnUserPrompt: false,
  },
  observedAt: new Date().toISOString(),
};

/**
 * No risk configuration snapshot
 */
export const noRiskConfigSnapshot: CognitoSnapshot = {
  userPoolId: "us-west-2_NORISK001",
  userPoolName: "no-risk-config-pool",
  mfaConfiguration: "ON",
  softwareTokenMfaEnabled: true,
  smsMfaEnabled: true,
  passwordPolicy: {
    minimumLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    temporaryPasswordValidityDays: 7,
  },
  riskConfiguration: null,
  deviceConfiguration: {
    challengeRequiredOnNewDevice: true,
    deviceOnlyRememberedOnUserPrompt: true,
  },
  observedAt: new Date().toISOString(),
};

/**
 * Factory function to create custom snapshot for specific test cases
 */
export function createMockSnapshot(overrides: Partial<CognitoSnapshot> = {}): CognitoSnapshot {
  return {
    userPoolId: `us-west-2_TEST${Date.now()}`,
    userPoolName: "test-pool",
    mfaConfiguration: "OFF",
    softwareTokenMfaEnabled: false,
    smsMfaEnabled: false,
    passwordPolicy: {
      minimumLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
      temporaryPasswordValidityDays: 7,
    },
    riskConfiguration: null,
    deviceConfiguration: {
      challengeRequiredOnNewDevice: false,
      deviceOnlyRememberedOnUserPrompt: false,
    },
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}
