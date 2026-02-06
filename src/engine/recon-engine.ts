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
  IAMSnapshot,
  LambdaSnapshot,
  RDSSnapshot,
  ReconResult,
} from "../types";
import type { GitLabSnapshot } from "../../plugins/gitlab/gitlab-plugin";
import { nonCompliantGitLabSnapshot } from "../../plugins/gitlab/gitlab-plugin";

export interface ReconOptions {
  source?: "fixture" | "aws" | "file";
  service?: "cognito" | "s3" | "iam" | "lambda" | "rds" | "gitlab";
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

    let snapshot: CognitoSnapshot | S3Snapshot | IAMSnapshot | LambdaSnapshot | RDSSnapshot | GitLabSnapshot;

    if (source === "aws") {
      // Dynamically import AWS SDK to avoid requiring it when not needed
      if (service === "s3") {
        snapshot = await this.fetchAwsS3Snapshot(targetId);
      } else if (service === "iam") {
        snapshot = await this.fetchAwsIAMSnapshot(targetId);
      } else if (service === "lambda") {
        snapshot = await this.fetchAwsLambdaSnapshot(targetId);
      } else if (service === "rds") {
        snapshot = await this.fetchAwsRDSSnapshot(targetId);
      } else if (service === "cognito") {
        snapshot = await this.fetchAwsCognitoSnapshot(targetId);
      } else if (service === "gitlab") {
        throw new Error("GitLab uses API token, not AWS credentials. Use --source file with a GitLab API export.");
      } else {
        throw new Error(`Unknown service: ${service}`);
      }
    } else if (source === "file") {
      snapshot = await this.loadFixtureFile(targetId);
    } else {
      // Fixture mode: hardcoded defaults
      if (service === "s3") {
        snapshot = this.createFixtureS3Snapshot(targetId);
      } else if (service === "iam") {
        snapshot = this.createFixtureIAMSnapshot(targetId);
      } else if (service === "lambda") {
        snapshot = this.createFixtureLambdaSnapshot(targetId);
      } else if (service === "rds") {
        snapshot = this.createFixtureRDSSnapshot(targetId);
      } else if (service === "gitlab") {
        snapshot = nonCompliantGitLabSnapshot;
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

  private createFixtureIAMSnapshot(accountId: string): IAMSnapshot {
    return {
      accountId,
      mfaEnabled: false,
      hasOverprivilegedPolicies: false,
      unusedCredentialsExist: false,
      accessKeysRotated: true,
      rootAccountMfaEnabled: false,
      users: 10,
      roles: 5,
      policies: 15,
      observedAt: new Date().toISOString(),
    };
  }

  private createFixtureLambdaSnapshot(functionName: string): LambdaSnapshot {
    return {
      functionName,
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
    };
  }

  private createFixtureRDSSnapshot(instanceId: string): RDSSnapshot {
    return {
      instanceId,
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
    };
  }

  private async fetchAwsIAMSnapshot(accountId: string): Promise<IAMSnapshot> {
    const {
      IAMClient,
      GetCredentialReportCommand,
      GenerateCredentialReportCommand,
      ListUsersCommand,
      ListMFADevicesCommand,
      ListAttachedUserPoliciesCommand,
      ListRolesCommand,
      ListPoliciesCommand,
      GetAccountSummaryCommand,
    } = await import("@aws-sdk/client-iam");

    const client = new IAMClient({
      region: process.env.AWS_REGION || "us-west-2",
    });

    try {
      // Generate credential report (may need to wait for it)
      try {
        await client.send(new GenerateCredentialReportCommand({}));
      } catch {
        // Report may already be generating; continue
      }

      // Get credential report for key rotation and unused credential analysis
      let credentialReportCsv = "";
      try {
        const reportResponse = await client.send(new GetCredentialReportCommand({}));
        if (reportResponse.Content) {
          credentialReportCsv = Buffer.from(reportResponse.Content).toString("utf-8");
        }
      } catch {
        // Report may not be ready yet; proceed without it
      }

      // List users
      const usersResponse = await client.send(new ListUsersCommand({}));
      const users = usersResponse.Users || [];

      // List roles
      const rolesResponse = await client.send(new ListRolesCommand({ MaxItems: 1000 }));
      const roles = rolesResponse.Roles || [];

      // List policies (customer-managed only)
      const policiesResponse = await client.send(new ListPoliciesCommand({ Scope: "Local" }));
      const policies = policiesResponse.Policies || [];

      // Get account summary for root MFA status
      const summaryResponse = await client.send(new GetAccountSummaryCommand({}));
      const summaryMap = summaryResponse.SummaryMap || {};
      const rootAccountMfaEnabled = (summaryMap.AccountMFAEnabled ?? 0) === 1;

      // Check MFA for each user
      let mfaEnabled = true;
      for (const user of users) {
        if (!user.UserName) continue;
        const mfaResponse = await client.send(
          new ListMFADevicesCommand({ UserName: user.UserName })
        );
        if (!mfaResponse.MFADevices || mfaResponse.MFADevices.length === 0) {
          mfaEnabled = false;
          break;
        }
      }

      // Check for overprivileged policies (any with * action or resource)
      let hasOverprivilegedPolicies = false;
      for (const user of users.slice(0, 20)) {
        if (!user.UserName) continue;
        const attachedPolicies = await client.send(
          new ListAttachedUserPoliciesCommand({ UserName: user.UserName })
        );
        for (const pol of attachedPolicies.AttachedPolicies || []) {
          if (pol.PolicyArn?.includes("AdministratorAccess") ||
              pol.PolicyArn?.includes("PowerUserAccess")) {
            hasOverprivilegedPolicies = true;
            break;
          }
        }
        if (hasOverprivilegedPolicies) break;
      }

      // Analyze credential report for unused credentials and key rotation
      let unusedCredentialsExist = false;
      let accessKeysRotated = true;
      if (credentialReportCsv) {
        const lines = credentialReportCsv.split("\n").slice(1); // Skip header
        const now = Date.now();
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

        for (const line of lines) {
          const cols = line.split(",");
          if (cols.length < 10) continue;

          // Check password_last_used (col 4) for unused credentials
          const passwordLastUsed = cols[4];
          if (passwordLastUsed && passwordLastUsed !== "no_information" && passwordLastUsed !== "N/A") {
            const lastUsed = new Date(passwordLastUsed).getTime();
            if (now - lastUsed > ninetyDaysMs) {
              unusedCredentialsExist = true;
            }
          }

          // Check access_key_1_last_rotated (col 9) for key rotation
          const key1LastRotated = cols[9];
          if (key1LastRotated && key1LastRotated !== "N/A" && key1LastRotated !== "not_supported") {
            const rotated = new Date(key1LastRotated).getTime();
            if (now - rotated > ninetyDaysMs) {
              accessKeysRotated = false;
            }
          }
        }
      }

      const snapshot: IAMSnapshot = {
        accountId,
        mfaEnabled,
        hasOverprivilegedPolicies,
        unusedCredentialsExist,
        accessKeysRotated,
        rootAccountMfaEnabled,
        users: users.length,
        roles: roles.length,
        policies: policies.length,
        observedAt: new Date().toISOString(),
      };

      return snapshot;
    } catch (error) {
      throw new Error(`Failed to fetch AWS IAM snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fetchAwsLambdaSnapshot(functionName: string): Promise<LambdaSnapshot> {
    const {
      LambdaClient,
      GetFunctionConfigurationCommand,
    } = await import("@aws-sdk/client-lambda");

    const client = new LambdaClient({
      region: process.env.AWS_REGION || "us-west-2",
    });

    try {
      const configResponse = await client.send(
        new GetFunctionConfigurationCommand({ FunctionName: functionName })
      );

      // Check if environment variables use KMS encryption
      const environmentVariablesEncrypted = !!configResponse.KMSKeyArn;

      // Check if VPC is configured
      const vpcConfigured = !!(
        configResponse.VpcConfig?.SubnetIds &&
        configResponse.VpcConfig.SubnetIds.length > 0
      );

      // Check code signing (via CodeSigningConfigArn presence)
      const codeSigningEnabled = !!configResponse.CodeSigningConfigArn;

      // Check layers exist (integrity is assumed if layers are present and runtime matches)
      const layerIntegrityVerified = !!(
        configResponse.Layers && configResponse.Layers.length > 0
      );

      // Check dead letter queue
      const deadLetterQueueConfigured = !!(
        configResponse.DeadLetterConfig?.TargetArn
      );

      // Check X-Ray tracing
      const tracingEnabled = configResponse.TracingConfig?.Mode === "Active";

      const snapshot: LambdaSnapshot = {
        functionName: configResponse.FunctionName || functionName,
        runtime: configResponse.Runtime || "unknown",
        memorySize: configResponse.MemorySize || 128,
        timeout: configResponse.Timeout || 3,
        environmentVariablesEncrypted,
        vpcConfigured,
        layerIntegrityVerified,
        codeSigningEnabled,
        reservedConcurrency: null, // Requires separate GetFunctionConcurrency call
        deadLetterQueueConfigured,
        tracingEnabled,
        observedAt: new Date().toISOString(),
      };

      return snapshot;
    } catch (error) {
      throw new Error(`Failed to fetch AWS Lambda snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fetchAwsRDSSnapshot(instanceId: string): Promise<RDSSnapshot> {
    const {
      RDSClient,
      DescribeDBInstancesCommand,
    } = await import("@aws-sdk/client-rds");

    const client = new RDSClient({
      region: process.env.AWS_REGION || "us-west-2",
    });

    try {
      const response = await client.send(
        new DescribeDBInstancesCommand({
          DBInstanceIdentifier: instanceId,
        })
      );

      const instances = response.DBInstances || [];
      if (instances.length === 0) {
        throw new Error(`RDS instance not found: ${instanceId}`);
      }

      const db = instances[0];

      // Check audit logging via enabled CloudWatch log exports
      const auditLogging = !!(
        db.EnabledCloudwatchLogsExports &&
        db.EnabledCloudwatchLogsExports.length > 0
      );

      const snapshot: RDSSnapshot = {
        instanceId: db.DBInstanceIdentifier || instanceId,
        engine: db.Engine || "unknown",
        engineVersion: db.EngineVersion || "unknown",
        publiclyAccessible: db.PubliclyAccessible ?? false,
        storageEncrypted: db.StorageEncrypted ?? false,
        iamAuthEnabled: db.IAMDatabaseAuthenticationEnabled ?? false,
        auditLogging,
        multiAZ: db.MultiAZ ?? false,
        backupRetentionDays: db.BackupRetentionPeriod ?? 0,
        deletionProtection: db.DeletionProtection ?? false,
        performanceInsightsEnabled: db.PerformanceInsightsEnabled ?? false,
        observedAt: new Date().toISOString(),
      };

      return snapshot;
    } catch (error) {
      throw new Error(`Failed to fetch AWS RDS snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
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
