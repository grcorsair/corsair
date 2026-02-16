/**
 * CORSAIR v0.3.0 — Type Definitions
 *
 * Core types used by the kept components:
 * - Ingestion pipeline
 * - Parley protocol (JWT-VC, SCITT, FLAGSHIP)
 * - Chart engine (framework mapping)
 * - Evidence engine (hash chain)
 * - Output (OSCAL, reports)
 */

// ===============================================================================
// CORE TYPES
// ===============================================================================

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type EvidenceType = "positive" | "negative" | "exception";
export type OperationType = "recon" | "mark" | "raid" | "chart" | "plunder" | "escape" | "compaction_summary";

// Core frameworks with autocomplete; extensible via (string & {})
export type CoreFramework = "MITRE" | "NIST-800-53" | "NIST-CSF" | "CIS" | "SOC2" | "ISO27001" | "PCI-DSS" | "CMMC" | "FedRAMP" | "HIPAA" | "GDPR" | "SOX" | "COBIT";
export type Framework = CoreFramework | (string & {});

// ===============================================================================
// MARK TYPES (used by MarqueGeneratorInput, mapper, chart-engine)
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
// RAID TYPES (kept for MarqueGeneratorInput backwards compat)
// ===============================================================================

export type CoreAttackVector =
  | "mfa-bypass" | "password-spray" | "token-replay" | "session-hijack"
  | "public-access-test" | "encryption-test" | "versioning-test";
export type AttackVector = CoreAttackVector | (string & {});

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
  approvalRequired?: boolean;
  approved?: boolean;
  approver?: string;
  approvalTimestamp?: string;
}

// ===============================================================================
// PLUNDER TYPES (used by evidence engine)
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
// CHART TYPES (used by chart-engine, mapper, marque-generator)
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
// SPYGLASS THREAT MODEL TYPES (used by ChartResult, MarqueGeneratorInput)
// ===============================================================================

export type STRIDECategory =
  | "Spoofing"
  | "Tampering"
  | "Repudiation"
  | "InformationDisclosure"
  | "DenialOfService"
  | "ElevationOfPrivilege";

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

export interface ThreatModelResult {
  threats: ThreatFinding[];
  methodology: "STRIDE-automated";
  provider: string;
  analyzedAt: string;
  threatCount: number;
  riskDistribution: Record<string, number>;
}

// ===============================================================================
// PLUGIN-ADJACENT TYPES (used by chart-engine for framework mapping entries)
// ===============================================================================

/**
 * A single control reference within any compliance framework.
 */
export interface ControlRef {
  controlId: string;
  controlName?: string;
  description?: string;
}

/**
 * Framework mapping entry for drift fields or attack vectors.
 */
export interface FrameworkMappingEntry {
  mitre: string;
  mitreName?: string;
  mitreTactic?: string;
  controls?: Partial<Record<Framework, ControlRef[]>>;
  nist?: string;
  nistFunction?: string;
  soc2?: string;
  soc2Description?: string;
  description?: string;
}
