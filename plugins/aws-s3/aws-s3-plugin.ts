/**
 * AWS S3 Plugin for Corsair
 *
 * This plugin provides:
 * - S3-specific type guards for runtime validation
 * - Factory functions for creating valid snapshots
 * - Plugin metadata for registration
 */

import type { S3Snapshot } from "../../src/types";

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN IDENTITY
// ═══════════════════════════════════════════════════════════════════════════════

export const S3_PROVIDER_ID = "aws-s3";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS (Runtime Validation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main type guard for S3Snapshot.
 */
export function isS3Snapshot(obj: unknown): obj is S3Snapshot {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const snapshot = obj as Record<string, unknown>;

  return (
    typeof snapshot.bucketName === "string" &&
    typeof snapshot.publicAccessBlock === "boolean" &&
    (snapshot.encryption === "AES256" || snapshot.encryption === "aws:kms" || snapshot.encryption === null) &&
    (snapshot.versioning === "Enabled" || snapshot.versioning === "Disabled") &&
    typeof snapshot.logging === "boolean"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateS3SnapshotOptions {
  bucketName: string;
  publicAccessBlock?: boolean;
  encryption?: "AES256" | "aws:kms" | null;
  versioning?: "Enabled" | "Disabled";
  logging?: boolean;
}

/**
 * Factory function to create a valid S3Snapshot with sensible defaults.
 */
export function createS3Snapshot(options: CreateS3SnapshotOptions): S3Snapshot {
  return {
    bucketName: options.bucketName,
    publicAccessBlock: options.publicAccessBlock ?? false,
    encryption: options.encryption ?? null,
    versioning: options.versioning ?? "Disabled",
    logging: options.logging ?? false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const pluginMetadata = {
  id: S3_PROVIDER_ID,
  name: "AWS S3",
  version: "1.0.0",
  description: "Corsair plugin for AWS S3 Buckets",
  supportedVectors: [
    "public-access-test",
    "encryption-test",
    "versioning-test",
  ] as const,
};
