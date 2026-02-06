/**
 * AWS RDS Plugin for Corsair
 *
 * This plugin provides:
 * - RDS-specific type definitions and snapshot interface
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
export const RDS_PROVIDER_ID = "aws-rds";

// ===============================================================================
// RDS-SPECIFIC TYPE DEFINITIONS
// ===============================================================================

/**
 * Complete snapshot of an AWS RDS instance's security configuration.
 * This is the primary type for RECON operations against RDS.
 */
export interface RDSSnapshot {
  /** RDS instance identifier */
  instanceId: string;
  /** Database engine (e.g., postgres, mysql, aurora) */
  engine: string;
  /** Database engine version */
  engineVersion: string;
  /** Whether the instance is publicly accessible */
  publiclyAccessible: boolean;
  /** Whether storage encryption is enabled */
  storageEncrypted: boolean;
  /** Whether IAM database authentication is enabled */
  iamAuthEnabled: boolean;
  /** Whether audit logging is enabled */
  auditLogging: boolean;
  /** Whether Multi-AZ deployment is enabled */
  multiAZ: boolean;
  /** Number of days automated backups are retained */
  backupRetentionDays: number;
  /** Whether deletion protection is enabled */
  deletionProtection: boolean;
  /** Whether Performance Insights is enabled */
  performanceInsightsEnabled: boolean;
  /** ISO-8601 timestamp when snapshot was taken */
  observedAt: string;
}

// ===============================================================================
// TYPE GUARDS (Runtime Validation)
// ===============================================================================

/**
 * Main type guard for RDSSnapshot.
 * Validates all required fields are present and correctly typed.
 */
export function isRDSSnapshot(obj: unknown): obj is RDSSnapshot {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const snapshot = obj as Record<string, unknown>;

  return (
    typeof snapshot.instanceId === "string" &&
    typeof snapshot.engine === "string" &&
    typeof snapshot.engineVersion === "string" &&
    typeof snapshot.publiclyAccessible === "boolean" &&
    typeof snapshot.storageEncrypted === "boolean" &&
    typeof snapshot.iamAuthEnabled === "boolean" &&
    typeof snapshot.auditLogging === "boolean" &&
    typeof snapshot.multiAZ === "boolean" &&
    typeof snapshot.backupRetentionDays === "number" &&
    typeof snapshot.deletionProtection === "boolean" &&
    typeof snapshot.performanceInsightsEnabled === "boolean" &&
    typeof snapshot.observedAt === "string"
  );
}

// ===============================================================================
// FACTORY FUNCTIONS
// ===============================================================================

/**
 * Options for creating an RDSSnapshot.
 * Only instanceId is mandatory; others have sensible defaults.
 */
export interface CreateRDSSnapshotOptions {
  instanceId: string;
  engine?: string;
  engineVersion?: string;
  publiclyAccessible?: boolean;
  storageEncrypted?: boolean;
  iamAuthEnabled?: boolean;
  auditLogging?: boolean;
  multiAZ?: boolean;
  backupRetentionDays?: number;
  deletionProtection?: boolean;
  performanceInsightsEnabled?: boolean;
}

/**
 * Factory function to create a valid RDSSnapshot with sensible defaults.
 * Use this when programmatically creating snapshots for testing or simulation.
 */
export function createRDSSnapshot(options: CreateRDSSnapshotOptions): RDSSnapshot {
  return {
    instanceId: options.instanceId,
    engine: options.engine ?? "postgres",
    engineVersion: options.engineVersion ?? "15.4",
    publiclyAccessible: options.publiclyAccessible ?? false,
    storageEncrypted: options.storageEncrypted ?? false,
    iamAuthEnabled: options.iamAuthEnabled ?? false,
    auditLogging: options.auditLogging ?? false,
    multiAZ: options.multiAZ ?? false,
    backupRetentionDays: options.backupRetentionDays ?? 7,
    deletionProtection: options.deletionProtection ?? false,
    performanceInsightsEnabled: options.performanceInsightsEnabled ?? false,
    observedAt: new Date().toISOString(),
  };
}

// ===============================================================================
// FIXTURE SNAPSHOTS
// ===============================================================================

/**
 * Compliant RDS snapshot - private endpoint, encrypted storage, IAM auth,
 * audit logging, multi-AZ, deletion protection, Performance Insights.
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
 * Non-compliant RDS snapshot - public endpoint, no encryption, password auth only,
 * no audit logging, single-AZ, no deletion protection.
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

// ===============================================================================
// PLUGIN METADATA
// ===============================================================================

/**
 * Plugin metadata for registration with Corsair core.
 */
export const pluginMetadata = {
  id: RDS_PROVIDER_ID,
  name: "AWS RDS",
  version: "1.0.0",
  description: "Corsair plugin for AWS RDS instance security configuration",
  supportedVectors: [
    "public-endpoint",
    "unencrypted-storage",
    "weak-auth",
    "no-audit-logging",
  ] as const,
};

/**
 * Export types for external consumers who want TypeScript support.
 */
export type {
  RDSSnapshot as RDSSnapshotType,
};
