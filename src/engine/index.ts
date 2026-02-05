/**
 * CORSAIR Engine - Facade & Barrel Export
 *
 * The Corsair class delegates to focused engine modules.
 * This file replaces the 1,416-LOC corsair-mvp.ts God class.
 */

import { EventEmitter } from "events";

// Import all types from the types module
import type {
  MfaConfiguration,
  Severity,
  AttackVector,
  CoreAttackVector,
  Framework,
  CoreFramework,
  EvidenceType,
  OperationType,
  PasswordPolicy,
  RiskConfiguration,
  CognitoSnapshot,
  S3Snapshot,
  ProviderSnapshot,
  ControlRef,
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
} from "../types";

// Import engines
import { ReconEngine } from "./recon-engine";
import type { ReconOptions } from "./recon-engine";
import { MarkEngine } from "./mark-engine";
import { RaidEngine, LaneSerializer } from "./raid-engine";
import { ChartEngine } from "./chart-engine";
import { EscapeEngine } from "./escape-engine";
import { EventEngine } from "./event-engine";
import { PluginEngine } from "./plugin-engine";

// Import delegated engines (already extracted before this refactor)
import { EvidenceEngine } from "../evidence";
import { CompactionEngine } from "../compaction";

// ===============================================================================
// CORSAIR FACADE CLASS
// ===============================================================================

export class Corsair extends EventEmitter {
  private evidencePath: string;
  private evidenceEngine: EvidenceEngine;
  private compactionEngine: CompactionEngine;
  private initialized: boolean = false;

  /** Shared event store — all engines push to this by reference */
  private events: CorsairEvent[] = [];

  // Engine instances
  private reconEngine: ReconEngine;
  private markEngine: MarkEngine;
  private raidEngine: RaidEngine;
  private chartEngine: ChartEngine;
  private escapeEngine: EscapeEngine;
  private eventEngine: EventEngine;
  private pluginEngine: PluginEngine;

  constructor(options: CorsairOptions = {}) {
    super();
    this.evidencePath = options.evidencePath || "./corsair-evidence.jsonl";
    this.evidenceEngine = new EvidenceEngine(this.evidencePath);
    this.compactionEngine = new CompactionEngine(this.evidenceEngine);

    // Initialize engines with shared state
    this.reconEngine = new ReconEngine();
    this.markEngine = new MarkEngine(this, this.events);
    this.raidEngine = new RaidEngine(this, this.events);
    this.pluginEngine = new PluginEngine();
    this.chartEngine = new ChartEngine((id) => this.pluginEngine.get(id));
    this.escapeEngine = new EscapeEngine();
    this.eventEngine = new EventEngine(this, this.events);
  }

  // ===============================================================================
  // RECON
  // ===============================================================================

  async recon(targetId: string, options?: ReconOptions): Promise<ReconResult> {
    return this.reconEngine.recon(targetId, options);
  }

  // ===============================================================================
  // PLUGIN MANAGEMENT
  // ===============================================================================

  async initialize(pluginDir: string = "plugins/"): Promise<InitializeResult> {
    console.log(`Discovering plugins in ${pluginDir}...`);

    const result = await this.pluginEngine.discover(pluginDir);

    console.log(`Discovered ${result.discoveredCount} plugin(s): ${result.plugins.join(", ") || "none"}`);

    if (result.invalidManifests && result.invalidManifests.length > 0) {
      console.warn(`Skipped ${result.invalidManifests.length} invalid manifest(s)`);
    }

    this.initialized = true;
    return result;
  }

  getPlugin(providerId: string): RegisteredPlugin | undefined {
    return this.pluginEngine.get(providerId);
  }

  getPlugins(): RegisteredPlugin[] {
    return this.pluginEngine.getAll();
  }

  hasPlugin(providerId: string): boolean {
    return this.pluginEngine.has(providerId);
  }

  registerPlugin(manifest: PluginManifest): void {
    this.pluginEngine.register(manifest);
  }

  // ===============================================================================
  // MARK
  // ===============================================================================

  async mark(snapshot: CognitoSnapshot | Record<string, unknown>, expectations: Expectation[]): Promise<MarkResult> {
    return this.markEngine.mark(snapshot, expectations);
  }

