/**
 * AWS Cognito Plugin for Corsair
 *
 * This plugin provides:
 * - Cognito-specific type definitions
 * - Type guards for runtime validation
 * - Factory functions for creating valid snapshots
 *
 * Architectural Decision: Provider-specific types belong in plugins,
 * NOT in the core Corsair module. This enables:
 * - Clean separation of concerns
 * - Independent plugin versioning
 * - Type-safe plugin development
 * - Easy addition of new providers (Auth0, Okta, etc.)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN IDENTITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Unique identifier for this plugin.
 * Used by Corsair core for plugin registration and dispatch.
 */
export const COGNITO_PROVIDER_ID = "aws-cognito";

// ═══════════════════════════════════════════════════════════════════════════════
// COGNITO-SPECIFIC TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * MFA configuration options for Cognito User Pools.
 * - ON: MFA is required for all users
 * - OFF: MFA is disabled
 * - OPTIONAL: Users can choose to enable MFA
 */
export type MfaConfiguration = "ON" | "OFF" | "OPTIONAL";

/**
 * Array of valid MFA configurations for runtime validation.
 */
export const MFA_CONFIGURATIONS: readonly MfaConfiguration[] = ["ON", "OFF", "OPTIONAL"] as const;

/**
 * Password policy configuration for Cognito User Pools.
 * Defines the requirements for user passwords.
 */
export interface PasswordPolicy {
  minimumLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  temporaryPasswordValidityDays: number;
}

/**
 * Risk configuration for advanced security features.
 * Defines actions to take for various risk levels.
 */
export interface RiskConfiguration {
  compromisedCredentialsAction: string | null;
  accountTakeoverLowAction: string | null;
  accountTakeoverMediumAction: string | null;
  accountTakeoverHighAction: string | null;
}

/**
 * Device configuration for Cognito User Pools.
 * Controls device tracking and challenge behavior.
 */
export interface DeviceConfiguration {
  challengeRequiredOnNewDevice: boolean;
  deviceOnlyRememberedOnUserPrompt: boolean;
}

/**
 * Complete snapshot of a Cognito User Pool's security configuration.
 * This is the primary type for RECON operations against Cognito.
 */
