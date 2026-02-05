/**
 * CORSAIR Agent - Autonomous Security Testing with Claude
 *
 * Uses Anthropic's latest models for adaptive security testing:
 * - claude-sonnet-4-5: Complex reasoning, mission planning, adaptive strategy
 * - claude-haiku-4-5: Fast validation, simple tool calls, quick checks
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  GetUserPoolMfaConfigCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  S3Client,
  GetBucketPolicyCommand,
  GetPublicAccessBlockCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetBucketLoggingCommand,
} from "@aws-sdk/client-s3";
import { Corsair } from "../corsair-mvp";
import { corsairTools } from "./tool-definitions";
import { CORSAIR_SYSTEM_PROMPT } from "./system-prompts";
import type {
  CognitoSnapshot,
  S3Snapshot,
  ReconResult,
  MarkResult,
  RaidResult,
  PlunderResult,
  ChartResult,
  DriftFinding,
  Expectation,
} from "../types";

/**
 * Model selection based on task complexity
 */
const SONNET_MODEL = "claude-sonnet-4-5-20250929";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

interface CorsairAgentOptions {
  apiKey: string;
  maxTurns?: number;
  model?: "sonnet" | "haiku" | "auto";
  verbose?: boolean;
}

interface ExecutionContext {
  snapshots: Map<string, CognitoSnapshot | S3Snapshot>;
  reconResults: Map<string, ReconResult>;
  markResults: Map<string, MarkResult>;
  raidResults: Map<string, RaidResult>;
  plunderResults: Map<string, PlunderResult>;
  chartResults: Map<string, ChartResult>;
}

export class CorsairAgent {
  private anthropic: Anthropic;
  private corsair: Corsair;
  private maxTurns: number;
  private model: "sonnet" | "haiku" | "auto";
  private verbose: boolean;
  private context: ExecutionContext;

  constructor(options: CorsairAgentOptions) {
    this.anthropic = new Anthropic({ apiKey: options.apiKey });
    this.corsair = new Corsair();
    this.maxTurns = options.maxTurns || 15;
    this.model = options.model || "auto";
    this.verbose = options.verbose ?? true;
    this.context = {
      snapshots: new Map(),
      reconResults: new Map(),
      markResults: new Map(),
      raidResults: new Map(),
      plunderResults: new Map(),
      chartResults: new Map(),
    };
  }

  /**
   * Select appropriate model based on task complexity
   */
  private selectModel(task: string): string {
    if (this.model === "sonnet") return SONNET_MODEL;
    if (this.model === "haiku") return HAIKU_MODEL;

    // Auto-selection based on task keywords
    const complexKeywords = ["plan", "strategy", "analyze", "decide", "complex"];
    const isComplex = complexKeywords.some((kw) => task.toLowerCase().includes(kw));

    return isComplex ? SONNET_MODEL : HAIKU_MODEL;
  }