  // ===============================================================================
  // RAID
  // ===============================================================================

  async raid(snapshot: CognitoSnapshot | Record<string, unknown>, options: RaidOptions | RaidOptionsWithApproval): Promise<RaidResult> {
    return this.raidEngine.raid(snapshot, options);
  }

  // ===============================================================================
  // PLUNDER (Delegated to EvidenceEngine)
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
  // COMPACTION
  // ===============================================================================

  async compactEvidence(evidencePath: string): Promise<CompactionResult> {
    return this.compactionEngine.compactEvidence(evidencePath);
  }

  // ===============================================================================
  // CHART
  // ===============================================================================

  async chart(findings: DriftFinding[], options: ChartOptions & { providerId?: string } = {}): Promise<ChartResult> {
    return this.chartEngine.chart(findings, options);
  }

  async chartRaid(raidResult: RaidResult, providerId: string = "aws-cognito"): Promise<ComplianceMapping[]> {
    return this.chartEngine.chartRaid(raidResult, providerId);
  }

  // ===============================================================================
  // ESCAPE
  // ===============================================================================

  escape(cleanupOps: Array<() => { operation: string; success: boolean }>): SimpleEscapeResult {
    return this.escapeEngine.escape(cleanupOps);
  }

  async createGuard(snapshot: CognitoSnapshot | Record<string, unknown>, options: EscapeOptions = {}): Promise<ScopeGuard> {
    return this.escapeEngine.createGuard(snapshot, options);
  }

  async releaseGuard(guard: ScopeGuard, currentState: CognitoSnapshot | Record<string, unknown>): Promise<ReleaseResult> {
    return this.escapeEngine.releaseGuard(guard, currentState);
  }

  async withEscapeGuard<T>(
    snapshot: CognitoSnapshot | Record<string, unknown>,
    fn: (guard: ScopeGuard) => Promise<T>
  ): Promise<EscapeResult<T>> {
    return this.escapeEngine.withEscapeGuard(snapshot, fn);
  }

  getLastGuardStatus(): GuardStatus {
    return this.escapeEngine.getLastGuardStatus();
  }

  logStateTransition(guard: ScopeGuard, field: string, from: unknown, to: unknown): void {
    return this.escapeEngine.logStateTransition(guard, field, from, to);
  }

  getGuardTransitions(): StateTransition[] {
    return this.escapeEngine.getGuardTransitions();
  }

  captureIntermediateState(guard: ScopeGuard, snapshot: CognitoSnapshot | Record<string, unknown>): void {
    return this.escapeEngine.captureIntermediateState(guard, snapshot);
  }

  async rollback(guard: ScopeGuard): Promise<RollbackResult> {
    return this.escapeEngine.rollback(guard);
  }

  isGuardExpired(guard: ScopeGuard): boolean {
    return this.escapeEngine.isGuardExpired(guard);
  }

  // ===============================================================================
  // EVENT SYSTEM
  // ===============================================================================

  async queryEvents(filter: EventFilter): Promise<CorsairEvent[]> {
    return this.eventEngine.queryEvents(filter);
  }

  createEventAggregator(): EventAggregator {
    return this.eventEngine.createEventAggregator();
  }
}

// ===============================================================================
// RE-EXPORTS
// ===============================================================================

// Re-export all types for external consumers
export type {
  MfaConfiguration,
  Severity,
  AttackVector,
  CoreAttackVector,
  Framework,
  CoreFramework,
  EvidenceType,
  OperationType,
  PasswordPolicy,
  RiskConfiguration,
  CognitoSnapshot,
  S3Snapshot,
  ProviderSnapshot,
  ControlRef,
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
  ReconOptions,
};

// Re-export engine classes for direct use
export { ReconEngine } from "./recon-engine";
export { MarkEngine } from "./mark-engine";
export { RaidEngine, LaneSerializer } from "./raid-engine";
export { ChartEngine } from "./chart-engine";
export { EscapeEngine } from "./escape-engine";
export { EventEngine } from "./event-engine";
export { PluginEngine, PluginEngine as PluginRegistry } from "./plugin-engine";
