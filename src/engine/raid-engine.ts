/**
 * RAID Engine - Controlled Chaos Execution
 *
 * Extracted from corsair-mvp.ts.
 * Provides lane serialization, approval gates, and attack simulation.
 */

import { EventEmitter } from "events";
import type {
  CognitoSnapshot,
  AttackVector,
  Severity,
  TimelineEvent,
  RaidResult,
  RaidOptions,
  RaidOptionsWithApproval,
  ApprovalRequest,
  ApprovalResponse,
  CorsairEvent,
  S3Snapshot,
} from "../types";

/** Any snapshot shape accepted by RaidEngine */
type AnySnapshot = CognitoSnapshot | S3Snapshot | Record<string, unknown>;

// ===============================================================================
// LANE SERIALIZATION (Prevent Concurrent Raids)
// ===============================================================================

export class LaneSerializer {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(target: string): Promise<() => void> {
    const key = target;

    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    let release!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(key, lockPromise);

    return () => {
      this.locks.delete(key);
      release();
    };
  }
}

// ===============================================================================
// RAID ENGINE
// ===============================================================================

export class RaidEngine {
  private emitter: EventEmitter;
  private events: CorsairEvent[];
  private laneSerializer = new LaneSerializer();

  constructor(emitter: EventEmitter, events: CorsairEvent[]) {
    this.emitter = emitter;
    this.events = events;
  }

  private getVectorSeverity(vector: AttackVector): Severity {
    const severityMap: Record<string, Severity> = {
      "mfa-bypass": "CRITICAL",
      "token-replay": "CRITICAL",
      "session-hijack": "HIGH",
      "password-spray": "MEDIUM",
    };
    return severityMap[vector] || "MEDIUM";
  }

  private requiresApproval(vectorSeverity: Severity, gateSeverity: Severity): boolean {
    const severityLevels: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const vectorLevel = severityLevels.indexOf(vectorSeverity);
    const gateLevel = severityLevels.indexOf(gateSeverity);
    return vectorLevel >= gateLevel;
  }

  private getTargetId(snapshot: AnySnapshot): string {
    return (snapshot as Record<string, unknown>).userPoolId as string
      || (snapshot as Record<string, unknown>).bucketName as string
      || (snapshot as Record<string, unknown>).resourceId as string
      || "unknown";
  }

  private calculateBlastRadius(
    snapshot: AnySnapshot,
    vector: AttackVector,
    intensity: number
  ): ApprovalRequest["blastRadius"] {
    return {
      affectedUsers: (snapshot as Record<string, unknown>).userCount as number || 0,
      affectedResources: [this.getTargetId(snapshot)],
      environment: "test",
    };
  }

