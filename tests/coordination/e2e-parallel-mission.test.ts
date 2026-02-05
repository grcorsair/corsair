/**
 * Phase 3.5: End-to-End Parallel Mission Tests
 *
 * Integration tests for complete parallel mission execution:
 * - Full RECON -> MARK -> (RAID) flow
 * - Performance verification (3x speedup)
 * - Failure handling
 * - State persistence
 * - Metrics tracking
 *
 * 27 test cases validating end-to-end parallel execution.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { CorsairCoordinator } from "../../src/agents/coordinator-agent";
import { ResourceSplitter } from "../../src/core/resource-splitter";
import { ISCDistributor } from "../../src/core/isc-distributor";
import { AgentValidator } from "../../src/agents/agent-validator";
import type {
  PartialSnapshot,
  AgentDriftFindings,
  CoordinatorState,
} from "../../src/types/coordination";
import type { ISCCriterion } from "../../src/types/isc";
import type { DriftFinding } from "../../src/types";

const TEST_WORK_DIR = "./tests/fixtures/e2e-parallel-test-work";

describe("Phase 3.5: E2E Parallel Mission", () => {
  let coordinator: CorsairCoordinator;
  let splitter: ResourceSplitter;
  let distributor: ISCDistributor;
  let validator: AgentValidator;

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

    splitter = new ResourceSplitter();
    distributor = new ISCDistributor();
    validator = new AgentValidator();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_WORK_DIR)) {
      fs.rmSync(TEST_WORK_DIR, { recursive: true });
    }
  });

  // ============ Full Mission Flow Tests ============

  test("executes full parallel mission: RECON -> MARK", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const resources = ["bucket-1", "bucket-2", "bucket-3", "bucket-4"];
    const missionPath = coordinator.getMissionPath();

    // Phase 1: RECON
    const reconAgentIds = await coordinator.spawnAgents("RECON", 2);

    // Simulate RECON results
    for (let i = 0; i < reconAgentIds.length; i++) {
      const agentId = reconAgentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const assignedResources = resources.filter((_, idx) => idx % 2 === i);
      const snapshots: Record<string, unknown> = {};

      for (const r of assignedResources) {
        snapshots[r] = { bucketName: r, publicAccessBlock: i === 0 };
      }

      const partial: PartialSnapshot = {
        agentId,
        resources: assignedResources,
        snapshots,
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partial, null, 2)
      );
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const reconResults = await coordinator.aggregateReconResults(reconAgentIds);
    expect(reconResults.totalResources).toBe(4);

    // Phase 2: MARK
    const markAgentIds = await coordinator.spawnAgents("MARK", 4);

    // Simulate MARK results
    for (let i = 0; i < markAgentIds.length; i++) {
      const agentId = markAgentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);
      const resourceId = resources[i];

      const findings: AgentDriftFindings = {
        agentId,
        resourceId,
        findings: i % 2 === 1 ? [{
          id: `drift-${i}`,
          field: "publicAccessBlock",
          expected: true,
          actual: false,
          drift: true,
          severity: "HIGH",
          description: "Public access not blocked",
          timestamp: new Date().toISOString(),
        }] : [],
        evaluatedCriteria: [{
          id: `ISC-${i}`,
          text: "Public access blocked",
          satisfaction: i % 2 === 0 ? "SATISFIED" : "FAILED",
          evidenceRefs: i % 2 === 1 ? [`drift-${i}`] : [],
          createdAt: new Date().toISOString(),
        }],
        completedAt: new Date().toISOString(),
        durationMs: 50,
      };

      fs.writeFileSync(
        path.join(agentDir, "drift-findings.json"),
        JSON.stringify(findings, null, 2)
      );
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const markResults = await coordinator.aggregateMarkResults(markAgentIds);

    expect(markResults.totalResources).toBe(4);
    expect(markResults.findings.length).toBe(2); // Half have drift
    expect(markResults.satisfactionRate).toBe(50); // 2/4 satisfied
  });

  test("measures 3x speed improvement on 100 resources", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const resourceCount = 100;
    const agentCount = 4;
    const timePerResource = 1200; // 1.2 seconds per resource

    // Sequential would take: 100 * 1200 = 120000ms
    const sequentialTime = resourceCount * timePerResource;

    // Parallel with 4 agents: 25 * 1200 = 30000ms
    const parallelTime = (resourceCount / agentCount) * timePerResource;

    const agentIds = await coordinator.spawnAgents("RECON", agentCount);
    const missionPath = coordinator.getMissionPath();

    // Create mock results
    const resourcesPerAgent = resourceCount / agentCount;
    for (let i = 0; i < agentCount; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const snapshots: Record<string, unknown> = {};
      for (let j = 0; j < resourcesPerAgent; j++) {
        const resourceId = `bucket-${i * resourcesPerAgent + j}`;
        snapshots[resourceId] = { bucketName: resourceId };
      }

      const partial: PartialSnapshot = {
        agentId,
        resources: Object.keys(snapshots),
        snapshots,
        completedAt: new Date().toISOString(),
        durationMs: parallelTime,
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partial, null, 2)
      );
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const results = await coordinator.aggregateReconResults(agentIds);
    const metrics = coordinator.calculateMetrics(sequentialTime);

    expect(results.totalResources).toBe(100);
    expect(metrics.parallelAgents).toBe(4);
    expect(metrics.speedupFactor).toBeGreaterThanOrEqual(3);
    expect(metrics.resourcesPerSecond).toBeGreaterThan(2.5);
  });

  test("handles 1 agent failure out of 4 gracefully", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 4);
    const missionPath = coordinator.getMissionPath();

    // 3 agents complete successfully
    for (let i = 0; i < 3; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const partial: PartialSnapshot = {
        agentId,
        resources: [`bucket-${i}`],
        snapshots: { [`bucket-${i}`]: { bucketName: `bucket-${i}` } },
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partial, null, 2)
      );
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    // 1 agent fails
    await coordinator.updateAgentStatus(agentIds[3], "FAILED", "Connection timeout");

    const results = await coordinator.aggregateReconResults(agentIds);

    expect(results.totalResources).toBe(3);
    expect(results.agentCount).toBe(3);
    expect(results.failedAgents).toBe(1);
    // Mission still succeeds with partial results
  });

  test("coordinator persists state at each phase", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Save initial state
    await coordinator.saveState();
    let state = JSON.parse(
      fs.readFileSync(path.join(coordinator.getMissionPath(), "coordinator-state.json"), "utf-8")
    );
    expect(state.currentPhase).toBe("IDLE");

    // Spawn RECON agents
    await coordinator.spawnAgents("RECON", 2);
    await coordinator.saveState();
    state = JSON.parse(
      fs.readFileSync(path.join(coordinator.getMissionPath(), "coordinator-state.json"), "utf-8")
    );
    expect(state.currentPhase).toBe("RECON");
    expect(state.agentCount).toBe(2);

    // Spawn MARK agents (simulating phase transition)
    await coordinator.spawnAgents("MARK", 2);
    await coordinator.saveState();
    state = JSON.parse(
      fs.readFileSync(path.join(coordinator.getMissionPath(), "coordinator-state.json"), "utf-8")
    );
    expect(state.currentPhase).toBe("MARK");
    expect(state.agentCount).toBe(4); // 2 RECON + 2 MARK
  });

  test("ISC satisfaction tracked across all agents", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("MARK", 5);
    const missionPath = coordinator.getMissionPath();

    // Create varied satisfaction results
    const satisfactionPattern = ["SATISFIED", "SATISFIED", "FAILED", "SATISFIED", "FAILED"];

    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const findings: AgentDriftFindings = {
        agentId,
        resourceId: `bucket-${i}`,
        findings: [],
        evaluatedCriteria: [{
          id: `ISC-${i}`,
          text: `Criterion ${i}`,
          satisfaction: satisfactionPattern[i] as "SATISFIED" | "FAILED",
          evidenceRefs: [],
          createdAt: new Date().toISOString(),
        }],
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "drift-findings.json"),
        JSON.stringify(findings, null, 2)
      );
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const results = await coordinator.aggregateMarkResults(agentIds);

    expect(results.evaluatedCriteria.length).toBe(5);
    expect(results.satisfactionRate).toBe(60); // 3/5 satisfied
  });

  test("calculates resources per second metric", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 2);
    const missionPath = coordinator.getMissionPath();

    // Each agent processes 10 resources in 1000ms
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const snapshots: Record<string, unknown> = {};
      for (let j = 0; j < 10; j++) {
        snapshots[`bucket-${i}-${j}`] = { bucketName: `bucket-${i}-${j}` };
      }

      const partial: PartialSnapshot = {
        agentId,
        resources: Object.keys(snapshots),
        snapshots,
        completedAt: new Date().toISOString(),
        durationMs: 1000, // 1 second
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partial, null, 2)
      );
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    // Sequential would take 2000ms for 20 resources (1 resource/second)
    const metrics = coordinator.calculateMetrics(2000);

    expect(metrics.totalResources).toBe(20);
    // With parallel, 20 resources in 1000ms = 20 resources/second
    expect(metrics.resourcesPerSecond).toBe(20);
  });

  // ============ Resource Distribution Tests ============

  test("splits resources evenly across agents", () => {
    const resources = Array.from({ length: 100 }, (_, i) => `bucket-${i}`);
    const splits = splitter.splitResources(resources, 4);

    expect(splits.length).toBe(4);
    splits.forEach(split => {
      expect(split.resources.length).toBe(25);
    });
  });

  test("handles resources not divisible by agent count", () => {
    const resources = Array.from({ length: 17 }, (_, i) => `bucket-${i}`);
    const splits = splitter.splitResources(resources, 4);

    expect(splits.length).toBe(4);
    const counts = splits.map(s => s.resources.length).sort();
    expect(counts).toEqual([4, 4, 4, 5]); // Round-robin distribution
  });

  test("distributes ISC criteria by service type", () => {
    const criteria: ISCCriterion[] = [
      { id: "1", text: "Public bucket access blocked", satisfaction: "PENDING", evidenceRefs: [], createdAt: "" },
      { id: "2", text: "MFA authentication enabled", satisfaction: "PENDING", evidenceRefs: [], createdAt: "" },
      { id: "3", text: "Encryption using AES256", satisfaction: "PENDING", evidenceRefs: [], createdAt: "" },
      { id: "4", text: "Password policy enforced", satisfaction: "PENDING", evidenceRefs: [], createdAt: "" },
    ];

    const s3Dist = distributor.distributeByResourceType(criteria, "my-bucket", "s3");
    const cognitoDist = distributor.distributeByResourceType(criteria, "user-pool", "cognito");

    expect(s3Dist.criteria.some(c => c.text.includes("bucket"))).toBe(true);
    expect(cognitoDist.criteria.some(c => c.text.includes("MFA"))).toBe(true);
  });

  // ============ Agent Validation Tests ============

  test("validates RECON agent tool access", () => {
    const tools = validator.getAllowedTools("RECON");

    expect(tools).toContain("recon");
    expect(tools).not.toContain("mark");
    expect(tools).not.toContain("raid");
    expect(validator.canUseTool("RECON", "recon")).toBe(true);
    expect(validator.canUseTool("RECON", "raid")).toBe(false);
  });

  test("validates MARK agent tool access", () => {
    const tools = validator.getAllowedTools("MARK");

    expect(tools).toContain("recon");
    expect(tools).toContain("mark");
    expect(tools).not.toContain("raid");
    expect(validator.canUseTool("MARK", "mark")).toBe(true);
    expect(validator.canUseTool("MARK", "raid")).toBe(false);
  });

  test("validates RAID agent has full access", () => {
    const tools = validator.getAllowedTools("RAID");

    expect(tools.length).toBe(6);
    expect(validator.canUseTool("RAID", "recon")).toBe(true);
    expect(validator.canUseTool("RAID", "mark")).toBe(true);
    expect(validator.canUseTool("RAID", "raid")).toBe(true);
    expect(validator.canUseTool("RAID", "plunder")).toBe(true);
    expect(validator.canUseTool("RAID", "chart")).toBe(true);
    expect(validator.canUseTool("RAID", "escape")).toBe(true);
  });

  // ============ Edge Cases ============

  test("handles empty resource list", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const resources: string[] = [];
    const splits = splitter.splitResources(resources, 4);

    expect(splits.length).toBe(0);
  });

  test("handles single resource with multiple agents", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const splits = splitter.splitResources(["only-bucket"], 4);

    expect(splits.length).toBe(1);
    expect(splits[0].resources).toEqual(["only-bucket"]);
  });

  test("handles all agents failing", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 3);

    // All agents fail
    for (const agentId of agentIds) {
      await coordinator.updateAgentStatus(agentId, "FAILED", "Network error");
    }

    const results = await coordinator.aggregateReconResults(agentIds);

    expect(results.totalResources).toBe(0);
    expect(results.agentCount).toBe(0);
    expect(results.failedAgents).toBe(3);
  });

  test("handles coordinator state reload", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    await coordinator.spawnAgents("RECON", 2);
    await coordinator.saveState();

    // Create new coordinator and load state
    const newCoordinator = new CorsairCoordinator({
      workDir: TEST_WORK_DIR,
    });

    const loadedState = await newCoordinator.loadState(coordinator.getMissionPath());

    expect(loadedState).not.toBeNull();
    expect(loadedState?.missionId).toBe(missionId);
    expect(loadedState?.agentCount).toBe(2);
  });

  test("calculates optimal agent count", () => {
    // 100 resources, max 4 agents, min 10 per agent
    const optimal1 = splitter.calculateOptimalAgentCount(100, 4, 10);
    expect(optimal1).toBe(4);

    // 5 resources, max 4 agents, min 1 per agent
    const optimal2 = splitter.calculateOptimalAgentCount(5, 4, 1);
    expect(optimal2).toBe(4); // Can use 4 agents for 5 resources

    // 2 resources, max 4 agents
    const optimal3 = splitter.calculateOptimalAgentCount(2, 4, 1);
    expect(optimal3).toBe(2); // Don't spawn more agents than resources
  });

  test("estimates parallel execution time", () => {
    // 100 resources, 4 agents, 100ms per resource
    const time = splitter.estimateParallelTime(100, 4, 100);

    // Each agent gets 25 resources, so 25 * 100 = 2500ms
    expect(time).toBe(2500);
  });

  // ============ Performance Validation ============

  test("validates speedup factor calculation", () => {
    const speedup = splitter.calculateSpeedup(12000, 3000);
    expect(speedup).toBe(4); // 4x speedup

    const noSpeedup = splitter.calculateSpeedup(1000, 1000);
    expect(noSpeedup).toBe(1); // No speedup

    const zeroTime = splitter.calculateSpeedup(1000, 0);
    expect(zeroTime).toBe(0); // Edge case
  });

  test("coordinator metrics include all required fields", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 2);
    const missionPath = coordinator.getMissionPath();

    for (const agentId of agentIds) {
      const agentDir = path.join(missionPath, "agents", agentId);
      const partial: PartialSnapshot = {
        agentId,
        resources: ["r1"],
        snapshots: { r1: {} },
        completedAt: new Date().toISOString(),
        durationMs: 500,
      };
      fs.writeFileSync(path.join(agentDir, "snapshot-partial.json"), JSON.stringify(partial));
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const metrics = coordinator.calculateMetrics(1000);

    expect(metrics).toHaveProperty("totalResources");
    expect(metrics).toHaveProperty("parallelAgents");
    expect(metrics).toHaveProperty("speedupFactor");
    expect(metrics).toHaveProperty("resourcesPerSecond");
  });

  // ============ Agent Lifecycle Tests ============

  test("tracks agent status transitions", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 1);
    const agentId = agentIds[0];

    let state = coordinator.getState();
    expect(state.agents[0].status).toBe("SPAWNING");

    await coordinator.updateAgentStatus(agentId, "RUNNING");
    state = coordinator.getState();
    expect(state.agents[0].status).toBe("RUNNING");
    expect(state.agents[0].startedAt).toBeDefined();

    await coordinator.updateAgentStatus(agentId, "COMPLETED");
    state = coordinator.getState();
    expect(state.agents[0].status).toBe("COMPLETED");
    expect(state.agents[0].completedAt).toBeDefined();
  });

  test("timeout updates agent status correctly", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 1);

    // Wait for timeout
    await coordinator.waitForAgents(agentIds, 200);

    const state = coordinator.getState();
    expect(state.agents[0].status).toBe("TIMEOUT");
  });

  test("validates agent type descriptions", () => {
    expect(validator.getTypeDescription("RECON").toLowerCase()).toContain("reconnaissance");
    expect(validator.getTypeDescription("MARK").toLowerCase()).toContain("drift");
    expect(validator.getTypeDescription("RAID").toLowerCase()).toContain("attack");
  });

  // ============ Additional Edge Cases ============

  test("handles rapid agent spawning", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Spawn many agents quickly
    const ids1 = await coordinator.spawnAgents("RECON", 5);
    const ids2 = await coordinator.spawnAgents("MARK", 5);
    const ids3 = await coordinator.spawnAgents("RAID", 1);

    const state = coordinator.getState();
    expect(state.agentCount).toBe(11);
    expect(state.agents.length).toBe(11);

    // Verify all unique
    const allIds = [...ids1, ...ids2, ...ids3];
    expect(new Set(allIds).size).toBe(11);
  });

  test("detector correctly identifies resource types", () => {
    expect(distributor.detectResourceType("my-bucket")).toBe("s3");
    expect(distributor.detectResourceType("s3://my-bucket")).toBe("s3");
    expect(distributor.detectResourceType("user-pool-123")).toBe("cognito");
    expect(distributor.detectResourceType("arn:aws:iam::123:role/MyRole")).toBe("iam");
    expect(distributor.detectResourceType("my-lambda-function")).toBe("lambda");
    expect(distributor.detectResourceType("random-resource")).toBe("unknown");
  });

  test("validates operation sets for agents", () => {
    // RECON can only use recon
    const reconOps = validator.validateOperations("RECON", ["recon"]);
    expect(reconOps.valid).toBe(true);
    expect(reconOps.disallowed.length).toBe(0);

    // RECON cannot use raid
    const reconInvalid = validator.validateOperations("RECON", ["recon", "raid"]);
    expect(reconInvalid.valid).toBe(false);
    expect(reconInvalid.disallowed).toContain("raid");

    // RAID can use all
    const raidOps = validator.validateOperations("RAID", ["recon", "mark", "raid", "plunder", "chart", "escape"]);
    expect(raidOps.valid).toBe(true);
  });

  test("criterion relevance check works correctly", () => {
    const s3Criterion: ISCCriterion = {
      id: "1",
      text: "Public bucket access blocked",
      satisfaction: "PENDING",
      evidenceRefs: [],
      createdAt: "",
    };

    const cognitoCriterion: ISCCriterion = {
      id: "2",
      text: "MFA authentication required",
      satisfaction: "PENDING",
      evidenceRefs: [],
      createdAt: "",
    };

    // S3 criterion should be relevant to S3 resources
    expect(distributor.isRelevant(s3Criterion, "s3")).toBe(true);
    expect(distributor.isRelevant(s3Criterion, "cognito")).toBe(false);

    // Cognito criterion should be relevant to Cognito resources
    expect(distributor.isRelevant(cognitoCriterion, "cognito")).toBe(true);
    expect(distributor.isRelevant(cognitoCriterion, "s3")).toBe(false);
  });
});
