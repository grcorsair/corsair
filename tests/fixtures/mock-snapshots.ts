/**
 * Mock Snapshots for Corsair Tests
 *
 * These mock snapshots replace the legacy recon() fixture loading.
 * They provide typed, predictable test data for all primitives.
 *
 * Usage:
 *   import { compliantSnapshot, nonCompliantSnapshot } from "../fixtures/mock-snapshots";
 */

import type { CognitoSnapshot, S3Snapshot, IAMSnapshot } from "../../src/corsair-mvp";
import type { LambdaSnapshot } from "../../plugins/aws-lambda/aws-lambda-plugin";
import type { RDSSnapshot } from "../../plugins/aws-rds/aws-rds-plugin";

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

// ===============================================================================
// S3 SNAPSHOTS
// ===============================================================================

/**
 * Compliant S3 snapshot - encryption on, public access blocked, versioning enabled
 */
export const compliantS3Snapshot: S3Snapshot = {
  bucketName: "compliant-production-bucket",
  publicAccessBlock: true,
  encryption: "AES256",
  versioning: "Enabled",
  logging: true,
};

/**
 * Non-compliant S3 snapshot - no encryption, public access open, versioning off
 */
export const nonCompliantS3Snapshot: S3Snapshot = {
  bucketName: "legacy-dev-bucket",
  publicAccessBlock: false,
  encryption: null,
  versioning: "Disabled",
  logging: false,
};

/**
 * Partially compliant S3 snapshot - some controls enabled
 */
export const partialS3Snapshot: S3Snapshot = {
  bucketName: "staging-bucket",
  publicAccessBlock: true,
  encryption: null,
  versioning: "Disabled",
  logging: true,
};

/**
 * Factory function to create custom S3 snapshot
 */
export function createMockS3Snapshot(overrides: Partial<S3Snapshot> = {}): S3Snapshot {
  return {
    bucketName: `test-bucket-${Date.now()}`,
    publicAccessBlock: false,
    encryption: null,
    versioning: "Disabled",
    logging: false,
    ...overrides,
  };
}

// ===============================================================================
// COGNITO FACTORY
// ===============================================================================

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

// ===============================================================================
// IAM SNAPSHOTS
// ===============================================================================

/**
 * Compliant IAM snapshot - MFA enabled, least privilege, rotated keys, no unused creds
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
 * Non-compliant IAM snapshot - No MFA, overprivileged, stale keys, unused creds
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

/**
 * Factory function to create custom IAM snapshot for specific test cases
 */
export function createMockIAMSnapshot(overrides: Partial<IAMSnapshot> = {}): IAMSnapshot {
  return {
    accountId: `test-account-${Date.now()}`,
    mfaEnabled: false,
    hasOverprivilegedPolicies: false,
    unusedCredentialsExist: false,
    accessKeysRotated: true,
    rootAccountMfaEnabled: false,
    users: 10,
    roles: 5,
    policies: 15,
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ===============================================================================
// LAMBDA SNAPSHOTS
// ===============================================================================

/**
 * Compliant Lambda snapshot - encrypted env vars, VPC, verified layers, code signing
 */
export const compliantLambdaSnapshot: LambdaSnapshot = {
  functionName: "compliant-production-handler",
  runtime: "nodejs20.x",
  memorySize: 256,
  timeout: 30,
  environmentVariablesEncrypted: true,
  vpcConfigured: true,
  layerIntegrityVerified: true,
  codeSigningEnabled: true,
  reservedConcurrency: 100,
  deadLetterQueueConfigured: true,
  tracingEnabled: true,
  observedAt: new Date().toISOString(),
};

/**
 * Non-compliant Lambda snapshot - unencrypted env vars, no VPC, unverified layers
 */
export const nonCompliantLambdaSnapshot: LambdaSnapshot = {
  functionName: "legacy-dev-handler",
  runtime: "nodejs18.x",
  memorySize: 128,
  timeout: 900,
  environmentVariablesEncrypted: false,
  vpcConfigured: false,
  layerIntegrityVerified: false,
  codeSigningEnabled: false,
  reservedConcurrency: null,
  deadLetterQueueConfigured: false,
  tracingEnabled: false,
  observedAt: new Date().toISOString(),
};

/**
 * Factory function to create custom Lambda snapshot for specific test cases
 */
export function createMockLambdaSnapshot(overrides: Partial<LambdaSnapshot> = {}): LambdaSnapshot {
  return {
    functionName: `test-function-${Date.now()}`,
    runtime: "nodejs20.x",
    memorySize: 128,
    timeout: 30,
    environmentVariablesEncrypted: false,
    vpcConfigured: false,
    layerIntegrityVerified: false,
    codeSigningEnabled: false,
    reservedConcurrency: null,
    deadLetterQueueConfigured: false,
    tracingEnabled: false,
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ===============================================================================
// RDS SNAPSHOTS
// ===============================================================================

/**
 * Compliant RDS snapshot - private, encrypted, IAM auth, audit logging, multi-AZ
 */
export const compliantRDSSnapshot: RDSSnapshot = {
  instanceId: "compliant-production-db",
  engine: "postgres",
  engineVersion: "15.4",
  publiclyAccessible: false,
  storageEncrypted: true,
  iamAuthEnabled: true,
  auditLogging: true,
  multiAZ: true,
  backupRetentionDays: 30,
  deletionProtection: true,
  performanceInsightsEnabled: true,
  observedAt: new Date().toISOString(),
};

/**
 * Non-compliant RDS snapshot - public, unencrypted, password auth, no logging
 */
export const nonCompliantRDSSnapshot: RDSSnapshot = {
  instanceId: "legacy-dev-db",
  engine: "mysql",
  engineVersion: "5.7.44",
  publiclyAccessible: true,
  storageEncrypted: false,
  iamAuthEnabled: false,
  auditLogging: false,
  multiAZ: false,
  backupRetentionDays: 1,
  deletionProtection: false,
  performanceInsightsEnabled: false,
  observedAt: new Date().toISOString(),
};

/**
 * Factory function to create custom RDS snapshot for specific test cases
 */
export function createMockRDSSnapshot(overrides: Partial<RDSSnapshot> = {}): RDSSnapshot {
  return {
    instanceId: `test-db-${Date.now()}`,
    engine: "postgres",
    engineVersion: "15.4",
    publiclyAccessible: false,
    storageEncrypted: false,
    iamAuthEnabled: false,
    auditLogging: false,
    multiAZ: false,
    backupRetentionDays: 7,
    deletionProtection: false,
    performanceInsightsEnabled: false,
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}
