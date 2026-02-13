/**
 * Orchestrator Tests — Multi-Agent Audit Coordination
 *
 * TDD: These tests are written FIRST. They must FAIL before implementation.
 * Then implementation makes them green.
 *
 * Covers:
 *   - planAudit() work splitting (by-file, by-framework, by-domain)
 *   - executeParallel() concurrent execution + failure handling
 *   - mergeResults() control aggregation, deduplication, scoring
 *   - formatOrchestrationReport() human-readable output
 *   - runOrchestrated() end-to-end convenience method
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  planAudit,
  executeParallel,
  mergeResults,
  formatOrchestrationReport,
  runOrchestrated,
} from "../../src/audit/orchestrator";
import type {
  OrchestrationPlan,
  OrchestratorConfig,
  MergedAuditResult,
  AuditAgent,
} from "../../src/audit/orchestrator-types";
import type { AuditScope, AuditConfig } from "../../src/audit/types";

// =============================================================================
// TEST EVIDENCE DATA — Minimal generic format JSON
// =============================================================================

const NETWORK_EVIDENCE = {
  metadata: {
    title: "Network Controls",
    issuer: "TestTool v1",
    date: new Date().toISOString().split("T")[0],
    scope: "Network",
  },
  controls: [
    { id: "NET-1", description: "Firewall rules", status: "effective", severity: "high", evidence: "WAF deployed" },
    { id: "NET-2", description: "Network segmentation", status: "effective", severity: "critical", evidence: "VPC isolation" },
    { id: "NET-3", description: "DDoS protection", status: "ineffective", severity: "high", evidence: "No DDoS protection" },
  ],
};

const IDENTITY_EVIDENCE = {
  metadata: {
    title: "Identity Controls",
    issuer: "TestTool v1",
    date: new Date().toISOString().split("T")[0],
    scope: "Identity",
  },
  controls: [
    { id: "ID-1", description: "MFA enforcement", status: "effective", severity: "critical", evidence: "MFA enabled" },
    { id: "ID-2", description: "Password policy", status: "effective", severity: "high", evidence: "Strong policy" },
    { id: "ID-3", description: "Access reviews", status: "ineffective", severity: "medium", evidence: "Overdue" },
  ],
};

const DATA_EVIDENCE = {
  metadata: {
    title: "Data Controls",
    issuer: "TestTool v1",
    date: new Date().toISOString().split("T")[0],
    scope: "Data",
  },
  controls: [
    { id: "DATA-1", description: "Encryption at rest", status: "effective", severity: "high", evidence: "AES-256" },
    { id: "DATA-2", description: "Encryption in transit", status: "effective", severity: "high", evidence: "TLS 1.3" },
  ],
};

const INFRA_EVIDENCE = {
  metadata: {
    title: "Infrastructure Controls",
    issuer: "TestTool v1",
    date: new Date().toISOString().split("T")[0],
    scope: "Infrastructure",
  },
  controls: [
    { id: "INFRA-1", description: "Patch management", status: "effective", severity: "medium", evidence: "Auto-patching" },
    { id: "INFRA-2", description: "Backup policy", status: "ineffective", severity: "high", evidence: "No backups" },
  ],
};

// Evidence with duplicate control IDs (for dedup testing)
const OVERLAP_EVIDENCE = {
  metadata: {
    title: "Overlap Controls",
    issuer: "TestTool v2",
    date: new Date().toISOString().split("T")[0],
    scope: "Overlap",
  },
  controls: [
    { id: "NET-3", description: "DDoS protection", status: "ineffective", severity: "critical", evidence: "Critical: no DDoS" },
    { id: "EXTRA-1", description: "Extra control", status: "effective", severity: "low", evidence: "OK" },
  ],
};

// =============================================================================
// TEMP FILE HELPERS
// =============================================================================

const tmpDir = `/tmp/corsair-orchestrator-test-${Date.now()}`;

beforeAll(async () => {
  await Bun.write(`${tmpDir}/network.json`, JSON.stringify(NETWORK_EVIDENCE));
  await Bun.write(`${tmpDir}/identity.json`, JSON.stringify(IDENTITY_EVIDENCE));
  await Bun.write(`${tmpDir}/data.json`, JSON.stringify(DATA_EVIDENCE));
  await Bun.write(`${tmpDir}/infra.json`, JSON.stringify(INFRA_EVIDENCE));
  await Bun.write(`${tmpDir}/overlap.json`, JSON.stringify(OVERLAP_EVIDENCE));
});

afterAll(async () => {
  const { rm } = await import("fs/promises");
  await rm(tmpDir, { recursive: true, force: true });
});

// =============================================================================
// HELPERS
// =============================================================================

function makeScope(overrides: Partial<AuditScope> = {}): AuditScope {
  return {
    name: overrides.name ?? "Test Orchestration",
    frameworks: overrides.frameworks ?? ["SOC2"],
    evidencePaths: overrides.evidencePaths ?? [
      `${tmpDir}/network.json`,
      `${tmpDir}/identity.json`,
      `${tmpDir}/data.json`,
      `${tmpDir}/infra.json`,
    ],
    formats: overrides.formats,
    excludeControls: overrides.excludeControls,
  };
}

function makeOrchestratorConfig(overrides: Partial<OrchestratorConfig> = {}): Partial<OrchestratorConfig> {
  return {
    maxAgents: overrides.maxAgents ?? 4,
    strategy: overrides.strategy ?? "by-file",
    failFast: overrides.failFast ?? false,
    mergeStrategy: overrides.mergeStrategy ?? "union",
  };
}

// =============================================================================
// 1. planAudit() — PLANNING / WORK SPLITTING
// =============================================================================

describe("planAudit", () => {
  test("should split files evenly across agents with by-file strategy", () => {
    const scope = makeScope();
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 4 });

    expect(plan.agents.length).toBe(4);
    // Each agent should get exactly 1 file (4 files / 4 agents)
    for (const agent of plan.agents) {
      expect(agent.scope.evidencePaths.length).toBe(1);
    }
  });

  test("should handle fewer files than agents with by-file strategy", () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 4 });

    // Only 2 files, so only 2 agents (not 4)
    expect(plan.agents.length).toBe(2);
    for (const agent of plan.agents) {
      expect(agent.scope.evidencePaths.length).toBe(1);
    }
  });

  test("should create one agent per framework with by-framework strategy", () => {
    const scope = makeScope({
      frameworks: ["SOC2", "NIST-800-53", "ISO27001"],
    });
    const plan = planAudit(scope, { strategy: "by-framework", maxAgents: 4 });

    expect(plan.agents.length).toBe(3);
    // Each agent should handle a different framework
    const frameworks = plan.agents.map(a => a.scope.frameworks);
    expect(frameworks[0]).toEqual(["SOC2"]);
    expect(frameworks[1]).toEqual(["NIST-800-53"]);
    expect(frameworks[2]).toEqual(["ISO27001"]);
  });

  test("should split by domain patterns with by-domain strategy", () => {
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/network.json`,
        `${tmpDir}/identity.json`,
        `${tmpDir}/data.json`,
        `${tmpDir}/infra.json`,
      ],
    });
    const plan = planAudit(scope, { strategy: "by-domain", maxAgents: 4 });

    expect(plan.agents.length).toBeGreaterThan(0);
    expect(plan.agents.length).toBeLessThanOrEqual(4);
    // Each agent should have at least one evidence path
    for (const agent of plan.agents) {
      expect(agent.scope.evidencePaths.length).toBeGreaterThan(0);
    }
  });

  test("should respect maxAgents limit", () => {
    const scope = makeScope();
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });

    expect(plan.agents.length).toBeLessThanOrEqual(2);
    // 4 files across 2 agents = 2 files each
    const totalFiles = plan.agents.reduce((sum, a) => sum + a.scope.evidencePaths.length, 0);
    expect(totalFiles).toBe(4);
  });

  test("should assign unique agent IDs and names", () => {
    const scope = makeScope();
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 4 });

    const ids = plan.agents.map(a => a.id);
    const names = plan.agents.map(a => a.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  test("should give each agent a subset of the original scope", () => {
    const scope = makeScope();
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 4 });

    // All agent evidence paths should be subsets of the original
    const originalPaths = new Set(scope.evidencePaths);
    for (const agent of plan.agents) {
      for (const path of agent.scope.evidencePaths) {
        expect(originalPaths.has(path)).toBe(true);
      }
    }
  });

  test("should default strategy to by-file", () => {
    const scope = makeScope();
    const plan = planAudit(scope);

    expect(plan.strategy).toBe("by-file");
  });

  test("should default maxAgents to 4", () => {
    // With 8 files, default maxAgents=4 should cap at 4 agents
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/network.json`,
        `${tmpDir}/identity.json`,
        `${tmpDir}/data.json`,
        `${tmpDir}/infra.json`,
        `${tmpDir}/network.json`,
        `${tmpDir}/identity.json`,
        `${tmpDir}/data.json`,
        `${tmpDir}/infra.json`,
      ],
    });
    const plan = planAudit(scope);

    expect(plan.agents.length).toBeLessThanOrEqual(4);
  });

  test("should preserve original scope in plan", () => {
    const scope = makeScope({ name: "Production Audit" });
    const plan = planAudit(scope, { strategy: "by-file" });

    expect(plan.originalScope).toEqual(scope);
  });

  test("should set all agents to pending status", () => {
    const scope = makeScope();
    const plan = planAudit(scope, { strategy: "by-file" });

    for (const agent of plan.agents) {
      expect(agent.status).toBe("pending");
    }
  });

  test("should generate a plan ID", () => {
    const scope = makeScope();
    const plan = planAudit(scope);

    expect(plan.id).toBeTruthy();
    expect(plan.id.length).toBeGreaterThan(0);
  });

  test("should set createdAt timestamp", () => {
    const scope = makeScope();
    const plan = planAudit(scope);

    expect(plan.createdAt).toBeTruthy();
    // Should be a valid ISO date
    expect(new Date(plan.createdAt).getTime()).not.toBeNaN();
  });

  test("should propagate scope name and frameworks to agents", () => {
    const scope = makeScope({ name: "AWS Audit", frameworks: ["SOC2", "NIST-800-53"] });
    const plan = planAudit(scope, { strategy: "by-file" });

    for (const agent of plan.agents) {
      expect(agent.scope.name).toContain("AWS Audit");
      expect(agent.scope.frameworks).toEqual(["SOC2", "NIST-800-53"]);
    }
  });

  test("should limit by-framework agents to maxAgents", () => {
    const scope = makeScope({
      frameworks: ["SOC2", "NIST-800-53", "ISO27001", "CIS", "PCI-DSS", "HIPAA"],
    });
    const plan = planAudit(scope, { strategy: "by-framework", maxAgents: 3 });

    expect(plan.agents.length).toBeLessThanOrEqual(3);
  });
});

// =============================================================================
// 2. executeParallel() — CONCURRENT EXECUTION
// =============================================================================

describe("executeParallel", () => {
  test("should run all agents in parallel and return merged result", async () => {
    const scope = makeScope();
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 4 });
    const result = await executeParallel(plan);

    expect(result).toBeDefined();
    expect(result.agentCount).toBe(4);
    expect(result.agentsCompleted).toBe(4);
    expect(result.agentsFailed).toBe(0);
  });

  test("should work with a single agent", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 1 });
    const result = await executeParallel(plan);

    expect(result.agentCount).toBe(1);
    expect(result.agentsCompleted).toBe(1);
    expect(result.totalControls).toBe(3); // network has 3 controls
  });

  test("should handle agent failure gracefully when failFast is false", async () => {
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/network.json`,
        `${tmpDir}/nonexistent-file.json`,  // This will fail
        `${tmpDir}/identity.json`,
      ],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 3, failFast: false });
    const result = await executeParallel(plan);

    // Should complete with partial results
    expect(result.agentsFailed).toBe(1);
    expect(result.agentsCompleted).toBe(2);
    // Should still have results from successful agents
    expect(result.totalControls).toBeGreaterThan(0);
  });

  test("should throw on first failure when failFast is true", async () => {
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/nonexistent-file.json`,  // This will fail
        `${tmpDir}/network.json`,
      ],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2, failFast: true });

    await expect(executeParallel(plan)).rejects.toThrow();
  });

  test("should track timing per agent", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    const result = await executeParallel(plan);

    expect(result.startedAt).toBeTruthy();
    expect(result.completedAt).toBeTruthy();
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });

  test("should set all successful agents to completed status", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);

    for (const agent of plan.agents) {
      expect(agent.status).toBe("completed");
      expect(agent.result).toBeDefined();
      expect(agent.startedAt).toBeTruthy();
      expect(agent.completedAt).toBeTruthy();
    }
  });

  test("should set failed agent status with error message", async () => {
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/network.json`,
        `${tmpDir}/nonexistent-file.json`,
      ],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2, failFast: false });
    await executeParallel(plan);

    const failedAgent = plan.agents.find(a => a.status === "failed");
    expect(failedAgent).toBeDefined();
    expect(failedAgent!.error).toBeTruthy();
  });

  test("should pass audit config to agents", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 1 });
    const auditConfig: Partial<AuditConfig> = { generateFindings: false, includeScore: false };
    const result = await executeParallel(plan, auditConfig);

    // With generateFindings=false, should have no findings
    expect(result.findings.length).toBe(0);
  });
});

// =============================================================================
// 3. mergeResults() — RESULT MERGING
// =============================================================================

describe("mergeResults", () => {
  test("should sum control counts correctly", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    // network: 3 controls, identity: 3 controls
    expect(merged.totalControls).toBe(6);
  });

  test("should deduplicate findings by controlId", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/overlap.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    // NET-3 appears in both files — should be deduplicated
    const net3Findings = merged.findings.filter(f => f.controlId === "NET-3");
    expect(net3Findings.length).toBe(1);
  });

  test("should keep highest severity on duplicate findings", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/overlap.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    // NET-3 in network.json is "high", in overlap.json is "critical" — keep critical
    const net3Finding = merged.findings.find(f => f.controlId === "NET-3");
    expect(net3Finding).toBeDefined();
    expect(net3Finding!.severity).toBe("critical");
  });

  test("should calculate composite score as weighted average", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/data.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    expect(merged.compositeScore).toBeGreaterThanOrEqual(0);
    expect(merged.compositeScore).toBeLessThanOrEqual(100);
  });

  test("should derive overall grade from composite score", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/data.json`], // All passing
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 1 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    // All 2 data controls pass — 100% → A
    expect(merged.overallGrade).toBe("A");
  });

  test("should calculate parallel speedup ratio", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    // Speedup should be >= 1.0 (parallel is at least as fast as sequential)
    expect(merged.parallelSpeedup).toBeGreaterThanOrEqual(1.0);
  });

  test("should preserve agent scores in result", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    expect(merged.agentScores.length).toBe(2);
    for (const agentScore of merged.agentScores) {
      expect(agentScore.agentId).toBeTruthy();
      expect(agentScore.agentName).toBeTruthy();
      expect(agentScore.score).toBeGreaterThanOrEqual(0);
      expect(agentScore.grade).toBeTruthy();
    }
  });

  test("should count critical and high findings accurately", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    const actualCritical = merged.findings.filter(f => f.severity === "critical").length;
    const actualHigh = merged.findings.filter(f => f.severity === "high").length;

    expect(merged.criticalFindings).toBe(actualCritical);
    expect(merged.highFindings).toBe(actualHigh);
  });

  test("should count passed, failed, skipped correctly", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 1 });
    await executeParallel(plan);
    const merged = mergeResults(plan);

    // network: NET-1 pass, NET-2 pass, NET-3 fail
    expect(merged.totalPassed).toBe(2);
    expect(merged.totalFailed).toBe(1);
    expect(merged.totalControls).toBe(3);
  });

  test("should handle merge with zero completed agents gracefully", () => {
    const scope = makeScope();
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 4 });
    // Don't execute — all agents still pending
    const merged = mergeResults(plan);

    expect(merged.totalControls).toBe(0);
    expect(merged.agentsCompleted).toBe(0);
    expect(merged.findings.length).toBe(0);
    expect(merged.compositeScore).toBe(0);
    expect(merged.overallGrade).toBe("F");
  });
});

// =============================================================================
// 4. formatOrchestrationReport() — REPORT FORMATTING
// =============================================================================

describe("formatOrchestrationReport", () => {
  test("should include scope and strategy in header", async () => {
    const scope = makeScope({ name: "AWS Production" });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);
    const report = formatOrchestrationReport(merged);

    expect(report).toContain("AWS Production");
    expect(report).toContain("by-file");
  });

  test("should show all agent results", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);
    const report = formatOrchestrationReport(merged);

    // Should list each agent
    for (const agentScore of merged.agentScores) {
      expect(report).toContain(agentScore.agentName);
    }
  });

  test("should show composite score and grade", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/data.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 1 });
    await executeParallel(plan);
    const merged = mergeResults(plan);
    const report = formatOrchestrationReport(merged);

    expect(report).toContain(String(merged.compositeScore));
    expect(report).toContain(merged.overallGrade);
  });

  test("should show speedup ratio", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);
    const report = formatOrchestrationReport(merged);

    expect(report).toContain("speedup");
  });

  test("should show finding summary", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);
    const report = formatOrchestrationReport(merged);

    expect(report).toContain("Controls:");
    expect(report).toContain("Findings:");
  });

  test("should include CORSAIR MULTI-AGENT AUDIT REPORT header", async () => {
    const scope = makeScope();
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });
    await executeParallel(plan);
    const merged = mergeResults(plan);
    const report = formatOrchestrationReport(merged);

    expect(report).toContain("CORSAIR MULTI-AGENT AUDIT REPORT");
  });
});

// =============================================================================
// 5. runOrchestrated() — END-TO-END CONVENIENCE
// =============================================================================

describe("runOrchestrated", () => {
  test("should run end-to-end with synthetic evidence", async () => {
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/network.json`,
        `${tmpDir}/identity.json`,
        `${tmpDir}/data.json`,
        `${tmpDir}/infra.json`,
      ],
    });
    const result = await runOrchestrated(scope);

    expect(result).toBeDefined();
    expect(result.agentCount).toBeGreaterThan(0);
    expect(result.totalControls).toBe(10); // 3 + 3 + 2 + 2
  });

  test("should run with multiple formats", async () => {
    // All files are generic format — should work fine
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/data.json`],
    });
    const result = await runOrchestrated(scope);

    expect(result.totalControls).toBe(5); // 3 + 2
    expect(result.agentsCompleted).toBeGreaterThan(0);
  });

  test("should handle empty evidence paths gracefully", async () => {
    const scope = makeScope({ evidencePaths: [] });
    const result = await runOrchestrated(scope);

    expect(result.agentCount).toBe(0);
    expect(result.totalControls).toBe(0);
    expect(result.compositeScore).toBe(0);
    expect(result.overallGrade).toBe("F");
  });

  test("should accept orchestrator config", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`, `${tmpDir}/identity.json`],
    });
    const result = await runOrchestrated(scope, { strategy: "by-file", maxAgents: 1 });

    // With maxAgents=1, single agent gets all files
    expect(result.agentCount).toBe(1);
    expect(result.totalControls).toBe(6);
  });

  test("should accept audit config", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`],
    });
    const result = await runOrchestrated(scope, undefined, { generateFindings: false });

    expect(result.findings.length).toBe(0);
  });

  test("should compute overall results correctly with 4 agents", async () => {
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/network.json`,
        `${tmpDir}/identity.json`,
        `${tmpDir}/data.json`,
        `${tmpDir}/infra.json`,
      ],
    });
    const result = await runOrchestrated(scope, { strategy: "by-file", maxAgents: 4 });

    expect(result.agentCount).toBe(4);
    expect(result.agentsCompleted).toBe(4);
    expect(result.agentsFailed).toBe(0);
    expect(result.totalControls).toBe(10);
    // Verify we have some findings from the mixed results
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// 6. EDGE CASES
// =============================================================================

describe("Edge Cases", () => {
  test("should handle single file with by-file strategy", () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/network.json`],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 4 });

    expect(plan.agents.length).toBe(1);
    expect(plan.agents[0].scope.evidencePaths.length).toBe(1);
  });

  test("should handle single framework with by-framework strategy", () => {
    const scope = makeScope({
      frameworks: ["SOC2"],
    });
    const plan = planAudit(scope, { strategy: "by-framework", maxAgents: 4 });

    expect(plan.agents.length).toBe(1);
    expect(plan.agents[0].scope.frameworks).toEqual(["SOC2"]);
  });

  test("should round-robin files when more files than agents", () => {
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/network.json`,
        `${tmpDir}/identity.json`,
        `${tmpDir}/data.json`,
        `${tmpDir}/infra.json`,
        `${tmpDir}/overlap.json`,
      ],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 2 });

    expect(plan.agents.length).toBe(2);
    const totalFiles = plan.agents.reduce((sum, a) => sum + a.scope.evidencePaths.length, 0);
    expect(totalFiles).toBe(5); // All files distributed
  });

  test("should propagate excludeControls to all agents", () => {
    const scope = makeScope({
      excludeControls: ["NET-1", "ID-1"],
    });
    const plan = planAudit(scope, { strategy: "by-file", maxAgents: 4 });

    for (const agent of plan.agents) {
      expect(agent.scope.excludeControls).toEqual(["NET-1", "ID-1"]);
    }
  });
});
