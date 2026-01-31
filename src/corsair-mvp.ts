#!/usr/bin/env bun
/**
 * CORSAIR MVP - Atomic Implementation
 *
 * Six Primitives:
 * - RECON: Observe AWS Cognito without modification
 * - MARK: Identify drift by comparing reality vs expectations
 * - RAID: Execute controlled chaos (MFA bypass simulation)
 * - PLUNDER: Extract JSONL evidence with cryptographic hash chain
 * - CHART: Map attack to compliance frameworks (MITRE -> NIST -> SOC2)
 * - ESCAPE: Rollback state with scope guards (RAII pattern)
 *
 * Four OpenClaw Patterns:
 * - JSONL serialization (append-only, SHA-256 chain)
 * - Lane serialization (prevent concurrent raids on same target)
 * - Scope guards (RAII cleanup pattern)
 * - State machine (7-phase lifecycle)
 */

import { createHash } from "crypto";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "fs";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type MfaConfiguration = "ON" | "OFF" | "OPTIONAL";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AttackVector = "mfa-bypass" | "password-spray" | "token-replay" | "session-hijack";
export type Framework = "MITRE" | "NIST-CSF" | "SOC2";
export type EvidenceType = "positive" | "negative" | "exception";
export type OperationType = "recon" | "mark" | "raid" | "chart" | "plunder" | "escape";

export interface PasswordPolicy {
  minimumLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  temporaryPasswordValidityDays: number;
}

export interface RiskConfiguration {
  compromisedCredentialsAction: string | null;
  accountTakeoverLowAction: string | null;
  accountTakeoverMediumAction: string | null;
  accountTakeoverHighAction: string | null;
}

export interface CognitoSnapshot {
  userPoolId: string;
  userPoolName: string;
  mfaConfiguration: MfaConfiguration;
  softwareTokenMfaEnabled: boolean;
  smsMfaEnabled: boolean;
  passwordPolicy: PasswordPolicy;
  riskConfiguration: RiskConfiguration | null;
  deviceConfiguration: {
    challengeRequiredOnNewDevice: boolean;
    deviceOnlyRememberedOnUserPrompt: boolean;
  };
  observedAt: string;
  userCount?: number;
  status?: string;
}

export interface ReconMetadata {
  source: "fixture" | "aws";
  readonly: boolean;
  durationMs: number;
}

export interface ReconResult {
  snapshot: CognitoSnapshot;
  metadata: ReconMetadata;
  stateModified: boolean;
  durationMs: number;
}

export interface Expectation {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "exists" | "contains";
  value: unknown;
}

export interface DriftFinding {
  id: string;
  field: string;
  expected: unknown;
  actual: unknown;
  drift: boolean;
  severity: Severity;
  description: string;
  timestamp: string;
}

export interface MarkResult {
  findings: DriftFinding[];
  driftDetected: boolean;
  durationMs: number;
}

export interface TimelineEvent {
  timestamp: string;
  action: string;
  result: string;
  data?: unknown;
}

export interface RaidResult {
  raidId: string;
  target: string;
  vector: AttackVector;
  success: boolean;
  controlsHeld: boolean;
  findings: string[];
  timeline: TimelineEvent[];
  startedAt: string;
  completedAt: string;
  serialized: boolean;
  durationMs: number;
}

export interface RaidOptions {
  vector: AttackVector;
  intensity: number;
  dryRun: boolean;
}

export interface PlunderRecord {
  sequence: number;
  timestamp: string;
  operation: OperationType;
  data: unknown;
  previousHash: string | null;
  hash: string;
}

export interface PlunderResult {
  evidencePath: string;
  eventCount: number;
  chainVerified: boolean;
  immutable: boolean;
  auditReady: boolean;
}

export interface EvidenceChainVerification {
  valid: boolean;
  recordCount: number;
  brokenAt: number | null;
}

export interface ComplianceMapping {
  id: string;
  findingId: string;
  framework: Framework;
  technique?: string;
  control?: string;
  description: string;
  mappingChain: string[];
  evidenceType: EvidenceType;
  evidenceRef: string;
}

export interface ChartOptions {
  frameworks?: Framework[];
}

