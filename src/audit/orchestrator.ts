/**
 * Orchestrator — Multi-Agent Audit Coordination
 *
 * Splits a large audit into parallel chunks, runs them concurrently
 * across agents, and merges results. The "4 agents audit AWS in 15 min" feature.
 *
 * Pipeline:
 *   1. planAudit()       — Split work across agents by strategy
 *   2. executeParallel() — Run all agents concurrently via Promise.allSettled
 *   3. mergeResults()    — Combine agent results, deduplicate findings
 *   4. formatOrchestrationReport() — Human-readable multi-agent report
 *   5. runOrchestrated() — Convenience: plan + execute + merge in one call
 */

import { randomUUID } from "crypto";
import { runAudit } from "./audit-engine";
import type { AuditScope, AuditConfig, AuditFinding } from "./types";
import type {
  SplitStrategy,
  AuditAgent,
  OrchestrationPlan,
  MergedAuditResult,
  OrchestratorConfig,
} from "./orchestrator-types";

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxAgents: 4,
  strategy: "by-file",
  failFast: false,
  mergeStrategy: "union",
};

const DEFAULT_AUDIT_CONFIG: Partial<AuditConfig> = {
  includeGovernance: false,
  includeScore: true,
  generateFindings: true,
  signResult: false,
  outputFormat: "json",
};

// =============================================================================
// SEVERITY ORDERING (for dedup: keep highest severity)
// =============================================================================

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// =============================================================================
// DOMAIN PATTERNS (for by-domain strategy)
// =============================================================================

const DOMAIN_PATTERNS: Record<string, RegExp> = {
  network: /network|firewall|waf|ddos|vpc|subnet|sg|security.?group|net/i,
  identity: /identity|iam|auth|mfa|sso|access|id[.-]/i,
  data: /data|encrypt|storage|s3|rds|backup|db/i,
  infra: /infra|patch|config|cm|compute|ec2|lambda|container/i,
};

// =============================================================================
// 1. PLAN AUDIT
// =============================================================================

/**
 * Split the audit work across agents based on the chosen strategy.
 *
 * Returns an OrchestrationPlan with agent assignments. Each agent gets
 * its own AuditScope subset of the original scope.
 */
export function planAudit(
  scope: AuditScope,
  config?: Partial<OrchestratorConfig>,
): OrchestrationPlan {
  const mergedConfig: OrchestratorConfig = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
  const planId = `plan-${randomUUID()}`;

  let agents: AuditAgent[];

  switch (mergedConfig.strategy) {
    case "by-file":
      agents = splitByFile(scope, mergedConfig.maxAgents);
      break;
    case "by-framework":
      agents = splitByFramework(scope, mergedConfig.maxAgents);
      break;
    case "by-domain":
      agents = splitByDomain(scope, mergedConfig.maxAgents);
      break;
    default:
      agents = splitByFile(scope, mergedConfig.maxAgents);
  }

  return {
    id: planId,
    originalScope: scope,
    strategy: mergedConfig.strategy,
    agents,
    config: {
      includeGovernance: false,
      includeScore: true,
      generateFindings: true,
      signResult: false,
      outputFormat: "json",
    },
    orchestratorConfig: mergedConfig,
    createdAt: new Date().toISOString(),
  };
}

// =============================================================================
// SPLIT STRATEGIES
// =============================================================================

/**
 * by-file: Distribute evidence files round-robin across agents.
 * If fewer files than maxAgents, create one agent per file.
 */
function splitByFile(scope: AuditScope, maxAgents: number): AuditAgent[] {
  const paths = scope.evidencePaths;
  if (paths.length === 0) return [];

  const agentCount = Math.min(paths.length, maxAgents);
  const buckets: string[][] = Array.from({ length: agentCount }, () => []);
  const formatBuckets: (string | undefined)[][] = Array.from({ length: agentCount }, () => []);

  // Round-robin distribute files
  for (let i = 0; i < paths.length; i++) {
    const bucket = i % agentCount;
    buckets[bucket].push(paths[i]);
    if (scope.formats) {
      formatBuckets[bucket].push(scope.formats[i]);
    }
  }

  return buckets.map((filePaths, idx) => {
    const agentId = `agent-${randomUUID().slice(0, 8)}`;
    const agentName = `agent-${idx + 1}`;
    const agentScope: AuditScope = {
      name: `${scope.name} (${agentName})`,
      frameworks: [...scope.frameworks],
      evidencePaths: filePaths,
      formats: scope.formats ? formatBuckets[idx].filter((f): f is string => f !== undefined) : undefined,
      excludeControls: scope.excludeControls ? [...scope.excludeControls] : undefined,
    };

    return {
      id: agentId,
      name: agentName,
      scope: agentScope,
      status: "pending" as const,
    };
  });
}

