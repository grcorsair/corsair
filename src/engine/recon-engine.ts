/**
 * RECON Engine - Read-Only Observation
 *
 * Extracted from corsair-agent.ts.
 * Provides 3 modes: fixture (hardcoded defaults), aws (live API), file (load JSON).
 */

import { readFileSync } from "fs";
import type {
  CognitoSnapshot,
  S3Snapshot,
  ReconResult,
} from "../types";

export interface ReconOptions {
  source?: "fixture" | "aws" | "file";
  service?: "cognito" | "s3";
}

export class ReconEngine {

  /**
   * Perform reconnaissance on a target.
   *
   * @param targetId - Target identifier (user pool ID, bucket name, or file path)
   * @param options - Source mode and service type
   */
  async recon(targetId: string, options: ReconOptions = {}): Promise<ReconResult> {
    const source = options.source || this.inferSource(targetId);
    const service = options.service || "cognito";
    const startTime = Date.now();

    let snapshot: CognitoSnapshot | S3Snapshot;

    if (source === "aws") {
      // Dynamically import AWS SDK to avoid requiring it when not needed
      if (service === "s3") {
        snapshot = await this.fetchAwsS3Snapshot(targetId);
      } else if (service === "cognito") {
        snapshot = await this.fetchAwsCognitoSnapshot(targetId);
      } else {
        throw new Error(`Unknown service: ${service}`);
      }
    } else if (source === "file") {
      snapshot = await this.loadFixtureFile(targetId);
    } else {
      // Fixture mode: hardcoded defaults
      if (service === "s3") {
        snapshot = this.createFixtureS3Snapshot(targetId);
      } else {
        snapshot = this.createFixtureCognitoSnapshot(targetId);
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      snapshotId: targetId,
      snapshot,
      metadata: {
        source: source === "file" ? "fixture" : source as "fixture" | "aws",
        readonly: true,
        durationMs,
      },
      stateModified: false,
      durationMs,
    };
  }

  /**
   * Infer source mode from targetId.
   * If it ends with .json, treat as file path.
   */
  private inferSource(targetId: string): "fixture" | "file" {
    if (targetId.endsWith(".json")) {
      return "file";
    }
    return "fixture";
  }

  /**
   * Load a JSON fixture file and convert to CognitoSnapshot.
   */
  private async loadFixtureFile(filePath: string): Promise<CognitoSnapshot> {
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    // Handle AWS CLI-style output format
    const pool = data.UserPool || data;
    const mfaConfig = data.UserPoolMfaConfig || {};
    const riskConfig = data.RiskConfiguration || null;

    const snapshot: CognitoSnapshot = {
      userPoolId: pool.Id || pool.userPoolId || filePath,
      userPoolName: pool.Name || pool.userPoolName,
      mfaConfiguration: mfaConfig.MfaConfiguration || pool.MfaConfiguration || "OFF",
      passwordPolicy: {
        minimumLength: pool.Policies?.PasswordPolicy?.MinimumLength || pool.passwordPolicy?.minimumLength || 8,
        requireUppercase: pool.Policies?.PasswordPolicy?.RequireUppercase ?? pool.passwordPolicy?.requireUppercase ?? false,
        requireLowercase: pool.Policies?.PasswordPolicy?.RequireLowercase ?? pool.passwordPolicy?.requireLowercase ?? false,
        requireNumbers: pool.Policies?.PasswordPolicy?.RequireNumbers ?? pool.passwordPolicy?.requireNumbers ?? false,
        requireSymbols: pool.Policies?.PasswordPolicy?.RequireSymbols ?? pool.passwordPolicy?.requireSymbols ?? false,
      },
      riskConfiguration: riskConfig ? {
        riskLevel: "LOW",
        compromisedCredentialsRiskConfiguration: riskConfig.CompromisedCredentialsRiskConfiguration ? {
          actions: { eventAction: "BLOCK" },
        } : null,
      } : null,
      deviceConfiguration: {
        challengeRequiredOnNewDevice: pool.DeviceConfiguration?.ChallengeRequiredOnNewDevice ?? false,
        deviceOnlyRememberedOnUserPrompt: pool.DeviceConfiguration?.DeviceOnlyRememberedOnUserPrompt ?? false,
      },
      userCount: pool.EstimatedNumberOfUsers || 0,
      status: pool.Status || "Active",
    };

    return snapshot;
  }

  private createFixtureCognitoSnapshot(targetId: string): CognitoSnapshot {
    return {
      userPoolId: targetId,
      mfaConfiguration: "OFF",
      passwordPolicy: {
        minimumLength: 8,
        requireUppercase: false,
        requireLowercase: true,
        requireNumbers: false,
        requireSymbols: false,
      },
      riskConfiguration: null,
      deviceConfiguration: {
        challengeRequiredOnNewDevice: false,
        deviceOnlyRememberedOnUserPrompt: true,
      },
    };
  }

  private createFixtureS3Snapshot(targetId: string): S3Snapshot {
    return {
      bucketName: targetId,
      publicAccessBlock: false,
      encryption: null,
      versioning: "Disabled",
      logging: false,
    };
  }

  private async fetchAwsCognitoSnapshot(userPoolId: string): Promise<CognitoSnapshot> {
    const {
      CognitoIdentityProviderClient,
      DescribeUserPoolCommand,
      GetUserPoolMfaConfigCommand,
    } = await import("@aws-sdk/client-cognito-identity-provider");

    const client = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION || "us-west-2",
    });

