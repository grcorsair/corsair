/**
 * AWS Lambda Plugin for Corsair
 *
 * This plugin provides:
 * - Lambda-specific type definitions and snapshot interface
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
export const LAMBDA_PROVIDER_ID = "aws-lambda";

// ===============================================================================
// LAMBDA-SPECIFIC TYPE DEFINITIONS
// ===============================================================================

/**
 * Complete snapshot of an AWS Lambda function's security configuration.
 * This is the primary type for RECON operations against Lambda.
 */
export interface LambdaSnapshot {
  /** Lambda function name */
  functionName: string;
  /** Runtime environment (e.g., nodejs20.x, python3.12) */
  runtime: string;
  /** Allocated memory in MB */
  memorySize: number;
  /** Function timeout in seconds */
  timeout: number;
  /** Whether environment variables are encrypted with KMS */
  environmentVariablesEncrypted: boolean;
  /** Whether the function is configured within a VPC */
  vpcConfigured: boolean;
  /** Whether Lambda layer integrity has been verified */
  layerIntegrityVerified: boolean;
  /** Whether code signing is enabled for the function */
  codeSigningEnabled: boolean;
  /** Reserved concurrency limit (null if unreserved) */
  reservedConcurrency: number | null;
  /** Whether a dead letter queue is configured */
  deadLetterQueueConfigured: boolean;
  /** Whether X-Ray tracing is enabled */
  tracingEnabled: boolean;
  /** ISO-8601 timestamp when snapshot was taken */
  observedAt: string;
}

// ===============================================================================
// TYPE GUARDS (Runtime Validation)
// ===============================================================================

/**
 * Main type guard for LambdaSnapshot.
 * Validates all required fields are present and correctly typed.
 */
export function isLambdaSnapshot(obj: unknown): obj is LambdaSnapshot {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const snapshot = obj as Record<string, unknown>;

  return (
    typeof snapshot.functionName === "string" &&
    typeof snapshot.runtime === "string" &&
    typeof snapshot.memorySize === "number" &&
    typeof snapshot.timeout === "number" &&
    typeof snapshot.environmentVariablesEncrypted === "boolean" &&
    typeof snapshot.vpcConfigured === "boolean" &&
    typeof snapshot.layerIntegrityVerified === "boolean" &&
    typeof snapshot.codeSigningEnabled === "boolean" &&
    (snapshot.reservedConcurrency === null || typeof snapshot.reservedConcurrency === "number") &&
    typeof snapshot.deadLetterQueueConfigured === "boolean" &&
    typeof snapshot.tracingEnabled === "boolean" &&
    typeof snapshot.observedAt === "string"
  );
}

// ===============================================================================
// FACTORY FUNCTIONS
// ===============================================================================

/**
 * Options for creating a LambdaSnapshot.
 * Only functionName is mandatory; others have sensible defaults.
 */
export interface CreateLambdaSnapshotOptions {
  functionName: string;
  runtime?: string;
  memorySize?: number;
  timeout?: number;
  environmentVariablesEncrypted?: boolean;
  vpcConfigured?: boolean;
  layerIntegrityVerified?: boolean;
  codeSigningEnabled?: boolean;
  reservedConcurrency?: number | null;
  deadLetterQueueConfigured?: boolean;
  tracingEnabled?: boolean;
}

/**
 * Factory function to create a valid LambdaSnapshot with sensible defaults.
 * Use this when programmatically creating snapshots for testing or simulation.
 */
export function createLambdaSnapshot(options: CreateLambdaSnapshotOptions): LambdaSnapshot {
  return {
    functionName: options.functionName,
    runtime: options.runtime ?? "nodejs20.x",
    memorySize: options.memorySize ?? 128,
    timeout: options.timeout ?? 30,
    environmentVariablesEncrypted: options.environmentVariablesEncrypted ?? false,
    vpcConfigured: options.vpcConfigured ?? false,
    layerIntegrityVerified: options.layerIntegrityVerified ?? false,
    codeSigningEnabled: options.codeSigningEnabled ?? false,
    reservedConcurrency: options.reservedConcurrency ?? null,
    deadLetterQueueConfigured: options.deadLetterQueueConfigured ?? false,
    tracingEnabled: options.tracingEnabled ?? false,
    observedAt: new Date().toISOString(),
  };
}

// ===============================================================================
// FIXTURE SNAPSHOTS
// ===============================================================================

/**
 * Compliant Lambda snapshot - encrypted env vars, VPC configured, verified layers,
 * code signing enabled, tracing on, dead letter queue configured.
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
 * Non-compliant Lambda snapshot - unencrypted env vars, no VPC, unverified layers,
 * no code signing, max timeout, no tracing.
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

// ===============================================================================
// PLUGIN METADATA
// ===============================================================================

/**
 * Plugin metadata for registration with Corsair core.
 */
export const pluginMetadata = {
  id: LAMBDA_PROVIDER_ID,
  name: "AWS Lambda",
  version: "1.0.0",
  description: "Corsair plugin for AWS Lambda function security configuration",
  supportedVectors: [
    "cold-start-injection",
    "layer-tampering",
    "env-var-secrets",
    "timeout-abuse",
  ] as const,
};

/**
 * Export types for external consumers who want TypeScript support.
 */
export type {
  LambdaSnapshot as LambdaSnapshotType,
};