/**
 * by-framework: One agent per framework (up to maxAgents).
 * Each agent gets ALL evidence files but filters for its framework.
 */
function splitByFramework(scope: AuditScope, maxAgents: number): AuditAgent[] {
  const frameworks = scope.frameworks;
  if (frameworks.length === 0) return [];

  // If more frameworks than agents, group them
  const agentCount = Math.min(frameworks.length, maxAgents);
  const buckets: string[][] = Array.from({ length: agentCount }, () => []);

  for (let i = 0; i < frameworks.length; i++) {
    const bucket = i % agentCount;
    buckets[bucket].push(frameworks[i]);
  }

  return buckets.map((agentFrameworks, idx) => {
    const agentId = `agent-${randomUUID().slice(0, 8)}`;
    const agentName = `agent-fw-${idx + 1}`;
    const agentScope: AuditScope = {
      name: `${scope.name} (${agentName})`,
      frameworks: agentFrameworks,
      evidencePaths: [...scope.evidencePaths],
      formats: scope.formats ? [...scope.formats] : undefined,
      excludeControls: scope.excludeControls ? [...scope.excludeControls] : undefined,
    };

    return {
      id: agentId,
      name: agentName,
      scope: agentScope,
      status: "pending" as const,
    };
  });
}

/**
 * by-domain: Split files by filename patterns (network, identity, data, infra).
 * Files that don't match any pattern go to a "general" agent.
 */
function splitByDomain(scope: AuditScope, maxAgents: number): AuditAgent[] {
  const paths = scope.evidencePaths;
  if (paths.length === 0) return [];

  const domainBuckets: Record<string, string[]> = {};
  const unmatched: string[] = [];

  for (const path of paths) {
    const filename = path.split("/").pop() ?? path;
    let matched = false;

    for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
      if (pattern.test(filename)) {
        if (!domainBuckets[domain]) domainBuckets[domain] = [];
        domainBuckets[domain].push(path);
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmatched.push(path);
    }
  }

  // Add unmatched to a "general" bucket
  if (unmatched.length > 0) {
    domainBuckets["general"] = unmatched;
  }

  const domainNames = Object.keys(domainBuckets);
  const agentCount = Math.min(domainNames.length, maxAgents);

  // If too many domains, merge some
  if (domainNames.length > agentCount) {
    // Merge smallest buckets into the largest
    const sorted = domainNames.sort(
      (a, b) => domainBuckets[b].length - domainBuckets[a].length,
    );
    const kept = sorted.slice(0, agentCount);
    const merged = sorted.slice(agentCount);

    for (const m of merged) {
      // Add to the last kept bucket
      const target = kept[kept.length - 1];
      domainBuckets[target].push(...domainBuckets[m]);
      delete domainBuckets[m];
    }
  }

  const finalDomains = Object.keys(domainBuckets);
  return finalDomains.map((domain, idx) => {
    const agentId = `agent-${randomUUID().slice(0, 8)}`;
    const agentName = `agent-${domain}`;
    const agentScope: AuditScope = {
      name: `${scope.name} (${agentName})`,
      frameworks: [...scope.frameworks],
      evidencePaths: domainBuckets[domain],
      excludeControls: scope.excludeControls ? [...scope.excludeControls] : undefined,
    };

    return {
      id: agentId,
      name: agentName,
      scope: agentScope,
      status: "pending" as const,
    };
  });
}

// =============================================================================
// 2. EXECUTE PARALLEL
// =============================================================================

/**
 * Run all agents concurrently using Promise.allSettled().
 *
 * Each agent calls runAudit() with its assigned scope.
 * Tracks timing per agent and handles failures gracefully.
 */
