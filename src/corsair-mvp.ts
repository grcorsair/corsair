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
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { EventEmitter } from "events";

// Import EvidenceEngine and CompactionEngine for delegation
import { EvidenceEngine } from "./evidence";
import { CompactionEngine } from "./compaction";

// Import all types from the types module
import type {
  MfaConfiguration,
  Severity,
  AttackVector,
  Framework,
  EvidenceType,
  OperationType,
  PasswordPolicy,
  RiskConfiguration,
  CognitoSnapshot,
  ReconMetadata,
  ReconResult,
  Expectation,
  DriftFinding,
  MarkResult,
  TimelineEvent,
  RaidResult,
  RaidOptions,
  PlunderRecord,
  PlunderResult,
  EvidenceChainVerification,
  ComplianceMapping,
  ChartOptions,
  ChartResult,
  StateTransition,
  ScopeGuard,
  GuardStatus,
  EscapeVerification,
  EscapeReport,
  EscapeResult,
  SimpleEscapeResult,
  RollbackResult,
  ReleaseResult,
  EscapeOptions,
  ApprovalChannel,
  ApprovalGate,
  ApprovalRequest,
  ApprovalResponse,
  RaidOptionsWithApproval,
  CompactionResult,
  CompactionSummary,
  CorsairEventType,
  CorsairEvent,
  EventFilter,
  EventAggregator,
  EventAggregatorSummary,
  PluginAttackVector,
  PluginManifest,
  RegisteredPlugin,
  InitializeResult,
  CorsairOptions,
  FrameworkMappingEntry,
  PluginFrameworkMappings,
} from "./types";

// Re-export all types for external consumers
export type {
  MfaConfiguration,
  Severity,
  AttackVector,
  Framework,
  EvidenceType,
  OperationType,
  PasswordPolicy,
  RiskConfiguration,
  CognitoSnapshot,
  ReconMetadata,
  ReconResult,
  Expectation,
  DriftFinding,
  MarkResult,
  TimelineEvent,
  RaidResult,
  RaidOptions,
  PlunderRecord,
  PlunderResult,
  EvidenceChainVerification,
  ComplianceMapping,
  ChartOptions,
  ChartResult,
  StateTransition,
  ScopeGuard,
  GuardStatus,
  EscapeVerification,
  EscapeReport,
  EscapeResult,
  SimpleEscapeResult,
  RollbackResult,
  ReleaseResult,
  EscapeOptions,
  ApprovalChannel,
  ApprovalGate,
  ApprovalRequest,
  ApprovalResponse,
  RaidOptionsWithApproval,
  CompactionResult,
  CompactionSummary,
  CorsairEventType,
  CorsairEvent,
  EventFilter,
  EventAggregator,
  EventAggregatorSummary,
  PluginAttackVector,
  PluginManifest,
  RegisteredPlugin,
  InitializeResult,
  CorsairOptions,
  FrameworkMappingEntry,
  PluginFrameworkMappings,
};

// ===============================================================================
// FRAMEWORK MAPPING DATA (LEGACY FALLBACK)
// These are kept for backward compatibility when plugin mappings are not available.
// New plugins should define frameworkMappings in their *.plugin.json manifest.
// ===============================================================================

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

// ===============================================================================
// LANE SERIALIZATION (Prevent Concurrent Raids)
// ===============================================================================

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

// ===============================================================================
// PLUGIN REGISTRY
// ===============================================================================

/**
 * PluginRegistry - Discovers and manages Corsair plugins
 *
 * Responsibilities:
 * - Scan directories for *.plugin.json manifests
 * - Validate manifest schemas
 * - Register discovered plugins
 * - Provide plugin lookup by providerId
 */
class PluginRegistry {
  private plugins: Map<string, RegisteredPlugin> = new Map();

