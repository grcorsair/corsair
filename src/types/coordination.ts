/**
 * Coordination Type Definitions (Phase 3.1)
 *
 * Types for multi-agent delegation and parallel execution:
 * - AgentType: RECON, MARK, RAID agent specializations
 * - AgentStatus: Lifecycle tracking for spawned agents
 * - CoordinatorState: Persistent state for coordinator
 * - ResourceSplit: Work distribution for parallel RECON
 * - ISCDistribution: Criteria distribution for parallel MARK
 */

import type { ISCCriterion } from "./isc";
import type { DriftFinding } from "../types";

/**
 * Agent type specialization.
 * - RECON: Reconnaissance agents for parallel resource scanning
 * - MARK: Drift detection agents for parallel ISC evaluation
 * - RAID: Attack agents (single instance, not parallelized)
 */
export type AgentType = "RECON" | "MARK" | "RAID";

/**
 * Agent lifecycle status.
 * - SPAWNING: Agent being initialized
 * - RUNNING: Agent actively executing
 * - COMPLETED: Agent finished successfully
 * - FAILED: Agent encountered error
 * - TIMEOUT: Agent exceeded time limit
 */
export type AgentStatus = "SPAWNING" | "RUNNING" | "COMPLETED" | "FAILED" | "TIMEOUT";

/**
 * Metadata for a spawned agent.
 * Stored in agents/{agentId}/agent-status.json
 */
export interface AgentMetadata {
  /** Unique agent identifier (e.g., "recon-agent-0") */
  agentId: string;

  /** Agent type/specialization */
  type: AgentType;

  /** Current lifecycle status */
  status: AgentStatus;

  /** ISO-8601 timestamp when agent was spawned */
  spawnedAt: string;

  /** ISO-8601 timestamp when agent started running */
  startedAt?: string;

  /** ISO-8601 timestamp when agent completed */
  completedAt?: string;

  /** Duration in milliseconds (computed after completion) */
  durationMs?: number;

  /** Error message if status is FAILED */
  error?: string;

  /** Agent work directory path */
  workDir: string;

  /** Number of resources/criteria assigned */
  assignmentCount: number;

  /** Output file path (relative to agent workDir) */
  outputFile?: string;
}

/**
 * Coordinator state for persistence.
 * Stored in WORK/{date}/{missionId}/coordinator-state.json
 */
export interface CoordinatorState {
  /** Mission ID this coordinator is managing */
  missionId: string;

  /** Current phase of coordination (RECON, MARK, or RAID) */
  currentPhase: AgentType | "IDLE" | "AGGREGATING";

  /** All spawned agents with their metadata */
  agents: AgentMetadata[];

  /** Number of agents spawned for current phase */
  agentCount: number;

  /** ISO-8601 timestamp when coordination started */
  startedAt: string;

  /** ISO-8601 timestamp when coordination completed */
  completedAt?: string;

  /** Total duration in milliseconds */
  totalDurationMs?: number;

  /** Performance metrics */
  metrics?: CoordinatorMetrics;

  /** Last error encountered */
  lastError?: string;
}

/**
 * Performance metrics tracked by coordinator.
 */
export interface CoordinatorMetrics {
  /** Total resources processed */
  totalResources: number;

  /** Number of parallel agents used */
  parallelAgents: number;

  /** Speedup factor compared to sequential (calculated) */
  speedupFactor: number;

  /** Resources processed per second */
  resourcesPerSecond: number;

  /** Time spent in RECON phase (ms) */
  reconDurationMs?: number;

  /** Time spent in MARK phase (ms) */
  markDurationMs?: number;

  /** Time spent in RAID phase (ms) */
  raidDurationMs?: number;
}

/**
 * Resource assignment for a RECON agent.
 * Each agent gets a subset of resources to scan.
 */
export interface ResourceSplit {
  /** Agent ID to receive this split */
  agentId: string;

  /** List of resource identifiers to scan */
  resources: string[];

  /** Agent index (0-based) */
  index: number;
}

/**
 * ISC criteria distribution for a MARK agent.
 * Each agent evaluates criteria relevant to their assigned resource.
 */
export interface ISCDistribution {
  /** Agent ID to receive this distribution */
  agentId: string;

  /** Resource ID this agent is evaluating */
  resourceId: string;

  /** ISC criteria to evaluate (filtered by resource type) */
  criteria: ISCCriterion[];

  /** Agent index (0-based) */
  index: number;
}

/**
 * Agent assignment file structure.
 * Written to agents/{agentId}/assignment.json
 */
export interface AgentAssignment {
  /** Agent ID */
  agentId: string;

  /** Agent type */
  type: AgentType;

  /** Mission ID */
  missionId: string;

  /** For RECON: resources to scan */
  resources?: string[];

  /** For MARK: resource being evaluated */
  resourceId?: string;

  /** For MARK: ISC criteria to evaluate */
  criteria?: ISCCriterion[];

  /** ISO-8601 timestamp when assignment was created */
  assignedAt: string;
}

/**
 * Partial snapshot output from RECON agent.
 * Written to agents/{agentId}/snapshot-partial.json
 */
export interface PartialSnapshot {
  /** Agent ID that produced this snapshot */
  agentId: string;

  /** Resources scanned by this agent */
  resources: string[];

  /** Snapshot data keyed by resource ID */
  snapshots: Record<string, unknown>;

  /** ISO-8601 timestamp when scan completed */
  completedAt: string;

  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Drift findings output from MARK agent.
 * Written to agents/{agentId}/drift-findings.json
 */
export interface AgentDriftFindings {
  /** Agent ID that produced these findings */
  agentId: string;

  /** Resource ID that was evaluated */
  resourceId: string;

  /** Drift findings detected */
  findings: DriftFinding[];

  /** ISC criteria that were evaluated (with updated satisfaction) */
  evaluatedCriteria: ISCCriterion[];

  /** ISO-8601 timestamp when evaluation completed */
  completedAt: string;

  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Aggregated RECON results from all agents.
 */
export interface AggregatedReconResults {
  /** All snapshots merged from agent outputs */
  snapshots: Map<string, unknown>;

  /** Total resources scanned */
  totalResources: number;

  /** Number of agents that contributed */
  agentCount: number;

  /** Number of agents that failed */
  failedAgents: number;

  /** Total duration in milliseconds */
  totalDurationMs: number;
}

/**
 * Aggregated MARK results from all agents.
 */
export interface AggregatedMarkResults {
  /** All drift findings merged from agent outputs */
  findings: DriftFinding[];

  /** All evaluated criteria with updated satisfaction */
  evaluatedCriteria: ISCCriterion[];

  /** Total resources evaluated */
  totalResources: number;

  /** Number of agents that contributed */
  agentCount: number;

  /** Number of agents that failed */
  failedAgents: number;

  /** ISC satisfaction rate after aggregation */
  satisfactionRate: number;

  /** Total duration in milliseconds */
  totalDurationMs: number;
}

/**
 * Options for coordinator configuration.
 */
export interface CoordinatorOptions {
  /** Maximum number of parallel RECON agents (default: 4) */
  maxReconAgents?: number;

  /** Timeout for agent completion in milliseconds (default: 300000 = 5 min) */
  agentTimeoutMs?: number;

  /** Polling interval for agent status in milliseconds (default: 2000) */
  pollIntervalMs?: number;

  /** Base directory for work data (default: ./corsair-work) */
  workDir?: string;

  /** Enable verbose logging */
  verbose?: boolean;
}