export async function executeParallel(
  plan: OrchestrationPlan,
  auditConfig?: Partial<AuditConfig>,
): Promise<MergedAuditResult> {
  const startedAt = new Date();
  const mergedAuditConfig = { ...DEFAULT_AUDIT_CONFIG, ...auditConfig };

  if (plan.agents.length === 0) {
    return emptyMergedResult(plan, startedAt);
  }

  // Check failFast from plan's orchestrator config
  const orchestratorConfig = plan.orchestratorConfig;

  // Launch all agents in parallel
  const agentPromises = plan.agents.map(async (agent) => {
    agent.status = "running";
    agent.startedAt = new Date().toISOString();

    try {
      const result = await runAudit(agent.scope, mergedAuditConfig);
      agent.status = "completed";
      agent.completedAt = new Date().toISOString();
      agent.result = result;
      return { agent, success: true as const };
    } catch (err) {
      agent.status = "failed";
      agent.completedAt = new Date().toISOString();
      agent.error = err instanceof Error ? err.message : String(err);
      return { agent, success: false as const, error: err };
    }
  });

  if (orchestratorConfig.failFast) {
    // With failFast, we throw on the first failure
    const results = await Promise.allSettled(agentPromises);
    for (const result of results) {
      if (result.status === "fulfilled" && !result.value.success) {
        throw new Error(
          `Agent ${result.value.agent.name} failed: ${result.value.agent.error}`,
        );
      }
      if (result.status === "rejected") {
        throw result.reason;
      }
    }
  } else {
    // Without failFast, we let all agents complete
    await Promise.allSettled(agentPromises);
  }

  return mergeResults(plan, startedAt);
}

// =============================================================================
// 3. MERGE RESULTS
// =============================================================================

/**
 * Combine results from all completed agents into a single MergedAuditResult.
 *
 * - Sums control counts across agents
 * - Deduplicates findings by controlId (keeps highest severity)
 * - Calculates composite score (weighted average by control count)
 * - Calculates parallel speedup ratio
 * - Determines overall grade from composite score
 */
export function mergeResults(
  plan: OrchestrationPlan,
  startedAt?: Date,
): MergedAuditResult {
  const effectiveStartedAt = startedAt ?? new Date();
  const completedAgents = plan.agents.filter(a => a.status === "completed" && a.result);
  const failedAgents = plan.agents.filter(a => a.status === "failed");

  if (completedAgents.length === 0) {
    return emptyMergedResult(plan, effectiveStartedAt);
  }

  // Sum control counts
  let totalControls = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const agent of completedAgents) {
    const summary = agent.result!.summary;
    totalControls += summary.totalControls;
    totalPassed += summary.passed;
    totalFailed += summary.failed;
    totalSkipped += summary.skipped;
  }

  // Deduplicate findings
  const allFindings: AuditFinding[] = [];
  for (const agent of completedAgents) {
    allFindings.push(...agent.result!.findings);
  }
  const deduped = deduplicateFindings(allFindings);

  // Calculate composite score (weighted average by control count)
  let compositeScore = 0;
  if (totalControls > 0) {
    let weightedSum = 0;
    for (const agent of completedAgents) {
      const agentControls = agent.result!.summary.totalControls;
      const agentScore = agent.result!.summary.score;
      weightedSum += agentScore * agentControls;
    }
    compositeScore = Math.round(weightedSum / totalControls);
  }

  // Agent scores
  const agentScores = completedAgents.map(agent => ({
    agentId: agent.id,
    agentName: agent.name,
    score: agent.result!.summary.score,
    grade: agent.result!.summary.grade,
  }));

  // Timing
  const completedAt = new Date();
  const totalDuration = completedAt.getTime() - effectiveStartedAt.getTime();

  // Calculate sequential time (sum of all agent durations)
  let sequentialTime = 0;
  for (const agent of completedAgents) {
    sequentialTime += agent.result!.duration;
  }
  const parallelSpeedup = totalDuration > 0
    ? Math.round((sequentialTime / totalDuration) * 100) / 100
    : 1.0;

  // Finding counts
  const criticalFindings = deduped.filter(f => f.severity === "critical").length;
  const highFindings = deduped.filter(f => f.severity === "high").length;

  return {
    id: `merged-${randomUUID()}`,
    planId: plan.id,
    scope: plan.originalScope,
    agentCount: plan.agents.length,
    agentsCompleted: completedAgents.length,
    agentsFailed: failedAgents.length,
    totalControls,
    totalPassed,
    totalFailed,
    totalSkipped,
    compositeScore,
    agentScores,
    findings: deduped,
    criticalFindings,
    highFindings,
    startedAt: effectiveStartedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalDuration,
    parallelSpeedup: Math.max(1.0, parallelSpeedup),
    overallGrade: computeGrade(compositeScore),
  };
}

// =============================================================================
// 4. FORMAT ORCHESTRATION REPORT
// =============================================================================

/**
 * Format a MergedAuditResult as a human-readable multi-agent audit report.
 */
