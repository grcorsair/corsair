/**
 * Phase 3.3: MARK Parallelization Tests
 *
 * Tests for parallel MARK (drift detection) execution:
 * - One MARK agent per resource
 * - ISC criteria distribution by resource type
 * - Finding aggregation
 * - ISC satisfaction tracking
 * - Evidence linking
 *
 * 10 test cases validating parallel drift detection.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { CorsairCoordinator } from "../../src/agents/coordinator-agent";
import { ISCDistributor } from "../../src/core/isc-distributor";
import type {
  AgentDriftFindings,
  ISCDistribution,
} from "../../src/types/coordination";
import type { ISCCriterion } from "../../src/types/isc";
import type { DriftFinding } from "../../src/types";

// Test fixtures directory
const TEST_WORK_DIR = "./tests/fixtures/mark-parallel-test-work";

describe("Phase 3.3: MARK Parallelization", () => {
  let coordinator: CorsairCoordinator;
  let distributor: ISCDistributor;

  beforeEach(() => {
    if (fs.existsSync(TEST_WORK_DIR)) {
      fs.rmSync(TEST_WORK_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_WORK_DIR, { recursive: true });

    coordinator = new CorsairCoordinator({
      workDir: TEST_WORK_DIR,
      maxReconAgents: 4,
      agentTimeoutMs: 5000,
      pollIntervalMs: 100,
      verbose: false,
    });

    distributor = new ISCDistributor();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_WORK_DIR)) {
      fs.rmSync(TEST_WORK_DIR, { recursive: true });
    }
  });

  test("spawns one MARK agent per resource", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const resources = ["bucket-1", "bucket-2", "bucket-3"];
    const agentIds = await coordinator.spawnAgents("MARK", resources.length);

    expect(agentIds.length).toBe(3);

    // Verify all are MARK type
    const state = coordinator.getState();
    for (const agent of state.agents) {
      expect(agent.type).toBe("MARK");
    }

    // Verify naming: mark-agent-0, mark-agent-1, mark-agent-2
    expect(agentIds[0]).toBe("mark-agent-0");
    expect(agentIds[1]).toBe("mark-agent-1");
    expect(agentIds[2]).toBe("mark-agent-2");
  });

  test("distributes ISC criteria by resource type", () => {
    const criteria: ISCCriterion[] = [
      { id: "ISC-1", text: "Public access blocked at bucket level", satisfaction: "PENDING", evidenceRefs: [], createdAt: new Date().toISOString() },
      { id: "ISC-2", text: "Encryption enabled using AES256 algorithm", satisfaction: "PENDING", evidenceRefs: [], createdAt: new Date().toISOString() },
      { id: "ISC-3", text: "MFA required for user authentication", satisfaction: "PENDING", evidenceRefs: [], createdAt: new Date().toISOString() },
      { id: "ISC-4", text: "Versioning enabled for data protection", satisfaction: "PENDING", evidenceRefs: [], createdAt: new Date().toISOString() },
    ];

    // S3 bucket should get S3-related criteria
    const s3Distribution = distributor.distributeByResourceType(criteria, "my-bucket", "s3");
    // Cognito should get auth-related criteria
    const cognitoDistribution = distributor.distributeByResourceType(criteria, "user-pool", "cognito");

    // S3 criteria should include bucket, encryption, versioning keywords
    expect(s3Distribution.criteria.length).toBeGreaterThanOrEqual(2);
    expect(s3Distribution.criteria.some(c => c.text.toLowerCase().includes("bucket"))).toBe(true);
    expect(s3Distribution.criteria.some(c => c.text.toLowerCase().includes("encryption"))).toBe(true);

    // Cognito criteria should include MFA, authentication keywords
    expect(cognitoDistribution.criteria.length).toBeGreaterThanOrEqual(1);
    expect(cognitoDistribution.criteria.some(c => c.text.toLowerCase().includes("mfa"))).toBe(true);
  });

  test("aggregates drift findings from all agents", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 2);
    const missionPath = coordinator.getMissionPath();

    // Create mock drift findings for each agent
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const findings: DriftFinding[] = [
        {
          id: `drift-${i}-1`,
          field: `field-${i}`,
          expected: "secure",
          actual: "insecure",
          drift: true,
          severity: "HIGH",
          description: `Drift found in field-${i}`,
          timestamp: new Date().toISOString(),
        },
      ];

      const agentFindings: AgentDriftFindings = {
        agentId,
        resourceId: `bucket-${i}`,
        findings,
        evaluatedCriteria: [],
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "drift-findings.json"),
        JSON.stringify(agentFindings, null, 2)
      );

      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const results = await coordinator.aggregateMarkResults(agentIds);

    expect(results.findings.length).toBe(2);
    expect(results.agentCount).toBe(2);
    expect(results.totalResources).toBe(2);
  });

  test("updates master ISC from agent findings", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 1);
    const missionPath = coordinator.getMissionPath();
    const agentId = agentIds[0];
    const agentDir = path.join(missionPath, "agents", agentId);

    // Create criteria with satisfaction updates
    const evaluatedCriteria: ISCCriterion[] = [
      { id: "ISC-1", text: "Public access blocked at bucket level", satisfaction: "SATISFIED", evidenceRefs: ["drift-1"], createdAt: new Date().toISOString(), verifiedAt: new Date().toISOString() },
      { id: "ISC-2", text: "Encryption enabled using AES256 algorithm", satisfaction: "FAILED", evidenceRefs: ["drift-2"], createdAt: new Date().toISOString(), verifiedAt: new Date().toISOString() },
    ];

    const agentFindings: AgentDriftFindings = {
      agentId,
      resourceId: "my-bucket",
      findings: [],
      evaluatedCriteria,
      completedAt: new Date().toISOString(),
      durationMs: 100,
    };

    fs.writeFileSync(
      path.join(agentDir, "drift-findings.json"),
      JSON.stringify(agentFindings, null, 2)
    );

    await coordinator.updateAgentStatus(agentId, "COMPLETED");

    const results = await coordinator.aggregateMarkResults(agentIds);

    expect(results.evaluatedCriteria.length).toBe(2);

    const satisfied = results.evaluatedCriteria.filter(c => c.satisfaction === "SATISFIED");
    const failed = results.evaluatedCriteria.filter(c => c.satisfaction === "FAILED");

    expect(satisfied.length).toBe(1);
    expect(failed.length).toBe(1);
    expect(results.satisfactionRate).toBe(50); // 1/2 satisfied
  });

  test("links evidence to ISC criteria", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 1);
    const missionPath = coordinator.getMissionPath();
    const agentId = agentIds[0];
    const agentDir = path.join(missionPath, "agents", agentId);

    // Create finding that will serve as evidence
    const findings: DriftFinding[] = [
      {
        id: "drift-evidence-123",
        field: "publicAccessBlock",
        expected: true,
        actual: false,
        drift: true,
        severity: "CRITICAL",
        description: "Public access not blocked",
        timestamp: new Date().toISOString(),
      },
    ];

    // Link finding ID as evidence
    const evaluatedCriteria: ISCCriterion[] = [
      {
        id: "ISC-1",
        text: "Public access blocked at bucket level",
        satisfaction: "FAILED",
        evidenceRefs: ["drift-evidence-123"],
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
      },
    ];

    const agentFindings: AgentDriftFindings = {
      agentId,
      resourceId: "vulnerable-bucket",
      findings,
      evaluatedCriteria,
      completedAt: new Date().toISOString(),
      durationMs: 100,
    };

    fs.writeFileSync(
      path.join(agentDir, "drift-findings.json"),
      JSON.stringify(agentFindings, null, 2)
    );

    await coordinator.updateAgentStatus(agentId, "COMPLETED");

    const results = await coordinator.aggregateMarkResults(agentIds);

    // Evidence should be linked
    const criterion = results.evaluatedCriteria.find(c => c.id === "ISC-1");
    expect(criterion?.evidenceRefs).toContain("drift-evidence-123");
  });

  test("handles agents with no drift", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 2);
    const missionPath = coordinator.getMissionPath();

    // Agent 0: No drift
    const agentDir0 = path.join(missionPath, "agents", agentIds[0]);
    const noDriftFindings: AgentDriftFindings = {
      agentId: agentIds[0],
      resourceId: "secure-bucket",
      findings: [], // No drift
      evaluatedCriteria: [
        { id: "ISC-1", text: "Public access blocked", satisfaction: "SATISFIED", evidenceRefs: [], createdAt: new Date().toISOString() },
      ],
      completedAt: new Date().toISOString(),
      durationMs: 100,
    };
    fs.writeFileSync(
      path.join(agentDir0, "drift-findings.json"),
      JSON.stringify(noDriftFindings, null, 2)
    );
    await coordinator.updateAgentStatus(agentIds[0], "COMPLETED");

    // Agent 1: Has drift
    const agentDir1 = path.join(missionPath, "agents", agentIds[1]);
    const driftFindings: AgentDriftFindings = {
      agentId: agentIds[1],
      resourceId: "insecure-bucket",
      findings: [
        { id: "drift-1", field: "encryption", expected: "AES256", actual: null, drift: true, severity: "HIGH", description: "No encryption", timestamp: new Date().toISOString() },
      ],
      evaluatedCriteria: [
        { id: "ISC-2", text: "Encryption enabled", satisfaction: "FAILED", evidenceRefs: ["drift-1"], createdAt: new Date().toISOString() },
      ],
      completedAt: new Date().toISOString(),
      durationMs: 100,
    };
    fs.writeFileSync(
      path.join(agentDir1, "drift-findings.json"),
      JSON.stringify(driftFindings, null, 2)
    );
    await coordinator.updateAgentStatus(agentIds[1], "COMPLETED");

    const results = await coordinator.aggregateMarkResults(agentIds);

    expect(results.findings.length).toBe(1); // Only agent 1 had drift
    expect(results.evaluatedCriteria.length).toBe(2); // Both agents had criteria
    expect(results.satisfactionRate).toBe(50); // 1/2 satisfied
  });

  test("calculates satisfaction rate after parallel MARK", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 3);
    const missionPath = coordinator.getMissionPath();

    // Create mock results: 2 satisfied, 1 failed per agent = 6 satisfied, 3 failed
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const evaluatedCriteria: ISCCriterion[] = [
        { id: `ISC-${i}-1`, text: "Criterion 1", satisfaction: "SATISFIED", evidenceRefs: [], createdAt: new Date().toISOString() },
        { id: `ISC-${i}-2`, text: "Criterion 2", satisfaction: "SATISFIED", evidenceRefs: [], createdAt: new Date().toISOString() },
        { id: `ISC-${i}-3`, text: "Criterion 3", satisfaction: "FAILED", evidenceRefs: [], createdAt: new Date().toISOString() },
      ];

      const agentFindings: AgentDriftFindings = {
        agentId,
        resourceId: `bucket-${i}`,
        findings: [],
        evaluatedCriteria,
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "drift-findings.json"),
        JSON.stringify(agentFindings, null, 2)
      );

      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const results = await coordinator.aggregateMarkResults(agentIds);

    // 6 satisfied out of 9 total = 66.67%
    expect(results.evaluatedCriteria.length).toBe(9);
    expect(Math.round(results.satisfactionRate)).toBe(67);
  });

  test("MARK agents handle empty ISC criteria", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 1);
    const missionPath = coordinator.getMissionPath();
    const agentDir = path.join(missionPath, "agents", agentIds[0]);

    // Agent with no criteria to evaluate
    const agentFindings: AgentDriftFindings = {
      agentId: agentIds[0],
      resourceId: "unknown-bucket",
      findings: [],
      evaluatedCriteria: [], // Empty
      completedAt: new Date().toISOString(),
      durationMs: 50,
    };

    fs.writeFileSync(
      path.join(agentDir, "drift-findings.json"),
      JSON.stringify(agentFindings, null, 2)
    );

    await coordinator.updateAgentStatus(agentIds[0], "COMPLETED");

    const results = await coordinator.aggregateMarkResults(agentIds);

    expect(results.evaluatedCriteria.length).toBe(0);
    expect(results.satisfactionRate).toBe(0); // No criteria = 0%
  });

  test("handles duplicate criteria across agents gracefully", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 2);
    const missionPath = coordinator.getMissionPath();

    // Both agents evaluate the same criterion (edge case)
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const evaluatedCriteria: ISCCriterion[] = [
        {
          id: "ISC-SHARED", // Same ID
          text: "Shared criterion across resources",
          satisfaction: i === 0 ? "SATISFIED" : "FAILED", // Different results
          evidenceRefs: [],
          createdAt: new Date().toISOString(),
        },
      ];

      const agentFindings: AgentDriftFindings = {
        agentId,
        resourceId: `bucket-${i}`,
        findings: [],
        evaluatedCriteria,
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "drift-findings.json"),
        JSON.stringify(agentFindings, null, 2)
      );

      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const results = await coordinator.aggregateMarkResults(agentIds);

    // Should include both evaluations (duplicates allowed for different resources)
    expect(results.evaluatedCriteria.length).toBe(2);
  });

  test("preserves finding metadata across aggregation", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 1);
    const missionPath = coordinator.getMissionPath();
    const agentDir = path.join(missionPath, "agents", agentIds[0]);

    // Create finding with rich metadata
    const findings: DriftFinding[] = [
      {
        id: "drift-metadata-test",
        field: "publicAccessBlock",
        expected: true,
        actual: false,
        drift: true,
        severity: "CRITICAL",
        description: "Public access is NOT blocked - data exposure risk",
        timestamp: "2025-02-05T12:00:00.000Z",
      },
    ];

    const agentFindings: AgentDriftFindings = {
      agentId: agentIds[0],
      resourceId: "critical-bucket",
      findings,
      evaluatedCriteria: [],
      completedAt: new Date().toISOString(),
      durationMs: 150,
    };

    fs.writeFileSync(
      path.join(agentDir, "drift-findings.json"),
      JSON.stringify(agentFindings, null, 2)
    );

    await coordinator.updateAgentStatus(agentIds[0], "COMPLETED");

    const results = await coordinator.aggregateMarkResults(agentIds);

    // Verify all metadata preserved
    const finding = results.findings[0];
    expect(finding.id).toBe("drift-metadata-test");
    expect(finding.field).toBe("publicAccessBlock");
    expect(finding.expected).toBe(true);
    expect(finding.actual).toBe(false);
    expect(finding.drift).toBe(true);
    expect(finding.severity).toBe("CRITICAL");
    expect(finding.description).toBe("Public access is NOT blocked - data exposure risk");
    expect(finding.timestamp).toBe("2025-02-05T12:00:00.000Z");
  });
});