  async raid(snapshot: AnySnapshot, options: RaidOptions | RaidOptionsWithApproval): Promise<RaidResult> {
    const raidId = `RAID-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const timeline: TimelineEvent[] = [];
    const findings: string[] = [];

    const approvalGate = (options as RaidOptionsWithApproval).approvalGate;
    const requestApproval = (options as RaidOptionsWithApproval).requestApproval;

    const vectorSeverity = this.getVectorSeverity(options.vector);
    let approvalResult: ApprovalResponse | null = null;
    let approvalRequired = false;

    const targetId = this.getTargetId(snapshot);

    if (approvalGate && this.requiresApproval(vectorSeverity, approvalGate.requiredSeverity)) {
      approvalRequired = true;

      if (!requestApproval) {
        throw new Error("Approval gate configured but no requestApproval function provided");
      }

      const approvalRequest: ApprovalRequest = {
        gate: approvalGate,
        vector: options.vector,
        intensity: options.intensity,
        targetId,
        blastRadius: this.calculateBlastRadius(snapshot, options.vector, options.intensity),
        requestedAt: new Date().toISOString(),
      };

      try {
        approvalResult = await Promise.race([
          requestApproval(approvalRequest),
          new Promise<ApprovalResponse>((_, reject) =>
            setTimeout(() => reject(new Error("Approval timeout")), approvalGate.timeoutMs)
          ),
        ]);
      } catch (error) {
        throw error;
      }

      if (!approvalResult.approved) {
        throw new Error(`Approval denied: ${approvalResult.reason || "No reason provided"}`);
      }

      timeline.push({
        timestamp: new Date().toISOString(),
        action: "APPROVAL_GRANTED",
        result: `Approved by ${approvalResult.approver}`,
      });
    }

    const release = await this.laneSerializer.acquire(targetId);

    try {
      timeline.push({
        timestamp: new Date().toISOString(),
        action: "RAID_START",
        result: `Initiating ${options.vector} attack on ${targetId}`,
      });

      const success = await this.simulateAttack(snapshot, options, timeline, findings);

      timeline.push({
        timestamp: new Date().toISOString(),
        action: "RAID_COMPLETE",
        result: success ? "Attack succeeded - controls bypassed" : "Attack failed - controls held",
      });

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      const result: RaidResult = {
        raidId,
        target: targetId,
        vector: options.vector,
        success,
        controlsHeld: !success,
        findings,
        timeline,
        startedAt,
        completedAt,
        serialized: true,
        durationMs,
        approvalRequired,
        approved: approvalResult?.approved,
        approver: approvalResult?.approver,
        approvalTimestamp: approvalResult?.timestamp,
      };

      const event: CorsairEvent = {
        type: "raid:complete",
        timestamp: completedAt,
        targetId,
        vector: options.vector,
        success,
        severity: vectorSeverity,
        findings,
        metadata: {
          intensity: options.intensity,
          controlsHeld: !success,
          durationMs,
          raidId,
        },
      };

      this.emitter.emit("raid:complete", event);
      this.events.push(event);

      return result;
    } finally {
      release();
    }
  }

  private async simulateAttack(
    snapshot: AnySnapshot,
    options: RaidOptions,
    timeline: TimelineEvent[],
    findings: string[]
  ): Promise<boolean> {
    const { vector, intensity } = options;

    // S3 attack vectors
    if (vector === "public-access-test" || vector === "encryption-test" || vector === "versioning-test") {
      return this.simulateS3Attack(snapshot as S3Snapshot, vector, intensity, timeline, findings);
    }

    // Cognito attack vectors (legacy)
    const cognitoSnapshot = snapshot as CognitoSnapshot;
    switch (vector) {
      case "mfa-bypass": {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: "CHECK_MFA",
          result: `MFA Configuration: ${cognitoSnapshot.mfaConfiguration}`,
        });

        if (cognitoSnapshot.mfaConfiguration === "OFF") {
          findings.push("CRITICAL: MFA is disabled - bypass trivial");
          findings.push("MFA bypass successful - no second factor required");
          return true;
        }

        if (cognitoSnapshot.mfaConfiguration === "OPTIONAL") {
          findings.push("WARNING: MFA is optional - user may bypass");
          findings.push("MFA bypass possible for users without MFA configured");
          return intensity > 5;
        }

        findings.push("MFA is enforced - bypass blocked");
        return false;
      }

      case "password-spray": {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: "CHECK_PASSWORD_POLICY",
          result: `Min length: ${cognitoSnapshot.passwordPolicy.minimumLength}`,
        });

        const weakPolicy =
          cognitoSnapshot.passwordPolicy.minimumLength < 12 ||
          !cognitoSnapshot.passwordPolicy.requireSymbols ||
          !cognitoSnapshot.passwordPolicy.requireUppercase;

        if (weakPolicy) {
          findings.push("WARNING: Weak password policy detected");
          findings.push(`Minimum length: ${cognitoSnapshot.passwordPolicy.minimumLength}`);
          return intensity > 7;
        }

        findings.push("Password policy is strong - spray attack mitigated");
        return false;
      }

      case "token-replay": {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: "CHECK_TOKEN_HANDLING",
          result: "Analyzing token configuration",
        });

        if (!cognitoSnapshot.riskConfiguration) {
          findings.push("WARNING: No risk configuration - token replay detection limited");
          return intensity > 6;
        }

        findings.push("Risk configuration active - token replay monitored");
        return false;
      }

      case "session-hijack": {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: "CHECK_DEVICE_CONFIG",
          result: `Challenge on new device: ${cognitoSnapshot.deviceConfiguration.challengeRequiredOnNewDevice}`,
        });

        if (!cognitoSnapshot.deviceConfiguration.challengeRequiredOnNewDevice) {
          findings.push("WARNING: No device challenge - session hijack easier");
          return intensity > 5;
        }

        findings.push("Device challenge enabled - session hijack mitigated");
        return false;
      }

      default:
        return false;
    }
  }

  private simulateS3Attack(
    snapshot: S3Snapshot,
    vector: string,
    intensity: number,
    timeline: TimelineEvent[],
    findings: string[]
  ): boolean {
    switch (vector) {
      case "public-access-test": {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: "CHECK_PUBLIC_ACCESS",
          result: `Public access block: ${snapshot.publicAccessBlock}`,
        });

        if (!snapshot.publicAccessBlock) {
          findings.push("CRITICAL: Public access block is disabled");
          findings.push("Bucket may be publicly accessible");
          return true;
        }

        findings.push("Public access block is enabled - bucket protected");
        return false;
      }

      case "encryption-test": {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: "CHECK_ENCRYPTION",
          result: `Encryption: ${snapshot.encryption || "none"}`,
        });

        if (!snapshot.encryption) {
          findings.push("CRITICAL: No encryption configured");
          findings.push("Data at rest is unencrypted");
          return true;
        }

        findings.push(`Encryption enabled: ${snapshot.encryption}`);
        return false;
      }

      case "versioning-test": {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: "CHECK_VERSIONING",
          result: `Versioning: ${snapshot.versioning}`,
        });

        if (snapshot.versioning === "Disabled") {
          findings.push("WARNING: Versioning is disabled");
          findings.push("Data deletion or corruption cannot be recovered");
          return intensity > 5;
        }

        findings.push("Versioning enabled - data protection active");
        return false;
      }

      default:
        return false;
    }
  }
}