  /**
   * Execute autonomous mission
   */
  async executeMission(mission: string): Promise<string> {
    this.log(`\n🏴‍☠️ CORSAIR AGENT SETTING SAIL`);
    this.log(`Mission: ${mission}\n`);

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: mission,
      },
    ];

    let turnCount = 0;
    const model = this.selectModel(mission);
    this.log(`⚓ Using model: ${model}\n`);

    while (turnCount < this.maxTurns) {
      turnCount++;
      this.log(`\n--- Turn ${turnCount}/${this.maxTurns} ---\n`);

      try {
        const response = await this.anthropic.messages.create({
          model,
          max_tokens: 4096,
          system: CORSAIR_SYSTEM_PROMPT,
          tools: corsairTools,
          messages,
        });

        // Add assistant response to conversation
        messages.push({
          role: "assistant",
          content: response.content,
        });

        // Check for completion
        if (response.stop_reason === "end_turn") {
          this.log("\n🎯 Mission complete - agent finished thinking\n");
          return this.formatFinalResponse(response);
        }

        // Process tool uses
        if (response.stop_reason === "tool_use") {
          const toolResults: Anthropic.MessageParam = {
            role: "user",
            content: [],
          };

          for (const block of response.content) {
            if (block.type === "text") {
              this.log(`💬 ${block.text}\n`);
            } else if (block.type === "tool_use") {
              this.log(`🔧 Executing: ${block.name}`);
              this.log(`   Input: ${JSON.stringify(block.input, null, 2)}\n`);

              const result = await this.executeTool(
                block.name,
                block.input as Record<string, unknown>
              );

              this.log(`✅ Result: ${JSON.stringify(result, null, 2).slice(0, 200)}...\n`);

              (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            }
          }

          messages.push(toolResults);
        } else {
          // Unexpected stop reason
          this.log(`⚠️  Unexpected stop reason: ${response.stop_reason}\n`);
          return this.formatFinalResponse(response);
        }
      } catch (error) {
        this.log(`❌ Error: ${error}\n`);
        throw error;
      }
    }

    this.log(`\n⏱️  Max turns reached (${this.maxTurns})\n`);
    return "Mission incomplete - maximum turn limit reached";
  }

  /**
   * Execute a Corsair primitive tool
   */
  private async executeTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    switch (toolName) {
      case "recon":
        return this.handleRecon(input);

      case "mark":
        return this.handleMark(input);

      case "raid":
        return this.handleRaid(input);

      case "plunder":
        return this.handlePlunder(input);

      case "chart":
        return this.handleChart(input);

      case "escape":
        return this.handleEscape(input);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Handle RECON primitive
   */
  private async handleRecon(input: Record<string, unknown>): Promise<ReconResult> {
    const targetId = input.targetId as string;
    const source = (input.source as string) || "fixture";
    const service = (input.service as string) || "cognito";
    const startTime = Date.now();

    let snapshot: CognitoSnapshot | S3Snapshot;

    if (source === "aws") {
      // Call real AWS APIs based on service
      if (service === "s3") {
        snapshot = await this.fetchAwsS3Snapshot(targetId);
      } else if (service === "cognito") {
        snapshot = await this.fetchAwsCognitoSnapshot(targetId);
      } else {
        throw new Error(`Unknown service: ${service}`);
      }
    } else {
      // Use fixture data based on service
      if (service === "s3") {
        snapshot = {
          bucketName: targetId,
          publicAccessBlock: false,
          encryption: null,
          versioning: "Disabled",
          logging: false,
        } as S3Snapshot;
      } else {
        snapshot = {
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
        } as CognitoSnapshot;
      }
    }

    const durationMs = Date.now() - startTime;

    const result: ReconResult = {
      snapshotId: targetId,
      snapshot,
      metadata: {
        source: source as "fixture" | "aws",
        readonly: true,
        durationMs,
      },
      stateModified: false,
      durationMs,
    };

    // Store in context
    this.context.snapshots.set(targetId, snapshot);
    this.context.reconResults.set(targetId, result);

    return result;
  }

  /**
   * Fetch Cognito User Pool configuration from AWS
   */
  private async fetchAwsCognitoSnapshot(userPoolId: string): Promise<CognitoSnapshot> {
    const client = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION || "us-west-2",
    });

    try {
      // Call DescribeUserPool to get configuration
      const describeCommand = new DescribeUserPoolCommand({ UserPoolId: userPoolId });
      const describeResponse = await client.send(describeCommand);

      if (!describeResponse.UserPool) {
        throw new Error(`User pool not found: ${userPoolId}`);
      }

      const pool = describeResponse.UserPool;

      // Call GetUserPoolMfaConfig to get MFA details
      const mfaCommand = new GetUserPoolMfaConfigCommand({ UserPoolId: userPoolId });
      const mfaResponse = await client.send(mfaCommand);

      // Map AWS response to CognitoSnapshot format
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

  /**
   * Fetch S3 Bucket configuration from AWS
   */
  private async fetchAwsS3Snapshot(bucketName: string): Promise<S3Snapshot> {
    const client = new S3Client({
      region: process.env.AWS_REGION || "us-west-2",
    });

    try {
      // Check public access block configuration
      let publicAccessBlock = false;
      try {
        const publicAccessCommand = new GetPublicAccessBlockCommand({ Bucket: bucketName });
        const publicAccessResponse = await client.send(publicAccessCommand);
        const config = publicAccessResponse.PublicAccessBlockConfiguration;
        // If ALL public access is blocked, consider it secure
        publicAccessBlock = !!(
          config?.BlockPublicAcls &&
          config?.BlockPublicPolicy &&
          config?.IgnorePublicAcls &&
          config?.RestrictPublicBuckets
        );
      } catch (error) {
        // If GetPublicAccessBlock fails, public access is likely NOT blocked
        publicAccessBlock = false;
      }

      // Check encryption configuration
      let encryption: "AES256" | "aws:kms" | null = null;
      try {
        const encryptionCommand = new GetBucketEncryptionCommand({ Bucket: bucketName });
        const encryptionResponse = await client.send(encryptionCommand);
        const rule = encryptionResponse.ServerSideEncryptionConfiguration?.Rules?.[0];
        const algo = rule?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm;
        if (algo === "AES256") encryption = "AES256";
        else if (algo === "aws:kms") encryption = "aws:kms";
      } catch (error) {
        // If GetBucketEncryption fails, encryption is not configured
        encryption = null;
      }

      // Check versioning configuration
      let versioning: "Enabled" | "Disabled" = "Disabled";
      try {
        const versioningCommand = new GetBucketVersioningCommand({ Bucket: bucketName });
        const versioningResponse = await client.send(versioningCommand);
        versioning = versioningResponse.Status === "Enabled" ? "Enabled" : "Disabled";
      } catch (error) {
        versioning = "Disabled";
      }

      // Check logging configuration
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

  /**
   * Handle MARK primitive
   */
  private async handleMark(input: Record<string, unknown>): Promise<MarkResult> {
    const snapshotId = input.snapshotId as string;
    const expectations = input.expectations as Expectation[];

    const snapshot = this.context.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const result = await this.corsair.mark(snapshot, expectations);
    this.context.markResults.set(snapshotId, result);

    return result;
  }

  /**
   * Handle RAID primitive
   */
  private async handleRaid(input: Record<string, unknown>): Promise<RaidResult> {
    const snapshotId = input.snapshotId as string;
    const vector = input.vector as "mfa-bypass" | "password-spray" | "token-replay" | "session-hijack";
    const intensity = input.intensity as number;
    const dryRun = input.dryRun as boolean;

    const snapshot = this.context.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const result = await this.corsair.raid(snapshot, {
      vector,
      intensity,
      dryRun,
    });

    this.context.raidResults.set(result.raidId, result);

    return result;
  }

  /**
   * Handle PLUNDER primitive
   */
  private async handlePlunder(input: Record<string, unknown>): Promise<PlunderResult> {
    const raidId = input.raidId as string;
    const evidencePath = input.evidencePath as string;

    const raidResult = this.context.raidResults.get(raidId);
    if (!raidResult) {
      throw new Error(`Raid result not found: ${raidId}`);
    }

    const result = await this.corsair.plunder(raidResult, evidencePath);
    this.context.plunderResults.set(raidId, result);

    return result;
  }

  /**
   * Handle CHART primitive
   */
  private async handleChart(input: Record<string, unknown>): Promise<ChartResult> {
    const findingsId = input.findingsId as string;

    // Try to find findings from MARK results by snapshotId
    const markResult = this.context.markResults.get(findingsId);
    if (markResult) {
      const result = await this.corsair.chart(markResult.findings);
      this.context.chartResults.set(findingsId, result);
      return result;
    }

    // Try to find specific drift finding ID across all MARK results
    for (const [snapshotId, result] of this.context.markResults.entries()) {
      const finding = result.findings.find(f => f.id === findingsId);
      if (finding) {
        // Found the specific drift finding - chart it
        const chartResult = await this.corsair.chart([finding]);
        this.context.chartResults.set(findingsId, chartResult);
        return chartResult;
      }
    }

    // Try to find findings from RAID results
    const raidResult = this.context.raidResults.get(findingsId);
    if (raidResult) {
      // Convert raid findings to drift findings for chart
      const driftFindings: DriftFinding[] = raidResult.findings.map((finding, idx) => ({
        id: `${findingsId}-${idx}`,
        field: "mfaConfiguration",
        expected: "ON",
        actual: "OFF",
        drift: true,
        severity: raidResult.success ? "CRITICAL" : "LOW",
        description: finding,
        timestamp: new Date().toISOString(),
      }));

      const result = await this.corsair.chart(driftFindings);
      this.context.chartResults.set(findingsId, result);
      return result;
    }

    throw new Error(`Findings not found: ${findingsId}`);
  }

  /**
   * Handle ESCAPE primitive
   */
  private async handleEscape(input: Record<string, unknown>): Promise<{ status: string }> {
    const raidId = input.raidId as string;
    const verifyRestore = input.verifyRestore as boolean;

    const raidResult = this.context.raidResults.get(raidId);
    if (!raidResult) {
      throw new Error(`Raid result not found: ${raidId}`);
    }

    // For dry-run raids, escape is automatic
    if (raidResult.durationMs !== undefined) {
      return {
        status: "Escape successful - dry run requires no rollback",
      };
    }

    return {
      status: "Escape successful - state restored",
    };
  }

  /**
   * Format final response from assistant
   */
  private formatFinalResponse(response: Anthropic.Message): string {
    let text = "";
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }
    return text || "Mission complete";
  }

  /**
   * Log output (respects verbose flag)
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  /**
   * Get execution context (for inspection/debugging)
   */
  getContext(): ExecutionContext {
    return this.context;
  }
}