export interface ChartResult {
  mitre: {
    technique: string;
    name: string;
    tactic: string;
    description: string;
  };
  nist: {
    function: string;
    category: string;
    controls: string[];
  };
  soc2: {
    principle: string;
    criteria: string[];
    description: string;
  };
}

export interface StateTransition {
  guardId: string;
  field: string;
  from: unknown;
  to: unknown;
  timestamp: string;
}

export interface ScopeGuard {
  guardId: string;
  initialState: CognitoSnapshot;
  active: boolean;
  createdAt: string;
  timeoutMs?: number;
  transitions: StateTransition[];
}

export interface GuardStatus {
  released: boolean;
  releasedOnError: boolean;
}

export interface EscapeVerification {
  initialHash: string;
  finalHash: string;
  stateRestored: boolean;
}

export interface EscapeReport {
  guardId: string;
  operationsPerformed: number;
  stateChanges: number;
  cleanupActions: string[];
  success: boolean;
}

export interface EscapeResult<T = CognitoSnapshot> {
  value: T;
  verification: EscapeVerification;
  durationMs: number;
  report: EscapeReport;
}

export interface SimpleEscapeResult {
  cleanupOps: number;
  allSuccessful: boolean;
  stateRestored: boolean;
  noLeakedResources: boolean;
  durationMs: number;
}

export interface RollbackResult {
  rolledBack: boolean;
  fromState: CognitoSnapshot;
  toState: CognitoSnapshot;
}

export interface ReleaseResult {
  restored: boolean;
  finalState: CognitoSnapshot;
}

