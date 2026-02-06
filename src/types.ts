/**
 * CORSAIR MVP - Type Definitions
 *
 * All type definitions extracted from corsair-mvp.ts for better modularity.
 * This file has no dependencies and can be imported by any module.
 *
 * NOTE: Cognito-specific types (MfaConfiguration, PasswordPolicy, RiskConfiguration,
 * CognitoSnapshot) are now defined in the aws-cognito plugin and re-exported here
 * for backwards compatibility. New provider plugins should define their own types.
 */

// ===============================================================================
// COGNITO TYPES (Re-exported from aws-cognito plugin for backwards compatibility)
// ===============================================================================

export type {
  MfaConfiguration,
  PasswordPolicy,
  RiskConfiguration,
  DeviceConfiguration,
  CognitoSnapshot,
} from "../plugins/aws-cognito/aws-cognito-plugin";

// ===============================================================================
// PROVIDER SNAPSHOT (Generic base for all provider snapshots)
// ===============================================================================

/**
 * Base interface for any provider snapshot.
 * Every plugin should produce snapshots compatible with this shape.
 */
export interface ProviderSnapshot {
  /** Unique identifier for the resource (userPoolId, bucketName, tenantId, etc.) */
  resourceId: string;
  /** Provider plugin that produced this snapshot */
  providerId: string;
  /** ISO-8601 timestamp when snapshot was taken */
  observedAt: string;
  /** Arbitrary provider-specific data */
  [key: string]: unknown;
}

// ===============================================================================
// IAM TYPES (Re-exported from aws-iam plugin)
// ===============================================================================

export type {
  IAMSnapshot,
} from "../plugins/aws-iam/aws-iam-plugin";

// ===============================================================================
// LAMBDA TYPES (Re-exported from aws-lambda plugin)
// ===============================================================================

export type {
  LambdaSnapshot,
} from "../plugins/aws-lambda/aws-lambda-plugin";

// ===============================================================================
// RDS TYPES (Re-exported from aws-rds plugin)
// ===============================================================================

export type {
  RDSSnapshot,
} from "../plugins/aws-rds/aws-rds-plugin";

// ===============================================================================
// S3 TYPES
// ===============================================================================

export interface S3Snapshot {
  bucketName: string;
  publicAccessBlock: boolean;
  encryption: "AES256" | "aws:kms" | null;
  versioning: "Enabled" | "Disabled";
  logging: boolean;
}

// ===============================================================================
// CORE TYPES
// ===============================================================================

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
// Core attack vectors with autocomplete; extensible via (string & {})
export type CoreAttackVector =
  | "mfa-bypass" | "password-spray" | "token-replay" | "session-hijack"  // Cognito vectors
  | "public-access-test" | "encryption-test" | "versioning-test";        // S3 vectors
export type AttackVector = CoreAttackVector | (string & {});

// Core frameworks with autocomplete; extensible via (string & {})
export type CoreFramework = "MITRE" | "NIST-800-53" | "NIST-CSF" | "CIS" | "SOC2" | "ISO27001" | "PCI-DSS" | "CMMC" | "FedRAMP" | "HIPAA" | "GDPR" | "SOX" | "COBIT";
export type Framework = CoreFramework | (string & {});
export type EvidenceType = "positive" | "negative" | "exception";
export type OperationType = "recon" | "mark" | "raid" | "chart" | "plunder" | "escape" | "compaction_summary";

// ===============================================================================
// RECON TYPES
// ===============================================================================

export interface ReconMetadata {
  source: "fixture" | "aws";
  readonly: boolean;
  durationMs: number;
}

export interface ReconResult {
  snapshotId: string;
  snapshot: CognitoSnapshot | S3Snapshot | IAMSnapshot | LambdaSnapshot | RDSSnapshot;
  metadata: ReconMetadata;
  stateModified: boolean;
  durationMs: number;
}

// ===============================================================================
// MARK TYPES
// ===============================================================================

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
  /** Optional reference to originating threat ID from STRIDE analysis */
  threatRef?: string;
}

export interface MarkResult {
  findings: DriftFinding[];
  driftDetected: boolean;
  durationMs: number;
}

// ===============================================================================
// RAID TYPES
// ===============================================================================

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
  // Approval Gate fields (OpenClaw Pattern 4)
  approvalRequired?: boolean;
  approved?: boolean;
  approver?: string;
  approvalTimestamp?: string;
}

export interface RaidOptions {
  vector: AttackVector;
  intensity: number;
  dryRun: boolean;
}

// ===============================================================================
// PLUNDER TYPES
// ===============================================================================

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

// ===============================================================================
// CHART TYPES
// ===============================================================================

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
  /** Extensible framework mappings keyed by Framework string */
  frameworks?: Record<Framework, {
    controls: { controlId: string; controlName: string; status: string }[];
  }>;
  /** Threat model result if STRIDE analysis was used */
  threatModel?: ThreatModelResult;
}