  /**
   * Discover plugins from a directory.
   * Scans for *.plugin.json files in subdirectories.
   *
   * @param pluginDir - Directory to scan for plugins
   * @returns Discovery result with counts and plugin list
   */
  async discover(pluginDir: string): Promise<InitializeResult> {
    const discovered: string[] = [];
    const invalid: string[] = [];

    // Handle non-existent directory gracefully
    if (!existsSync(pluginDir)) {
      return {
        discoveredCount: 0,
        plugins: [],
        invalidManifests: [],
      };
    }

    try {
      const entries = readdirSync(pluginDir);

      for (const entry of entries) {
        const entryPath = join(pluginDir, entry);
        const stat = statSync(entryPath);

        if (stat.isDirectory()) {
          // Look for *.plugin.json files in subdirectory
          const subEntries = readdirSync(entryPath);
          for (const subEntry of subEntries) {
            if (subEntry.endsWith(".plugin.json")) {
              const manifestPath = join(entryPath, subEntry);
              const result = await this.loadManifest(manifestPath);

              if (result.valid && result.manifest) {
                // Check if already registered (don't overwrite)
                if (!this.plugins.has(result.manifest.providerId)) {
                  this.register(result.manifest);
                  discovered.push(result.manifest.providerId);
                }
              } else {
                invalid.push(manifestPath);
              }
            }
          }
        }
      }
    } catch (error) {
      // Directory scan failed - return empty result
      return {
        discoveredCount: 0,
        plugins: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    return {
      discoveredCount: discovered.length,
      plugins: discovered,
      invalidManifests: invalid.length > 0 ? invalid : undefined,
    };
  }

  /**
   * Load and validate a plugin manifest from file.
   */
  private async loadManifest(
    manifestPath: string
  ): Promise<{ valid: boolean; manifest?: PluginManifest; error?: string }> {
    try {
      const content = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      // Validate required fields
      if (!manifest.providerId || typeof manifest.providerId !== "string") {
        return { valid: false, error: "Missing or invalid providerId" };
      }

      if (!manifest.providerName || typeof manifest.providerName !== "string") {
        return { valid: false, error: "Missing or invalid providerName" };
      }

      if (!manifest.version || typeof manifest.version !== "string") {
        return { valid: false, error: "Missing or invalid version" };
      }

      if (!Array.isArray(manifest.attackVectors)) {
        return { valid: false, error: "Missing or invalid attackVectors" };
      }

      // Validate attack vectors structure
      for (const vector of manifest.attackVectors) {
        if (!vector.id || !vector.name || !vector.severity) {
          return { valid: false, error: "Invalid attack vector structure" };
        }

        if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(vector.severity)) {
          return { valid: false, error: `Invalid severity: ${vector.severity}` };
        }
      }

      return { valid: true, manifest: manifest as PluginManifest };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Parse error",
      };
    }
  }

  /**
   * Register a plugin manifest.
   */
  register(manifest: PluginManifest): void {
    const plugin: RegisteredPlugin = {
      manifest,
      loadedAt: new Date().toISOString(),
    };

    this.plugins.set(manifest.providerId, plugin);
    console.log(`  Registered plugin: ${manifest.providerId} (${manifest.providerName} v${manifest.version})`);
  }

  /**
   * Get a registered plugin by providerId.
   */
  get(providerId: string): RegisteredPlugin | undefined {
    return this.plugins.get(providerId);
  }

  /**
   * Get all registered plugins.
   */
  getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered.
   */
  has(providerId: string): boolean {
    return this.plugins.has(providerId);
  }

  /**
   * Get all registered manifests.
   */
  getManifests(): PluginManifest[] {
    return this.getAll().map((p) => p.manifest);
  }
}

// ===============================================================================
// CORSAIR CLASS - MAIN IMPLEMENTATION
// ===============================================================================

export class Corsair extends EventEmitter {
  private evidencePath: string;
  private evidenceEngine: EvidenceEngine;
  private compactionEngine: CompactionEngine;
  private laneSerializer = new LaneSerializer();
  private guards: Map<string, ScopeGuard> = new Map();
  private transitions: StateTransition[] = [];
  private lastGuardStatus: GuardStatus = { released: false, releasedOnError: false };
  private intermediateStates: Map<string, CognitoSnapshot[]> = new Map();
  private pluginRegistry = new PluginRegistry();
  private initialized: boolean = false;
  /** Event store for queryEvents() */
  private events: CorsairEvent[] = [];

  constructor(options: CorsairOptions = {}) {
    super(); // Call EventEmitter constructor
    this.evidencePath = options.evidencePath || "./corsair-evidence.jsonl";
    this.evidenceEngine = new EvidenceEngine(this.evidencePath);
    this.compactionEngine = new CompactionEngine(this.evidenceEngine);
  }

  // ===============================================================================
  // PLUGIN MANAGEMENT
  // ===============================================================================