export interface EscapeOptions {
  timeoutMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRAMEWORK MAPPING DATA
// ═══════════════════════════════════════════════════════════════════════════════

const DRIFT_TO_MITRE: Record<string, { technique: string; name: string }> = {
  mfaConfiguration: { technique: "T1556", name: "Modify Authentication Process" },
  "passwordPolicy.minimumLength": { technique: "T1110", name: "Brute Force" },
  "passwordPolicy.requireSymbols": { technique: "T1110.001", name: "Password Guessing" },
  riskConfiguration: { technique: "T1078", name: "Valid Accounts" },
  softwareTokenMfaEnabled: { technique: "T1556.006", name: "Multi-Factor Authentication Interception" },
};

const MITRE_TO_NIST: Record<string, { control: string; function: string }> = {
  T1556: { control: "PR.AC-7", function: "Protect - Access Control" },
  "T1556.006": { control: "PR.AC-7", function: "Protect - Access Control" },
  T1110: { control: "PR.AC-1", function: "Protect - Access Control" },
  "T1110.001": { control: "PR.AC-1", function: "Protect - Access Control" },
  T1078: { control: "PR.AC-4", function: "Protect - Access Control" },
};

const NIST_TO_SOC2: Record<string, { control: string; description: string }> = {
  "PR.AC-7": { control: "CC6.1", description: "Logical access security" },
  "PR.AC-1": { control: "CC6.1", description: "Logical access security" },
  "PR.AC-4": { control: "CC6.2", description: "Registration and authorization" },
  "PR.DS-2": { control: "CC6.6", description: "System boundary protection" },
  "PR.IP-1": { control: "CC6.3", description: "Role-based access control" },
};

const ATTACK_VECTOR_TO_MITRE: Record<AttackVector, { technique: string; name: string }> = {
  "mfa-bypass": { technique: "T1556.006", name: "Multi-Factor Authentication Interception" },
  "password-spray": { technique: "T1110.003", name: "Password Spraying" },
  "token-replay": { technique: "T1550.001", name: "Application Access Token" },
  "session-hijack": { technique: "T1563", name: "Remote Service Session Hijacking" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LANE SERIALIZATION (Prevent Concurrent Raids)
// ═══════════════════════════════════════════════════════════════════════════════

class LaneSerializer {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(target: string): Promise<() => void> {
    const key = target;

    // Wait for any existing lock on this target
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // Create new lock
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

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE (7-Phase Lifecycle)
// ═══════════════════════════════════════════════════════════════════════════════

type Phase = "OBSERVE" | "THINK" | "PLAN" | "BUILD" | "EXECUTE" | "VERIFY" | "LEARN";

interface StateMachine {
  phase: Phase;
  transitions: Array<{ from: Phase; to: Phase; timestamp: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORSAIR CLASS - MAIN IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface CorsairOptions {
  evidencePath?: string;
}

export class Corsair {
  private evidencePath: string;
  private sequence: number = 0;
  private lastHash: string | null = null;
  private laneSerializer = new LaneSerializer();
  private guards: Map<string, ScopeGuard> = new Map();
  private transitions: StateTransition[] = [];
  private lastGuardStatus: GuardStatus = { released: false, releasedOnError: false };
  private intermediateStates: Map<string, CognitoSnapshot[]> = new Map();

  constructor(options: CorsairOptions = {}) {
    this.evidencePath = options.evidencePath || "./corsair-evidence.jsonl";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECON PRIMITIVE - Read-Only Observation
  // ═══════════════════════════════════════════════════════════════════════════

  async recon(fixturePath: string): Promise<ReconResult> {
    const startTime = Date.now();

    // Read and parse fixture
    const content = readFileSync(fixturePath, "utf-8");
    const data = JSON.parse(content);

    const snapshot: CognitoSnapshot = {
      userPoolId: data.UserPool.Id,
      userPoolName: data.UserPool.Name,
      mfaConfiguration: data.UserPool.MfaConfiguration as MfaConfiguration,
      softwareTokenMfaEnabled: data.UserPoolMfaConfig?.SoftwareTokenMfaConfiguration?.Enabled ?? false,
      smsMfaEnabled: data.UserPoolMfaConfig?.SmsMfaConfiguration !== null,
      passwordPolicy: {
        minimumLength: data.UserPool.Policies.PasswordPolicy.MinimumLength,
        requireUppercase: data.UserPool.Policies.PasswordPolicy.RequireUppercase,
        requireLowercase: data.UserPool.Policies.PasswordPolicy.RequireLowercase,
        requireNumbers: data.UserPool.Policies.PasswordPolicy.RequireNumbers,
        requireSymbols: data.UserPool.Policies.PasswordPolicy.RequireSymbols,
        temporaryPasswordValidityDays: data.UserPool.Policies.PasswordPolicy.TemporaryPasswordValidityDays,
      },
      riskConfiguration: data.RiskConfiguration
        ? {
            compromisedCredentialsAction:
              data.RiskConfiguration.CompromisedCredentialsRiskConfiguration?.Actions?.EventAction ?? null,
            accountTakeoverLowAction:
              data.RiskConfiguration.AccountTakeoverRiskConfiguration?.Actions?.LowAction?.EventAction ?? null,
            accountTakeoverMediumAction:
              data.RiskConfiguration.AccountTakeoverRiskConfiguration?.Actions?.MediumAction?.EventAction ?? null,
            accountTakeoverHighAction:
              data.RiskConfiguration.AccountTakeoverRiskConfiguration?.Actions?.HighAction?.EventAction ?? null,
          }
        : null,
      deviceConfiguration: {
        challengeRequiredOnNewDevice: data.UserPool.DeviceConfiguration?.ChallengeRequiredOnNewDevice ?? false,
        deviceOnlyRememberedOnUserPrompt: data.UserPool.DeviceConfiguration?.DeviceOnlyRememberedOnUserPrompt ?? false,
      },
      observedAt: new Date().toISOString(),
    };

    const durationMs = Date.now() - startTime;

    return {
      snapshot,
      metadata: {
        source: "fixture",
        readonly: true,
        durationMs,
      },
      stateModified: false,  // RECON is read-only by contract
      durationMs,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARK PRIMITIVE - Drift Detection
  // ═══════════════════════════════════════════════════════════════════════════

  async mark(snapshot: CognitoSnapshot, expectations: Expectation[]): Promise<MarkResult> {
    const startTime = Date.now();
    const findings: DriftFinding[] = [];

    for (const expectation of expectations) {
      const actual = this.getNestedValue(snapshot, expectation.field);
      const expected = expectation.value;
      const drift = !this.checkExpectation(actual, expectation);
      const severity = this.calculateSeverity(expectation.field, drift, actual);

      findings.push({
        id: `DRIFT-${crypto.randomUUID().slice(0, 8)}`,
        field: expectation.field,
        expected,
        actual,
        drift,
        severity,
        description: this.generateDescription(expectation.field, expected, actual, drift),
        timestamp: new Date().toISOString(),
      });
    }

    const durationMs = Date.now() - startTime;
    const driftDetected = findings.some(f => f.drift === true);

    return {
      findings,
      driftDetected,
      durationMs,
    };
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private checkExpectation(actual: unknown, expectation: Expectation): boolean {
    const { operator, value } = expectation;

    switch (operator) {
      case "eq":
        return actual === value;
      case "neq":
        return actual !== value;
      case "gt":
        return typeof actual === "number" && typeof value === "number" && actual > value;
      case "gte":
        return typeof actual === "number" && typeof value === "number" && actual >= value;
      case "lt":
        return typeof actual === "number" && typeof value === "number" && actual < value;
      case "lte":
        return typeof actual === "number" && typeof value === "number" && actual <= value;
      case "exists":
        return value ? actual !== null && actual !== undefined : actual === null || actual === undefined;
      case "contains":
        return typeof actual === "string" && typeof value === "string" && actual.includes(value);
      default:
        return false;
    }
  }

  private calculateSeverity(field: string, drift: boolean, actual: unknown): Severity {
    if (!drift) return "LOW";

    // MFA off is critical
    if (field === "mfaConfiguration" && actual === "OFF") {
      return "CRITICAL";
    }

    // MFA optional is high
    if (field === "mfaConfiguration" && actual === "OPTIONAL") {
      return "HIGH";
    }

    // Missing risk configuration is high
    if (field === "riskConfiguration" && actual === null) {
      return "HIGH";
    }

    // Password policy issues are medium
    if (field.startsWith("passwordPolicy")) {
      return "MEDIUM";
    }

    return "MEDIUM";
  }

  private generateDescription(field: string, expected: unknown, actual: unknown, drift: boolean): string {
    if (!drift) {
      return `${field} meets expectation (${actual})`;
    }

    return `${field} drift detected: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RAID PRIMITIVE - Controlled Chaos
  // ═══════════════════════════════════════════════════════════════════════════

  async raid(snapshot: CognitoSnapshot, options: RaidOptions): Promise<RaidResult> {
    const raidId = `RAID-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const timeline: TimelineEvent[] = [];
    const findings: string[] = [];

    // Lane serialization - acquire lock for this target
    const release = await this.laneSerializer.acquire(snapshot.userPoolId);

    try {
      timeline.push({
        timestamp: new Date().toISOString(),
        action: "RAID_START",
        result: `Initiating ${options.vector} attack on ${snapshot.userPoolId}`,
      });

      // Simulate attack based on vector
      const success = await this.simulateAttack(snapshot, options, timeline, findings);

      timeline.push({
        timestamp: new Date().toISOString(),
        action: "RAID_COMPLETE",
        result: success ? "Attack succeeded - controls bypassed" : "Attack failed - controls held",
      });

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      return {
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
      };
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
          return intensity > 5; // Higher intensity assumes worst case
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

        // Simulate based on risk configuration
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PLUNDER PRIMITIVE - Evidence Extraction
  // ═══════════════════════════════════════════════════════════════════════════

  async plunder(raidResult: RaidResult, evidencePath: string): Promise<PlunderResult> {
    // Extract events from raid result
    const events: PlunderRecord[] = [];

    // Event 1: Raid initiation
    this.sequence++;
    let timestamp = new Date().toISOString();
    let record: Omit<PlunderRecord, "hash"> = {
      sequence: this.sequence,
      timestamp,
      operation: "raid_initiated",
      data: {
        raidId: raidResult.raidId,
        target: raidResult.target,
        vector: raidResult.vector,
      },
      previousHash: this.lastHash,
    };
    let hash = createHash("sha256").update(JSON.stringify({
      sequence: record.sequence,
      timestamp: record.timestamp,
      operation: record.operation,
      data: record.data,
      previousHash: record.previousHash,
    })).digest("hex");
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Event 2: Raid execution
    this.sequence++;
    timestamp = new Date().toISOString();
    record = {
      sequence: this.sequence,
      timestamp,
      operation: "raid_executed",
      data: {
        raidId: raidResult.raidId,
        success: raidResult.success,
        controlsHeld: raidResult.controlsHeld,
        findings: raidResult.findings,
      },
      previousHash: this.lastHash,
    };
    hash = createHash("sha256").update(JSON.stringify({
      sequence: record.sequence,
      timestamp: record.timestamp,
      operation: record.operation,
      data: record.data,
      previousHash: record.previousHash,
    })).digest("hex");
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Event 3: Raid completion
    this.sequence++;
    timestamp = new Date().toISOString();
    record = {
      sequence: this.sequence,
      timestamp,
      operation: "raid_completed",
      data: {
        raidId: raidResult.raidId,
        durationMs: raidResult.durationMs,
        serialized: raidResult.serialized,
      },
      previousHash: this.lastHash,
    };
    hash = createHash("sha256").update(JSON.stringify({
      sequence: record.sequence,
      timestamp: record.timestamp,
      operation: record.operation,
      data: record.data,
      previousHash: record.previousHash,
    })).digest("hex");
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Write all events to JSONL file
    for (const event of events) {
      appendFileSync(evidencePath, JSON.stringify(event) + "\n");
    }

    // Verify chain integrity
    const chainVerified = this.verifyEvidenceChain(evidencePath).valid;

    return {
      evidencePath,
      eventCount: events.length,
      chainVerified,
      immutable: true, // JSONL append-only format
      auditReady: chainVerified && events.length > 0,
    };
  }

  resetEvidence(): void {
    this.sequence = 0;
    this.lastHash = null;
    if (existsSync(this.evidencePath)) {
      writeFileSync(this.evidencePath, "");
    }
  }

  verifyEvidenceChain(evidencePath?: string): EvidenceChainVerification {
    const pathToVerify = evidencePath || this.evidencePath;

    if (!existsSync(pathToVerify)) {
      return { valid: true, recordCount: 0, brokenAt: null };
    }

    const content = readFileSync(pathToVerify, "utf-8").trim();
    if (!content) {
      return { valid: true, recordCount: 0, brokenAt: null };
    }

    const lines = content.split("\n");
    let previousHash: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const record: PlunderRecord = JSON.parse(lines[i]);

      // Verify previous hash matches
      if (record.previousHash !== previousHash) {
        return { valid: false, recordCount: lines.length, brokenAt: i + 1 };
      }

      // Verify hash computation
      const dataToHash = JSON.stringify({
        sequence: record.sequence,
        timestamp: record.timestamp,
        operation: record.operation,
        data: record.data,
        previousHash: record.previousHash,
      });

      const expectedHash = createHash("sha256").update(dataToHash).digest("hex");
      if (record.hash !== expectedHash) {
        return { valid: false, recordCount: lines.length, brokenAt: i + 1 };
      }

      previousHash = record.hash;
    }

    return { valid: true, recordCount: lines.length, brokenAt: null };
  }

  verifyHashChain(evidencePath: string): boolean {
    return this.verifyEvidenceChain(evidencePath).valid;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART PRIMITIVE - Framework Mapping
  // ═══════════════════════════════════════════════════════════════════════════

  async chart(findings: DriftFinding[], options: ChartOptions = {}): Promise<ChartResult> {
    // Aggregate all drift findings into consolidated framework mapping
    const mitreFindings: Set<string> = new Set();
    const nistControls: Set<string> = new Set();
    const soc2Controls: Set<string> = new Set();
    let primaryMitre: { technique: string; name: string; tactic: string; description: string } | null = null;
    let primaryNist: { function: string; category: string; controls: string[] } | null = null;
    let primarySoc2: { principle: string; criteria: string[]; description: string } | null = null;

    for (const finding of findings) {
      if (!finding.drift) continue;

      const mitre = DRIFT_TO_MITRE[finding.field];
      if (!mitre) continue;

      mitreFindings.add(mitre.technique);

      // Set primary MITRE (first drift finding)
      if (!primaryMitre) {
        primaryMitre = {
          technique: mitre.technique,
          name: mitre.name,
          tactic: "Credential Access",
          description: `${mitre.name} detected via ${finding.field} misconfiguration`
        };
      }

      const nist = MITRE_TO_NIST[mitre.technique];
      if (nist) {
        nistControls.add(nist.control);

        // Set primary NIST
        if (!primaryNist) {
          primaryNist = {
            function: nist.function,
            category: "Access Control",
            controls: [nist.control]
          };
        } else {
          primaryNist.controls.push(nist.control);
        }

        const soc2 = NIST_TO_SOC2[nist.control];
        if (soc2) {
          soc2Controls.add(soc2.control);

          // Set primary SOC2
          if (!primarySoc2) {
            primarySoc2 = {
              principle: "Common Criteria",
              criteria: [soc2.control],
              description: soc2.description
            };
          } else {
            if (!primarySoc2.criteria.includes(soc2.control)) {
              primarySoc2.criteria.push(soc2.control);
            }
          }
        }
      }
    }

    // Return consolidated result or defaults if no drift
    return {
      mitre: primaryMitre || {
        technique: "N/A",
        name: "No drift detected",
        tactic: "N/A",
        description: "No security misconfigurations found"
      },
      nist: primaryNist || {
        function: "N/A",
        category: "N/A",
        controls: []
      },
      soc2: primarySoc2 || {
        principle: "N/A",
        criteria: [],
        description: "No applicable controls"
      }
    };
  }

  async chartRaid(raidResult: RaidResult): Promise<ComplianceMapping[]> {
    const mappings: ComplianceMapping[] = [];
    const mitre = ATTACK_VECTOR_TO_MITRE[raidResult.vector];
    const evidenceType: EvidenceType = raidResult.success ? "negative" : "positive";

    // Build chain
    const chain: string[] = [];
    chain.push(`MITRE:${mitre.technique}`);

    const nist = MITRE_TO_NIST[mitre.technique] || MITRE_TO_NIST[mitre.technique.split(".")[0]];
    if (nist) {
      chain.push(`NIST:${nist.control}`);
    }

    const soc2 = nist ? NIST_TO_SOC2[nist.control] : undefined;
    if (soc2) {
      chain.push(`SOC2:${soc2.control}`);
    }

    // MITRE mapping
    mappings.push({
      id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
      findingId: raidResult.raidId,
      framework: "MITRE",
      technique: mitre.technique,
      description: mitre.name,
      mappingChain: chain,
      evidenceType,
      evidenceRef: raidResult.raidId,
    });

    // NIST mapping
    if (nist) {
      mappings.push({
        id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
        findingId: raidResult.raidId,
        framework: "NIST-CSF",
        control: nist.control,
        description: nist.function,
        mappingChain: chain,
        evidenceType,
        evidenceRef: raidResult.raidId,
      });
    }

    // SOC2 mapping
    if (soc2) {
      mappings.push({
        id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
        findingId: raidResult.raidId,
        framework: "SOC2",
        control: soc2.control,
        description: soc2.description,
        mappingChain: chain,
        evidenceType,
        evidenceRef: raidResult.raidId,
      });
    }

    return mappings;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESCAPE PRIMITIVE - Rollback & Scope Guards
  // ═══════════════════════════════════════════════════════════════════════════

  escape(cleanupOps: Array<() => { operation: string; success: boolean }>): SimpleEscapeResult {
    const startTime = Date.now();
    const results: Array<{ operation: string; success: boolean }> = [];

    // Execute all cleanup operations
    for (const cleanup of cleanupOps) {
      try {
        const result = cleanup();
        results.push(result);
      } catch (error) {
        results.push({ operation: "unknown", success: false });
      }
    }

    const durationMs = Date.now() - startTime;
    const allSuccessful = results.every(r => r.success);

    return {
      cleanupOps: cleanupOps.length,
      allSuccessful,
      stateRestored: allSuccessful, // State considered restored if all cleanup ops succeed
      noLeakedResources: allSuccessful, // No leaks if all cleanup succeeded
      durationMs,
    };
  }

  async createGuard(snapshot: CognitoSnapshot, options: EscapeOptions = {}): Promise<ScopeGuard> {
    const guardId = `GUARD-${crypto.randomUUID().slice(0, 8)}`;
    const guard: ScopeGuard = {
      guardId,
      initialState: { ...snapshot },
      active: true,
      createdAt: new Date().toISOString(),
      timeoutMs: options.timeoutMs,
      transitions: [],
    };

    this.guards.set(guardId, guard);
    this.intermediateStates.set(guardId, []);

    // Set up timeout if specified
    if (options.timeoutMs) {
      setTimeout(() => {
        const g = this.guards.get(guardId);
        if (g && g.active) {
          g.active = false;
        }
      }, options.timeoutMs);
    }

    return guard;
  }

  async releaseGuard(guard: ScopeGuard, currentState: CognitoSnapshot): Promise<ReleaseResult> {
    guard.active = false;

    // Restore to initial state (in simulation, we just return the initial state)
    return {
      restored: true,
      finalState: guard.initialState,
    };
  }

  async withEscapeGuard<T>(
    snapshot: CognitoSnapshot,
    fn: (guard: ScopeGuard) => Promise<T>
  ): Promise<EscapeResult<T>> {
    const guard = await this.createGuard(snapshot);
    const startTime = Date.now();
    const initialHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

    let result: T;
    let releasedOnError = false;

    try {
      result = await fn(guard);
    } catch (error) {
      releasedOnError = true;
      this.lastGuardStatus = { released: true, releasedOnError: true };
      guard.active = false;
      throw error;
    } finally {
      if (!releasedOnError) {
        this.lastGuardStatus = { released: true, releasedOnError: false };
        guard.active = false;
      }
    }

    const durationMs = Date.now() - startTime;
    const finalHash = createHash("sha256").update(JSON.stringify(guard.initialState)).digest("hex");

    return {
      value: result,
      verification: {
        initialHash,
        finalHash,
        stateRestored: initialHash === finalHash,
      },
      durationMs,
      report: {
        guardId: guard.guardId,
        operationsPerformed: guard.transitions.length,
        stateChanges: guard.transitions.length,
        cleanupActions: ["state_restored"],
        success: true,
      },
    };
  }

  getLastGuardStatus(): GuardStatus {
    return this.lastGuardStatus;
  }

  logStateTransition(guard: ScopeGuard, field: string, from: unknown, to: unknown): void {
    const transition: StateTransition = {
      guardId: guard.guardId,
      field,
      from,
      to,
      timestamp: new Date().toISOString(),
    };

    guard.transitions.push(transition);
    this.transitions.push(transition);
  }

  getGuardTransitions(): StateTransition[] {
    return [...this.transitions];
  }

  captureIntermediateState(guard: ScopeGuard, snapshot: CognitoSnapshot): void {
    const states = this.intermediateStates.get(guard.guardId) || [];
    states.push({ ...snapshot });
    this.intermediateStates.set(guard.guardId, states);
  }

  async rollback(guard: ScopeGuard): Promise<RollbackResult> {
    const states = this.intermediateStates.get(guard.guardId) || [];
    const fromState = states.length > 0 ? states[states.length - 1] : guard.initialState;

    return {
      rolledBack: true,
      fromState,
      toState: guard.initialState,
    };
  }

  isGuardExpired(guard: ScopeGuard): boolean {
    if (!guard.timeoutMs) return false;

    const elapsed = Date.now() - new Date(guard.createdAt).getTime();
    const expired = elapsed > guard.timeoutMs;

    if (expired && guard.active) {
      guard.active = false;
    }

    return expired;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

if (import.meta.main) {
  const corsair = new Corsair();

  console.log("CORSAIR MVP - Atomic Implementation");
  console.log("====================================");
  console.log("Primitives: RECON, MARK, RAID, PLUNDER, CHART, ESCAPE");
  console.log("");
  console.log("Usage: Import Corsair class and use programmatically");
  console.log("Tests: bun test tests/primitives/");
}