export interface CognitoSnapshot {
  userPoolId: string;
  userPoolName: string;
  mfaConfiguration: MfaConfiguration;
  softwareTokenMfaEnabled: boolean;
  smsMfaEnabled: boolean;
  passwordPolicy: PasswordPolicy;
  riskConfiguration: RiskConfiguration | null;
  deviceConfiguration: DeviceConfiguration;
  observedAt: string;
  userCount?: number;
  status?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS (Runtime Validation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates that an object is a valid PasswordPolicy.
 * Used for runtime type checking when processing external data.
 */
export function isValidPasswordPolicy(obj: unknown): obj is PasswordPolicy {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const policy = obj as Record<string, unknown>;

  return (
    typeof policy.minimumLength === "number" &&
    typeof policy.requireUppercase === "boolean" &&
    typeof policy.requireLowercase === "boolean" &&
    typeof policy.requireNumbers === "boolean" &&
    typeof policy.requireSymbols === "boolean" &&
    typeof policy.temporaryPasswordValidityDays === "number"
  );
}

/**
 * Validates that an object is a valid RiskConfiguration.
 * Note: All fields can be null, so we check for the correct shape.
 */
export function isValidRiskConfiguration(obj: unknown): obj is RiskConfiguration {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const config = obj as Record<string, unknown>;

  // All fields should be either string or null
  const isStringOrNull = (val: unknown): boolean =>
    val === null || typeof val === "string";

  return (
    isStringOrNull(config.compromisedCredentialsAction) &&
    isStringOrNull(config.accountTakeoverLowAction) &&
    isStringOrNull(config.accountTakeoverMediumAction) &&
    isStringOrNull(config.accountTakeoverHighAction)
  );
}

/**
 * Validates that an object is a valid DeviceConfiguration.
 */
export function isValidDeviceConfiguration(obj: unknown): obj is DeviceConfiguration {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const config = obj as Record<string, unknown>;

  return (
    typeof config.challengeRequiredOnNewDevice === "boolean" &&
    typeof config.deviceOnlyRememberedOnUserPrompt === "boolean"
  );
}

/**
 * Validates that an object is a valid MfaConfiguration value.
 */
export function isValidMfaConfiguration(value: unknown): value is MfaConfiguration {
  return MFA_CONFIGURATIONS.includes(value as MfaConfiguration);
}

/**
 * Main type guard for CognitoSnapshot.
 * Validates all required fields are present and correctly typed.
 */
export function isCognitoSnapshot(obj: unknown): obj is CognitoSnapshot {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const snapshot = obj as Record<string, unknown>;

  // Validate required string fields
  if (
    typeof snapshot.userPoolId !== "string" ||
    typeof snapshot.userPoolName !== "string" ||
    typeof snapshot.observedAt !== "string"
  ) {
    return false;
  }

  // Validate MFA configuration
  if (!isValidMfaConfiguration(snapshot.mfaConfiguration)) {
    return false;
  }

  // Validate boolean fields
  if (
    typeof snapshot.softwareTokenMfaEnabled !== "boolean" ||
    typeof snapshot.smsMfaEnabled !== "boolean"
  ) {
    return false;
  }

  // Validate password policy
  if (!isValidPasswordPolicy(snapshot.passwordPolicy)) {
    return false;
  }

  // Validate risk configuration (can be null)
  if (snapshot.riskConfiguration !== null && !isValidRiskConfiguration(snapshot.riskConfiguration)) {
    return false;
  }

  // Validate device configuration
  if (!isValidDeviceConfiguration(snapshot.deviceConfiguration)) {
    return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a CognitoSnapshot.
 * Only required fields are mandatory; others have sensible defaults.
 */
export interface CreateCognitoSnapshotOptions {
  userPoolId: string;
  userPoolName: string;
  mfaConfiguration: MfaConfiguration;
  softwareTokenMfaEnabled?: boolean;
  smsMfaEnabled?: boolean;
  passwordPolicy?: Partial<PasswordPolicy>;
  riskConfiguration?: RiskConfiguration | null;
  deviceConfiguration?: Partial<DeviceConfiguration>;
  userCount?: number;
  status?: string;
}

/**
 * Factory function to create a valid CognitoSnapshot with sensible defaults.
 * Use this when programmatically creating snapshots for testing or simulation.
 */
export function createCognitoSnapshot(options: CreateCognitoSnapshotOptions): CognitoSnapshot {
  const defaultPasswordPolicy: PasswordPolicy = {
    minimumLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false,
    temporaryPasswordValidityDays: 7,
  };

  const defaultDeviceConfiguration: DeviceConfiguration = {
    challengeRequiredOnNewDevice: false,
    deviceOnlyRememberedOnUserPrompt: false,
  };

  return {
    userPoolId: options.userPoolId,
    userPoolName: options.userPoolName,
    mfaConfiguration: options.mfaConfiguration,
    softwareTokenMfaEnabled: options.softwareTokenMfaEnabled ?? false,
    smsMfaEnabled: options.smsMfaEnabled ?? false,
    passwordPolicy: {
      ...defaultPasswordPolicy,
      ...options.passwordPolicy,
    },
    riskConfiguration: options.riskConfiguration ?? null,
    deviceConfiguration: {
      ...defaultDeviceConfiguration,
      ...options.deviceConfiguration,
    },
    observedAt: new Date().toISOString(),
    userCount: options.userCount,
    status: options.status,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN METADATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Plugin metadata for registration with Corsair core.
 */
export const pluginMetadata = {
  id: COGNITO_PROVIDER_ID,
  name: "AWS Cognito",
  version: "1.0.0",
  description: "Corsair plugin for AWS Cognito User Pools",
  supportedVectors: [
    "mfa-bypass",
    "password-spray",
    "token-replay",
    "session-hijack",
  ] as const,
};

/**
 * Export types for external consumers who want TypeScript support.
 * Note: The actual types are exported above, this is just documentation.
 */
export type {
  CognitoSnapshot as CognitoSnapshotType,
  PasswordPolicy as PasswordPolicyType,
  RiskConfiguration as RiskConfigurationType,
  DeviceConfiguration as DeviceConfigurationType,
};