// ===============================================================================
// ESCAPE TYPES
// ===============================================================================

export interface StateTransition {
  guardId: string;
  field: string;
  from: unknown;
  to: unknown;
  timestamp: string;
}

export interface ScopeGuard {
  guardId: string;
  initialState: CognitoSnapshot | Record<string, unknown>;
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
  fromState: CognitoSnapshot | Record<string, unknown>;
  toState: CognitoSnapshot | Record<string, unknown>;
}

export interface ReleaseResult {
  restored: boolean;
  finalState: CognitoSnapshot | Record<string, unknown>;
}

export interface EscapeOptions {
  timeoutMs?: number;
}

// ===============================================================================
// APPROVAL GATE TYPES (OpenClaw Pattern 4)
// ===============================================================================

export type ApprovalChannel = "slack" | "email" | "webhook";

export interface ApprovalGate {
  id?: string;
  requiredSeverity: Severity;
  approvers: string[];
  timeoutMs: number;
  channel: ApprovalChannel;
}

export interface ApprovalRequest {
  gate: ApprovalGate;
  vector: string;
  intensity: number;
  targetId: string;
  blastRadius: {
    affectedUsers?: number;
    affectedResources?: string[];
    environment: string;
  };
  requestedAt: string;
}

export interface ApprovalResponse {
  approved: boolean;
  approver: string;
  timestamp: string;
  reason?: string;
}

export interface RaidOptionsWithApproval extends RaidOptions {
  approvalGate?: ApprovalGate;
  requestApproval?: (request: ApprovalRequest) => Promise<ApprovalResponse>;
}

// ===============================================================================
// COMPACTION TYPES (OpenClaw Pattern 1)
// ===============================================================================

/**
 * Result of evidence compaction operation.
 * Compaction reduces JSONL file size by aggregating records into summaries.
 */
export interface CompactionResult {
  before: {
    recordCount: number;
    fileSizeBytes: number;
  };
  after: {
    recordCount: number;
    fileSizeBytes: number;
  };
  /** Compression ratio: (beforeSize - afterSize) / beforeSize. Range: 0.0 to 1.0 */
  compression: number;
  /** Whether the new hash chain is valid after compaction */
  hashChainValid: boolean;
  /** Path to backup file created before compaction */
  backupPath: string;
  /** ISO-8601 timestamp when compaction was performed */
  compactedAt: string;
}

/**
 * Summary record created during compaction.
 * Aggregates multiple original records into a single summary.
 */
export interface CompactionSummary {
  /** Operation type for compaction summaries */
  operation: "compaction_summary";
  /** Time range covered by this summary */
  timeRange: {
    start: string;
    end: string;
  };
  /** List of operation types that were aggregated */
  aggregatedOperations: string[];
  /** Number of records aggregated into this summary */
  recordCount: number;
  /** Critical findings preserved from aggregated records */
  criticalFindings?: string[];
}

// ===============================================================================
// EVENT SYSTEM TYPES (OpenClaw Pattern 2 - Multi-Layer Events)
// ===============================================================================

/**
 * Event type emitted by Corsair operations.
 * Supports pub/sub pattern for monitoring and aggregation.
 */
export type CorsairEventType = "raid:complete" | "drift:detected" | "plunder:recorded" | "escape:executed";

/**
 * Event emitted by Corsair operations.
 * Contains full metadata for audit trail and aggregation.
 */