    try {
      const describeCommand = new DescribeUserPoolCommand({ UserPoolId: userPoolId });
      const describeResponse = await client.send(describeCommand);

      if (!describeResponse.UserPool) {
        throw new Error(`User pool not found: ${userPoolId}`);
      }

      const pool = describeResponse.UserPool;

      const mfaCommand = new GetUserPoolMfaConfigCommand({ UserPoolId: userPoolId });
      const mfaResponse = await client.send(mfaCommand);

      const snapshot: CognitoSnapshot = {
        userPoolId,
        mfaConfiguration: mfaResponse.MfaConfiguration || "OFF",
        passwordPolicy: {
          minimumLength: pool.Policies?.PasswordPolicy?.MinimumLength || 8,
          requireUppercase: pool.Policies?.PasswordPolicy?.RequireUppercase ?? false,
          requireLowercase: pool.Policies?.PasswordPolicy?.RequireLowercase ?? false,
          requireNumbers: pool.Policies?.PasswordPolicy?.RequireNumbers ?? false,
          requireSymbols: pool.Policies?.PasswordPolicy?.RequireSymbols ?? false,
        },
        riskConfiguration: pool.UserPoolAddOns?.AdvancedSecurityMode === "ENFORCED" ? {
          riskLevel: "LOW",
          compromisedCredentialsRiskConfiguration: {
            actions: { eventAction: "BLOCK" },
          },
        } : null,
        deviceConfiguration: {
          challengeRequiredOnNewDevice: pool.DeviceConfiguration?.ChallengeRequiredOnNewDevice ?? false,
          deviceOnlyRememberedOnUserPrompt: pool.DeviceConfiguration?.DeviceOnlyRememberedOnUserPrompt ?? false,
        },
      };

      return snapshot;
    } catch (error) {
      throw new Error(`Failed to fetch AWS Cognito snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fetchAwsS3Snapshot(bucketName: string): Promise<S3Snapshot> {
    const {
      S3Client,
      GetPublicAccessBlockCommand,
      GetBucketEncryptionCommand,
      GetBucketVersioningCommand,
      GetBucketLoggingCommand,
    } = await import("@aws-sdk/client-s3");

    const client = new S3Client({
      region: process.env.AWS_REGION || "us-west-2",
    });

    try {
      let publicAccessBlock = false;
      try {
        const publicAccessCommand = new GetPublicAccessBlockCommand({ Bucket: bucketName });
        const publicAccessResponse = await client.send(publicAccessCommand);
        const config = publicAccessResponse.PublicAccessBlockConfiguration;
        publicAccessBlock = !!(
          config?.BlockPublicAcls &&
          config?.BlockPublicPolicy &&
          config?.IgnorePublicAcls &&
          config?.RestrictPublicBuckets
        );
      } catch (error) {
        publicAccessBlock = false;
      }

      let encryption: "AES256" | "aws:kms" | null = null;
      try {
        const encryptionCommand = new GetBucketEncryptionCommand({ Bucket: bucketName });
        const encryptionResponse = await client.send(encryptionCommand);
        const rule = encryptionResponse.ServerSideEncryptionConfiguration?.Rules?.[0];
        const algo = rule?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm;
        if (algo === "AES256") encryption = "AES256";
        else if (algo === "aws:kms") encryption = "aws:kms";
      } catch (error) {
        encryption = null;
      }

      let versioning: "Enabled" | "Disabled" = "Disabled";
      try {
        const versioningCommand = new GetBucketVersioningCommand({ Bucket: bucketName });
        const versioningResponse = await client.send(versioningCommand);
        versioning = versioningResponse.Status === "Enabled" ? "Enabled" : "Disabled";
      } catch (error) {
        versioning = "Disabled";
      }

      let logging = false;
      try {
        const loggingCommand = new GetBucketLoggingCommand({ Bucket: bucketName });
        const loggingResponse = await client.send(loggingCommand);
        logging = !!loggingResponse.LoggingEnabled;
      } catch (error) {
        logging = false;
      }

      const snapshot: S3Snapshot = {
        bucketName,
        publicAccessBlock,
        encryption,
        versioning,
        logging,
      };

      return snapshot;
    } catch (error) {
      throw new Error(`Failed to fetch AWS S3 snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