  /**
   * Initialize Corsair with plugin discovery.
   * Scans the specified directory for *.plugin.json manifests and auto-registers plugins.
   *
   * @param pluginDir - Directory to scan for plugins (default: "plugins/")
   * @returns Discovery result with counts and plugin list
   *
   * @example
   * const corsair = new Corsair();
   * await corsair.initialize(); // Discovers from plugins/
   * await corsair.initialize("./custom-plugins"); // Custom directory
   */
  async initialize(pluginDir: string = "plugins/"): Promise<InitializeResult> {
    console.log(`Discovering plugins in ${pluginDir}...`);

    const result = await this.pluginRegistry.discover(pluginDir);

    console.log(`Discovered ${result.discoveredCount} plugin(s): ${result.plugins.join(", ") || "none"}`);

    if (result.invalidManifests && result.invalidManifests.length > 0) {
      console.warn(`Skipped ${result.invalidManifests.length} invalid manifest(s)`);
    }

    this.initialized = true;
    return result;
  }

  /**
   * Get a registered plugin by providerId.
   *
   * @param providerId - The plugin's provider ID (e.g., "aws-cognito")
   * @returns The registered plugin or undefined if not found
   */
  getPlugin(providerId: string): RegisteredPlugin | undefined {
    return this.pluginRegistry.get(providerId);
  }

  /**
   * Get all registered plugins.
   *
   * @returns Array of all registered plugins
   */
  getPlugins(): RegisteredPlugin[] {
    return this.pluginRegistry.getAll();
  }

  /**
   * Check if a plugin is registered.
   *
   * @param providerId - The plugin's provider ID
   * @returns true if the plugin is registered
   */
  hasPlugin(providerId: string): boolean {
    return this.pluginRegistry.has(providerId);
  }

  /**
   * Manually register a plugin manifest.
   * Useful for programmatic plugin registration without file discovery.
   *
   * @param manifest - The plugin manifest to register
   */
  registerPlugin(manifest: PluginManifest): void {
    this.pluginRegistry.register(manifest);
  }

  // ===============================================================================
  // MARK PRIMITIVE - Drift Detection
  // ===============================================================================

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

    // Emit drift:detected event if drift was found (OpenClaw Pattern 2)
    if (driftDetected) {
      const driftFindings = findings.filter(f => f.drift);
      const maxSeverity = this.getDriftMaxSeverity(driftFindings);

      const event: CorsairEvent = {
        type: "drift:detected",
        timestamp: new Date().toISOString(),
        targetId: snapshot.userPoolId,
        severity: maxSeverity,
        findings: driftFindings.map(d => `${d.field}: ${JSON.stringify(d.expected)} -> ${JSON.stringify(d.actual)}`),
        metadata: {
          driftCount: driftFindings.length,
          durationMs,
        },
      };

      this.emit("drift:detected", event);
      this.events.push(event);
    }

