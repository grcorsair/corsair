/**
 * Orchestrator Types — Multi-Agent Audit Coordination
 *
 * Types for splitting a large audit into parallel chunks,
 * running them concurrently across agents, and merging results.
 *
 * The "4 agents audit AWS in 15 min" feature.
 */

import type { AuditScope, AuditResult, AuditConfig, AuditFinding } from "./types";

// =============================================================================
// SPLIT STRATEGY
// =============================================================================

/** How to split work across agents */
export type SplitStrategy =
  | "by-file"       // Each agent gets a subset of evidence files
  | "by-framework"  // Each agent handles specific frameworks
  | "by-domain";    // Each agent handles a domain (network, identity, data, etc.)

// =============================================================================
// AGENT
// =============================================================================

/** Agent assignment */
export interface AuditAgent {
  id: string;
  name: string;                        // "agent-network", "agent-identity", etc.
  scope: AuditScope;                   // This agent's slice of the work
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  result?: AuditResult;
  error?: string;
}

// =============================================================================
// ORCHESTRATION PLAN
// =============================================================================

/** Orchestration plan */
export interface OrchestrationPlan {
  id: string;
  originalScope: AuditScope;
  strategy: SplitStrategy;
  agents: AuditAgent[];
  config: AuditConfig;
  orchestratorConfig: OrchestratorConfig;
  createdAt: string;
}

// =============================================================================
// MERGED RESULT
// =============================================================================

/** Merged audit result (combines all agent results) */
export interface MergedAuditResult {
  id: string;
  planId: string;
  scope: AuditScope;

  // Agent details
  agentCount: number;
  agentsCompleted: number;
  agentsFailed: number;

  // Merged results
  totalControls: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;

  // Combined scoring
  compositeScore: number;
  agentScores: Array<{ agentId: string; agentName: string; score: number; grade: string }>;

  // Merged findings (deduplicated)
  findings: AuditFinding[];
  criticalFindings: number;
  highFindings: number;

  // Timing
  startedAt: string;
  completedAt: string;
  totalDuration: number;
  parallelSpeedup: number;            // sequential time / actual time

  // Summary
  overallGrade: string;
}

// =============================================================================
// ORCHESTRATOR CONFIG
// =============================================================================

/** Orchestrator config */
export interface OrchestratorConfig {
  maxAgents: number;                   // Default 4
  strategy: SplitStrategy;            // Default "by-file"
  failFast: boolean;                  // Stop all if one fails (default false)
  mergeStrategy: "union" | "intersection";  // How to combine findings (default "union")
}