export interface CorsairEvent {
  /** Event type identifier */
  type: CorsairEventType;
  /** ISO-8601 timestamp when event occurred */
  timestamp: string;
  /** Target resource ID (e.g., userPoolId) */
  targetId: string;
  /** Severity level of the operation */
  severity?: Severity;
  /** Attack vector (for raid events) */
  vector?: string;
  /** Whether the operation succeeded */
  success?: boolean;
  /** Findings from the operation */
  findings?: string[];
  /** Additional operation-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filter criteria for querying events.
 */
export interface EventFilter {
  /** Filter by severity level */
  severity?: Severity;
  /** Filter by event type */
  type?: CorsairEventType;
  /** Filter by time range */
  timeRange?: {
    start: string;
    end: string;
  };
}

/**
 * Event aggregator interface for collecting and summarizing events.
 */
export interface EventAggregator {
  /** Get summary of all captured events */
  getSummary(): EventAggregatorSummary;
}

/**
 * Summary produced by event aggregator.
 */
export interface EventAggregatorSummary {
  /** Total number of events captured */
  totalEvents: number;
  /** Count of events by type */
  byType: Record<string, number>;
  /** Count of events by severity */
  bySeverity: Record<string, number>;
  /** Time range of captured events */
  timeRange: {
    start: string;
    end: string;
  };
}

// ===============================================================================
// PLUGIN SYSTEM TYPES
// ===============================================================================

/**
 * Attack vector definition within a plugin manifest.
 * Each vector describes a specific attack simulation capability.
 */
export interface PluginAttackVector {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  mitreMapping: string[];
  preconditions?: string[];
  remediations?: string[];
}

/**
 * A single control reference within any compliance framework.
 */
export interface ControlRef {
  controlId: string;
  controlName?: string;
  description?: string;
}

/**
 * Framework mapping for a drift field or attack vector.
 * Enables plugin-provided compliance framework mappings.
 *
 * The `controls` field is the extensible path (maps Framework -> ControlRef[]).
 * Legacy flat fields (nist, soc2, etc.) are preserved for backwards compatibility.
 */
export interface FrameworkMappingEntry {
  /** MITRE ATT&CK technique ID (e.g., "T1556", "T1556.006") */
  mitre: string;
  /** MITRE technique name for display */
  mitreName?: string;
  /** MITRE tactic for context */
  mitreTactic?: string;
  /** Generic framework controls keyed by Framework string */
  controls?: Partial<Record<Framework, ControlRef[]>>;
  // Legacy flat fields preserved for backwards compat:
  /** NIST CSF control ID (e.g., "PR.AC-7") */
  nist?: string;
  /** NIST function description */
  nistFunction?: string;
  /** SOC2 control ID(s) (e.g., "CC6.1", "CC6.1, CC6.6") */
  soc2?: string;
  /** SOC2 control description */
  soc2Description?: string;
  /** Human-readable description */
  description?: string;
}

/**
 * Framework mappings provided by a plugin.
 * Enables extensible compliance mapping per provider.
 */
export interface PluginFrameworkMappings {
  /** Mappings for drift fields (e.g., "mfaConfiguration" -> MITRE T1556) */
  drift?: Record<string, FrameworkMappingEntry>;
  /** Mappings for attack vectors (e.g., "mfa-bypass" -> MITRE T1556.006) */
  attackVectors?: Record<string, FrameworkMappingEntry>;
}

/**
 * Plugin manifest schema.
 * Every plugin must provide a *.plugin.json file with this structure.
 */
export interface PluginManifest {
  providerId: string;
  providerName: string;
  version: string;
  description?: string;
  attackVectors: PluginAttackVector[];
  capabilities?: {
    recon?: boolean;
    raid?: boolean;
    escape?: boolean;
    realTimeAPI?: boolean;
  };
  requiredPermissions?: string[];
  documentation?: {
    readme?: string;
    examples?: string;
    api?: string;
  };
  /**
   * Framework mappings for drift fields and attack vectors.
   * Enables plugin-provided compliance mappings instead of hardcoded core mappings.
   */
  frameworkMappings?: PluginFrameworkMappings;
}

/**
 * Registered plugin container.
 * Holds the manifest and any loaded plugin instance.
 */
export interface RegisteredPlugin {
  manifest: PluginManifest;
  instance?: unknown;
  loadedAt: string;
}

/**
 * Result of plugin initialization/discovery.
 */
export interface InitializeResult {
  discoveredCount: number;
  plugins: string[];
  invalidManifests?: string[];
  error?: string;
}

// ===============================================================================
// STRIDE THREAT MODEL TYPES
// ===============================================================================

/**
 * STRIDE threat categories — the 6 classical threat dimensions.
 */
export type STRIDECategory =
  | "Spoofing"
  | "Tampering"
  | "Repudiation"
  | "InformationDisclosure"
  | "DenialOfService"
  | "ElevationOfPrivilege";

/**
 * A single threat finding from STRIDE analysis.
 */
export interface ThreatFinding {
  id: string;
  stride: STRIDECategory;
  description: string;
  mitreTechnique: string;
  mitreName: string;
  affectedField: string;
  severity: Severity;
  attackVectors: AttackVector[];
}

/**
 * Result of STRIDE threat model analysis.
 */
export interface ThreatModelResult {
  threats: ThreatFinding[];
  methodology: "STRIDE-automated";
  provider: string;
  analyzedAt: string;
  threatCount: number;
  riskDistribution: Record<string, number>;
}

/**
 * Options for threat model generation.
 */
export interface ThreatModelOptions {
  provider?: string;
  frameworks?: Framework[];
  includeRemediations?: boolean;
}

// ===============================================================================
// CORSAIR OPTIONS
// ===============================================================================

export interface CorsairOptions {
  evidencePath?: string;
}

// ===============================================================================
// ISC (IDEAL STATE CRITERIA) TYPES
// ===============================================================================

export type {
  ISCSatisfactionStatus,
  ISCStatus,
  ISCCriterion,
  ISCSatisfaction,
  ISCState,
  ISCExtractionResult,
  ISCVerificationResult,
} from "./types/isc";