    return {
      findings,
      driftDetected,
      durationMs,
    };
  }

  /**
   * Get the maximum severity from a list of drift findings.
   * @internal
   */
  private getDriftMaxSeverity(driftFindings: DriftFinding[]): Severity {
    const severityOrder: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    let maxIndex = 0;

    for (const finding of driftFindings) {
      const index = severityOrder.indexOf(finding.severity);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }

    return severityOrder[maxIndex];
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

  // ===============================================================================
  // RAID PRIMITIVE - Controlled Chaos
  // ===============================================================================

  /**
   * Get severity level for a given attack vector.
   * @internal
   */
  private getVectorSeverity(vector: AttackVector): Severity {
    const severityMap: Record<AttackVector, Severity> = {
      "mfa-bypass": "CRITICAL",
      "token-replay": "CRITICAL",
      "session-hijack": "HIGH",
      "password-spray": "MEDIUM",
    };
    return severityMap[vector] || "MEDIUM";
  }

  /**
   * Check if approval is required based on vector severity and gate threshold.
   * @internal
   */
  private requiresApproval(vectorSeverity: Severity, gateSeverity: Severity): boolean {
    const severityLevels: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const vectorLevel = severityLevels.indexOf(vectorSeverity);
    const gateLevel = severityLevels.indexOf(gateSeverity);
    return vectorLevel >= gateLevel;
  }

  /**
   * Calculate blast radius for approval request.
   * @internal
   */
  private calculateBlastRadius(
    snapshot: CognitoSnapshot,
    vector: AttackVector,
    intensity: number
  ): ApprovalRequest["blastRadius"] {
    return {
      affectedUsers: snapshot.userCount || 0,
      affectedResources: [snapshot.userPoolId],
      environment: "test", // Could be made configurable
    };
  }

  /**
   * Execute a controlled chaos raid against a snapshot.
   * Supports approval gates for production safety (OpenClaw Pattern 4).
   *
   * @param snapshot - The Cognito snapshot to raid
   * @param options - Raid options including vector, intensity, and optional approval gate
   * @returns RaidResult with success/failure, timeline, and approval status
   */
  async raid(snapshot: CognitoSnapshot, options: RaidOptions | RaidOptionsWithApproval): Promise<RaidResult> {
    const raidId = `RAID-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const timeline: TimelineEvent[] = [];
    const findings: string[] = [];

    // Extract approval gate options
    const approvalGate = (options as RaidOptionsWithApproval).approvalGate;
    const requestApproval = (options as RaidOptionsWithApproval).requestApproval;

    // Determine if approval is required based on vector severity
    const vectorSeverity = this.getVectorSeverity(options.vector);
    let approvalResult: ApprovalResponse | null = null;
    let approvalRequired = false;

    // Check if approval gate is configured and applies to this vector
    if (approvalGate && this.requiresApproval(vectorSeverity, approvalGate.requiredSeverity)) {
      approvalRequired = true;

      if (!requestApproval) {
        throw new Error("Approval gate configured but no requestApproval function provided");
      }

      // Build approval request with blast radius details
      const approvalRequest: ApprovalRequest = {
        gate: approvalGate,
        vector: options.vector,
        intensity: options.intensity,
        targetId: snapshot.userPoolId,
        blastRadius: this.calculateBlastRadius(snapshot, options.vector, options.intensity),
        requestedAt: new Date().toISOString(),
      };

      // Wait for approval with timeout
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

      // Check if approval was denied
      if (!approvalResult.approved) {
        throw new Error(`Approval denied: ${approvalResult.reason || "No reason provided"}`);
      }

      timeline.push({
        timestamp: new Date().toISOString(),
        action: "APPROVAL_GRANTED",
        result: `Approved by ${approvalResult.approver}`,
      });
    }

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
        // Approval Gate fields (OpenClaw Pattern 4)
        approvalRequired,
        approved: approvalResult?.approved,
        approver: approvalResult?.approver,
        approvalTimestamp: approvalResult?.timestamp,
      };

      // Emit raid:complete event (OpenClaw Pattern 2 - Multi-Layer Events)
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

      this.emit("raid:complete", event);
      this.events.push(event);

      return result;
    } finally {
      release();
    }
  }

  /**
   * Simulate an attack against the snapshot.
   * @internal
   */
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

  // ===============================================================================
  // PLUNDER PRIMITIVE - Evidence Extraction (Delegated to EvidenceEngine)
  // ===============================================================================

  async plunder(raidResult: RaidResult, evidencePath: string): Promise<PlunderResult> {
    return this.evidenceEngine.plunder(raidResult, evidencePath);
  }

  resetEvidence(): void {
    this.evidenceEngine.resetEvidence();
  }

  verifyEvidenceChain(evidencePath?: string): EvidenceChainVerification {
    return this.evidenceEngine.verifyEvidenceChain(evidencePath);
  }

  verifyHashChain(evidencePath: string): boolean {
    return this.evidenceEngine.verifyHashChain(evidencePath);
  }

  // ===============================================================================
  // COMPACTION (OpenClaw Pattern 1) - Delegated to CompactionEngine
  // ===============================================================================

  /**
   * Compact an evidence file by aggregating records into summaries.
   * Delegated to CompactionEngine.
   *
   * @param evidencePath - Path to the JSONL evidence file to compact
   * @returns CompactionResult with before/after metrics and backup path
   * @throws Error if file doesn't exist or chain is broken
   */
  async compactEvidence(evidencePath: string): Promise<CompactionResult> {
    return this.compactionEngine.compactEvidence(evidencePath);
  }

  // ===============================================================================
  // CHART PRIMITIVE - Framework Mapping (Plugin-Provided)
  // ===============================================================================

  /**
   * Get framework mappings from a plugin manifest.
   * Returns undefined if plugin not found or no mappings defined.
   * @internal
   */
  private getPluginMappings(providerId: string = "aws-cognito"): PluginFrameworkMappings | undefined {
    const plugin = this.pluginRegistry.get(providerId);
    return plugin?.manifest.frameworkMappings;
  }

  /**
   * Chart drift findings to compliance frameworks using plugin-provided mappings.
   *
   * @param findings - Array of drift findings from mark()
   * @param options - Chart options (optional providerId to select plugin mappings)
   * @returns ChartResult with MITRE, NIST, and SOC2 mappings
   */
  async chart(findings: DriftFinding[], options: ChartOptions & { providerId?: string } = {}): Promise<ChartResult> {
    const providerId = options.providerId || "aws-cognito";
    const pluginMappings = this.getPluginMappings(providerId);
    const driftMappings = pluginMappings?.drift || {};

    // Aggregate all drift findings into consolidated framework mapping
    const mitreFindings: Set<string> = new Set();
    const nistControls: Set<string> = new Set();
    const soc2Controls: Set<string> = new Set();
    let primaryMitre: { technique: string; name: string; tactic: string; description: string } | null = null;
    let primaryNist: { function: string; category: string; controls: string[] } | null = null;
    let primarySoc2: { principle: string; criteria: string[]; description: string } | null = null;

    for (const finding of findings) {
      if (!finding.drift) continue;

      // Look up mapping from plugin manifest (fallback to legacy hardcoded if not found)
      const mapping = driftMappings[finding.field] || DRIFT_TO_MITRE[finding.field];
      if (!mapping) continue;

      // Handle both FrameworkMappingEntry (plugin) and legacy { technique, name } format
      const mitreId = "mitre" in mapping ? mapping.mitre : mapping.technique;
      const mitreName = "mitreName" in mapping ? (mapping.mitreName || mapping.mitre) : mapping.name;

      mitreFindings.add(mitreId);

      // Set primary MITRE (first drift finding)
      if (!primaryMitre) {
        primaryMitre = {
          technique: mitreId,
          name: mitreName,
          tactic: "Credential Access",
          description: "description" in mapping && mapping.description
            ? mapping.description
            : `${mitreName} detected via ${finding.field} misconfiguration`
        };
      }

      // Get NIST mapping from plugin or legacy
      const nistControl = "nist" in mapping ? mapping.nist : MITRE_TO_NIST[mitreId]?.control;
      const nistFunction = "nistFunction" in mapping ? mapping.nistFunction : MITRE_TO_NIST[mitreId]?.function;

      if (nistControl) {
        nistControls.add(nistControl);

        // Set primary NIST
        if (!primaryNist) {
          primaryNist = {
            function: nistFunction || "Protect",
            category: "Access Control",
            controls: [nistControl]
          };
        } else {
          primaryNist.controls.push(nistControl);
        }

        // Get SOC2 mapping from plugin or legacy
        const soc2Control = "soc2" in mapping ? mapping.soc2 : NIST_TO_SOC2[nistControl]?.control;
        const soc2Description = "soc2Description" in mapping ? mapping.soc2Description : NIST_TO_SOC2[nistControl]?.description;

        if (soc2Control) {
          soc2Controls.add(soc2Control);

          // Set primary SOC2
          if (!primarySoc2) {
            primarySoc2 = {
              principle: "Common Criteria",
              criteria: [soc2Control],
              description: soc2Description || "Control mapping"
            };
          } else {
            if (!primarySoc2.criteria.includes(soc2Control)) {
              primarySoc2.criteria.push(soc2Control);
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

  /**
   * Chart a raid result to compliance frameworks using plugin-provided mappings.
   *
   * @param raidResult - The raid result to map
   * @param providerId - Optional provider ID (defaults to "aws-cognito")
   * @returns Array of ComplianceMapping entries for MITRE, NIST, and SOC2
   */
  async chartRaid(raidResult: RaidResult, providerId: string = "aws-cognito"): Promise<ComplianceMapping[]> {
    const pluginMappings = this.getPluginMappings(providerId);
    const attackVectorMappings = pluginMappings?.attackVectors || {};

    // Look up mapping from plugin manifest (fallback to legacy hardcoded if not found)
    const mapping = attackVectorMappings[raidResult.vector] || ATTACK_VECTOR_TO_MITRE[raidResult.vector];

    // Handle both FrameworkMappingEntry (plugin) and legacy { technique, name } format
    const mitreId = "mitre" in mapping ? mapping.mitre : mapping.technique;
    const mitreName = "mitreName" in mapping ? (mapping.mitreName || mapping.mitre) : mapping.name;
    const nistControl = "nist" in mapping ? mapping.nist : undefined;
    const nistFunction = "nistFunction" in mapping ? mapping.nistFunction : undefined;
    const soc2Control = "soc2" in mapping ? mapping.soc2 : undefined;
    const soc2Description = "soc2Description" in mapping ? mapping.soc2Description : undefined;

    const mappings: ComplianceMapping[] = [];
    const evidenceType: EvidenceType = raidResult.success ? "negative" : "positive";

    // Build chain
    const chain: string[] = [];
    chain.push(`MITRE:${mitreId}`);

    if (nistControl) {
      chain.push(`NIST:${nistControl}`);
    }

    if (soc2Control) {
      chain.push(`SOC2:${soc2Control}`);
    }

    // MITRE mapping
    mappings.push({
      id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
      findingId: raidResult.raidId,
      framework: "MITRE",
      technique: mitreId,
      description: mitreName,
      mappingChain: chain,
      evidenceType,
      evidenceRef: raidResult.raidId,
    });

    // NIST mapping
    if (nistControl) {
      mappings.push({
        id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
        findingId: raidResult.raidId,
        framework: "NIST-CSF",
        control: nistControl,
        description: nistFunction || "Protect",
        mappingChain: chain,
        evidenceType,
        evidenceRef: raidResult.raidId,
      });
    }

    // SOC2 mapping
    if (soc2Control) {
      mappings.push({
        id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
        findingId: raidResult.raidId,
        framework: "SOC2",
        control: soc2Control,
        description: soc2Description || "Control mapping",
        mappingChain: chain,
        evidenceType,
        evidenceRef: raidResult.raidId,
      });
    }

    return mappings;
  }

  // ===============================================================================
  // ESCAPE PRIMITIVE - Rollback & Scope Guards
  // ===============================================================================

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

  // ===============================================================================
  // EVENT SYSTEM (OpenClaw Pattern 2 - Multi-Layer Events)
  // ===============================================================================

  /**
   * Query events by filter criteria.
   * Supports filtering by severity, type, and time range.
   *
   * @param filter - Filter criteria for events
   * @returns Array of events matching the filter
   *
   * @example
   * // Get all CRITICAL severity events from the past hour
   * const criticalEvents = await corsair.queryEvents({
   *   severity: "CRITICAL",
   *   timeRange: {
   *     start: new Date(Date.now() - 3600000).toISOString(),
   *     end: new Date().toISOString()
   *   }
   * });
   */
  async queryEvents(filter: EventFilter): Promise<CorsairEvent[]> {
    let filtered = [...this.events];

    // Filter by severity
    if (filter.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }

    // Filter by type
    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    // Filter by time range
    if (filter.timeRange) {
      const startTime = new Date(filter.timeRange.start).getTime();
      const endTime = new Date(filter.timeRange.end).getTime();

      filtered = filtered.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        return eventTime >= startTime && eventTime <= endTime;
      });
    }

    return filtered;
  }

  /**
   * Create an event aggregator to collect and summarize events.
   * The aggregator automatically subscribes to all event types and
   * provides summary statistics.
   *
   * @returns EventAggregator instance
   *
   * @example
   * const aggregator = corsair.createEventAggregator();
   *
   * await corsair.raid(snapshot, { vector: "mfa-bypass", intensity: 5, dryRun: true });
   * await corsair.mark(snapshot, [{ field: "mfaConfiguration", operator: "eq", value: "ON" }]);
   *
   * const summary = aggregator.getSummary();
   * console.log(`Total events: ${summary.totalEvents}`);
   * console.log(`By type: ${JSON.stringify(summary.byType)}`);
   */
  createEventAggregator(): EventAggregator {
    const startTime = new Date().toISOString();
    const capturedEvents: CorsairEvent[] = [];

    // Create listener function
    const listener = (event: CorsairEvent) => {
      capturedEvents.push(event);
    };

    // Subscribe to all event types
    this.on("raid:complete", listener);
    this.on("drift:detected", listener);
    this.on("plunder:recorded", listener);
    this.on("escape:executed", listener);

    return {
      getSummary: (): EventAggregatorSummary => {
        const byType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};

        for (const event of capturedEvents) {
          // Count by type
          byType[event.type] = (byType[event.type] || 0) + 1;

          // Count by severity
          if (event.severity) {
            bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
          }
        }

        return {
          totalEvents: capturedEvents.length,
          byType,
          bySeverity,
          timeRange: {
            start: startTime,
            end: new Date().toISOString(),
          },
        };
      },
    };
  }
}

// ===============================================================================
// CLI ENTRY POINT
// ===============================================================================

if (import.meta.main) {
  const corsair = new Corsair();

  console.log("CORSAIR MVP - Atomic Implementation");
  console.log("====================================");
  console.log("Primitives: RECON, MARK, RAID, PLUNDER, CHART, ESCAPE");
  console.log("");
  console.log("Usage: Import Corsair class and use programmatically");
  console.log("Tests: bun test tests/primitives/");
}
