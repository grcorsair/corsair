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
} from "../types";

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

  private calculateBlastRadius(
    snapshot: CognitoSnapshot,
    vector: AttackVector,
    intensity: number
  ): ApprovalRequest["blastRadius"] {
    return {
      affectedUsers: snapshot.userCount || 0,
      affectedResources: [snapshot.userPoolId],
      environment: "test",
    };
  }

  async raid(snapshot: CognitoSnapshot, options: RaidOptions | RaidOptionsWithApproval): Promise<RaidResult> {
    const raidId = `RAID-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const timeline: TimelineEvent[] = [];
    const findings: string[] = [];

    const approvalGate = (options as RaidOptionsWithApproval).approvalGate;
    const requestApproval = (options as RaidOptionsWithApproval).requestApproval;

    const vectorSeverity = this.getVectorSeverity(options.vector);
    let approvalResult: ApprovalResponse | null = null;
    let approvalRequired = false;

    if (approvalGate && this.requiresApproval(vectorSeverity, approvalGate.requiredSeverity)) {
      approvalRequired = true;

      if (!requestApproval) {
        throw new Error("Approval gate configured but no requestApproval function provided");
      }

      const approvalRequest: ApprovalRequest = {
        gate: approvalGate,
        vector: options.vector,
        intensity: options.intensity,
        targetId: snapshot.userPoolId,
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

    const release = await this.laneSerializer.acquire(snapshot.userPoolId);

    try {
      timeline.push({
        timestamp: new Date().toISOString(),
        action: "RAID_START",
        result: `Initiating ${options.vector} attack on ${snapshot.userPoolId}`,
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
        target: snapshot.userPoolId,
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
        targetId: snapshot.userPoolId,
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
    snapshot: CognitoSnapshot,
    options: RaidOptions,
    timeline: TimelineEvent[],
    findings: string[]
  ): Promise<boolean> {
    const { vector, intensity } = options;

    switch (vector) {
      case "mfa-bypass": {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: "CHECK_MFA",
          result: `MFA Configuration: ${snapshot.mfaConfiguration}`,
        });

        if (snapshot.mfaConfiguration === "OFF") {
          findings.push("CRITICAL: MFA is disabled - bypass trivial");
          findings.push("MFA bypass successful - no second factor required");
          return true;
        }

        if (snapshot.mfaConfiguration === "OPTIONAL") {
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
          result: `Min length: ${snapshot.passwordPolicy.minimumLength}`,
        });

        const weakPolicy =
          snapshot.passwordPolicy.minimumLength < 12 ||
          !snapshot.passwordPolicy.requireSymbols ||
          !snapshot.passwordPolicy.requireUppercase;

        if (weakPolicy) {
          findings.push("WARNING: Weak password policy detected");
          findings.push(`Minimum length: ${snapshot.passwordPolicy.minimumLength}`);
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

        if (!snapshot.riskConfiguration) {
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
          result: `Challenge on new device: ${snapshot.deviceConfiguration.challengeRequiredOnNewDevice}`,
        });

        if (!snapshot.deviceConfiguration.challengeRequiredOnNewDevice) {
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
}