export function formatOrchestrationReport(result: MergedAuditResult): string {
  const lines: string[] = [];

  lines.push("CORSAIR MULTI-AGENT AUDIT REPORT");
  lines.push("=".repeat(50));
  lines.push(`Scope: ${result.scope.name}`);
  lines.push(`Strategy: ${inferStrategy(result)} (${result.agentCount} agents)`);
  lines.push(
    `Duration: ${(result.totalDuration / 1000).toFixed(1)}s ` +
    `(${result.parallelSpeedup.toFixed(1)}x speedup)`,
  );
  lines.push("");

  // Agent results
  lines.push("AGENT RESULTS:");
  for (const agentScore of result.agentScores) {
    const status = "ok";
    lines.push(
      `  ${status}  ${agentScore.agentName.padEnd(16)} ` +
      `${String(agentScore.score).padStart(3)}/100 (${agentScore.grade})`,
    );
  }
  if (result.agentsFailed > 0) {
    lines.push(`  FAILED: ${result.agentsFailed} agent(s)`);
  }
  lines.push("");

  // Composite
  lines.push(`COMPOSITE: ${result.compositeScore}/100 (${result.overallGrade})`);
  lines.push(
    `Controls: ${result.totalControls} total, ` +
    `${result.totalPassed} passed, ` +
    `${result.totalFailed} failed, ` +
    `${result.totalSkipped} skipped`,
  );
  lines.push(
    `Findings: ${result.criticalFindings} critical, ` +
    `${result.highFindings} high, ` +
    `${result.findings.filter(f => f.severity === "medium").length} medium`,
  );

  return lines.join("\n");
}

// =============================================================================
// 5. RUN ORCHESTRATED (convenience)
// =============================================================================

/**
 * Convenience method: plan + execute + merge in one call.
 */
export async function runOrchestrated(
  scope: AuditScope,
  orchestratorConfig?: Partial<OrchestratorConfig>,
  auditConfig?: Partial<AuditConfig>,
): Promise<MergedAuditResult> {
  const plan = planAudit(scope, orchestratorConfig);
  return executeParallel(plan, auditConfig);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Deduplicate findings by controlId, keeping the highest severity.
 */
function deduplicateFindings(findings: AuditFinding[]): AuditFinding[] {
  const byControlId = new Map<string, AuditFinding>();

  for (const finding of findings) {
    const key = `${finding.controlId}:${finding.category}`;
    const existing = byControlId.get(key);

    if (!existing) {
      byControlId.set(key, finding);
    } else {
      // Keep the one with higher severity (lower number = higher severity)
      const existingOrder = SEVERITY_ORDER[existing.severity] ?? 4;
      const newOrder = SEVERITY_ORDER[finding.severity] ?? 4;
      if (newOrder < existingOrder) {
        byControlId.set(key, finding);
      }
    }
  }

  // Sort by severity
  const deduped = Array.from(byControlId.values());
  deduped.sort((a, b) => {
    const aOrder = SEVERITY_ORDER[a.severity] ?? 4;
    const bOrder = SEVERITY_ORDER[b.severity] ?? 4;
    return aOrder - bOrder;
  });

  return deduped;
}

/**
 * Compute letter grade from score percentage.
 */
function computeGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Create an empty merged result (for zero-agent or zero-completed scenarios).
 */
function emptyMergedResult(plan: OrchestrationPlan, startedAt: Date): MergedAuditResult {
  const completedAt = new Date();
  return {
    id: `merged-${randomUUID()}`,
    planId: plan.id,
    scope: plan.originalScope,
    agentCount: plan.agents.length,
    agentsCompleted: 0,
    agentsFailed: 0,
    totalControls: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalSkipped: 0,
    compositeScore: 0,
    agentScores: [],
    findings: [],
    criticalFindings: 0,
    highFindings: 0,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalDuration: completedAt.getTime() - startedAt.getTime(),
    parallelSpeedup: 1.0,
    overallGrade: "F",
  };
}

/**
 * Infer the strategy used from the result's scope and agent data.
 */
function inferStrategy(result: MergedAuditResult): string {
  // Look at agent names for hints
  if (result.agentScores.some(a => a.agentName.includes("fw-"))) return "by-framework";
  if (result.agentScores.some(a =>
    a.agentName.includes("network") ||
    a.agentName.includes("identity") ||
    a.agentName.includes("data") ||
    a.agentName.includes("infra")
  )) return "by-domain";
  return "by-file";
}
