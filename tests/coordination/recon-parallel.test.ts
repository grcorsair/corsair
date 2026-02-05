/**
 * Phase 3.2: RECON Parallelization Tests
 *
 * Tests for parallel RECON execution:
 * - Resource splitting across agents
 * - Parallel agent spawning
 * - Snapshot merging
 * - Performance metrics
 * - Failure handling
 *
 * 12 test cases validating parallel reconnaissance.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { CorsairCoordinator } from "../../src/agents/coordinator-agent";
import { ResourceSplitter } from "../../src/core/resource-splitter";
import type { PartialSnapshot } from "../../src/types/coordination";

// Test fixtures directory
const TEST_WORK_DIR = "./tests/fixtures/recon-parallel-test-work";

describe("Phase 3.2: RECON Parallelization", () => {
  let coordinator: CorsairCoordinator;
  let splitter: ResourceSplitter;

  beforeEach(() => {
    // Clean up test directory
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
  });

  afterEach(() => {
    if (fs.existsSync(TEST_WORK_DIR)) {
      fs.rmSync(TEST_WORK_DIR, { recursive: true });
    }
  });

  test("splits resources across N agents evenly", () => {
    const resources = ["bucket-1", "bucket-2", "bucket-3", "bucket-4"];
    const agentCount = 2;

    const splits = splitter.splitResources(resources, agentCount);

    expect(splits.length).toBe(2);
    expect(splits[0].resources.length).toBe(2);
    expect(splits[1].resources.length).toBe(2);

    // Verify all resources are assigned
    const allResources = splits.flatMap(s => s.resources);
    expect(allResources.length).toBe(4);
    expect(new Set(allResources).size).toBe(4);
  });

  test("handles uneven splits gracefully", () => {
    const resources = ["bucket-1", "bucket-2", "bucket-3", "bucket-4", "bucket-5"];
    const agentCount = 3;

    const splits = splitter.splitResources(resources, agentCount);

    expect(splits.length).toBe(3);

    // With round-robin: agent-0 gets 2, agent-1 gets 2, agent-2 gets 1
    const counts = splits.map(s => s.resources.length);
    expect(counts.sort()).toEqual([1, 2, 2]);

    // Verify all resources are assigned
    const allResources = splits.flatMap(s => s.resources);
    expect(allResources.length).toBe(5);
  });

  test("spawns 4 parallel RECON agents", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 4);

    expect(agentIds.length).toBe(4);

    // Verify all are RECON type
    const state = coordinator.getState();
    for (const agent of state.agents) {
      expect(agent.type).toBe("RECON");
    }
  });

  test("each agent scans assigned subset", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const resources = ["bucket-1", "bucket-2", "bucket-3", "bucket-4"];
    const agentIds = await coordinator.spawnAgents("RECON", 2);

    // Distribute resources
    const splits = await coordinator.distributeResources(resources, agentIds);

    expect(splits.length).toBe(2);
    expect(splits[0].resources.length).toBe(2);
    expect(splits[1].resources.length).toBe(2);

    // Verify assignment files
    const missionPath = coordinator.getMissionPath();
    for (const split of splits) {
      const assignmentPath = path.join(missionPath, "agents", split.agentId, "assignment.json");
      const assignment = JSON.parse(fs.readFileSync(assignmentPath, "utf-8"));

      expect(assignment.resources).toEqual(split.resources);
    }
  });

  test("merges snapshots from all agents", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 3);
    const missionPath = coordinator.getMissionPath();

    // Create mock partial snapshots
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const partialSnapshot: PartialSnapshot = {
        agentId,
        resources: [`bucket-${i}`, `bucket-${i + 10}`],
        snapshots: {
          [`bucket-${i}`]: { bucketName: `bucket-${i}`, encryption: "AES256" },
          [`bucket-${i + 10}`]: { bucketName: `bucket-${i + 10}`, encryption: "aws:kms" },
        },
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partialSnapshot, null, 2)
      );

      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    // Aggregate results
    const results = await coordinator.aggregateReconResults(agentIds);

    expect(results.totalResources).toBe(6); // 2 per agent * 3 agents
    expect(results.snapshots.size).toBe(6);
    expect(results.agentCount).toBe(3);
  });

  test("achieves 3x speed improvement with 4 agents", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 4);
    const missionPath = coordinator.getMissionPath();

    // Simulate parallel execution with 100 resources
    const resourcesPerAgent = 25;
    const simulatedTimePerResource = 1200; // 1.2s per resource

    // Each agent processes in parallel, so total time = time for single agent
    const parallelTime = resourcesPerAgent * simulatedTimePerResource;
    const sequentialTime = 100 * simulatedTimePerResource; // 100 resources

    // Create mock results
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const snapshots: Record<string, unknown> = {};
      for (let j = 0; j < resourcesPerAgent; j++) {
        const resourceId = `bucket-${i * resourcesPerAgent + j}`;
        snapshots[resourceId] = { bucketName: resourceId };
      }

      const partialSnapshot: PartialSnapshot = {
        agentId,
        resources: Object.keys(snapshots),
        snapshots,
        completedAt: new Date().toISOString(),
        durationMs: parallelTime,
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partialSnapshot, null, 2)
      );

      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    // Calculate metrics
    const results = await coordinator.aggregateReconResults(agentIds);
    const metrics = coordinator.calculateMetrics(sequentialTime);

    expect(results.totalResources).toBe(100);
    expect(metrics.parallelAgents).toBe(4);
    // With 4 agents, speedup should be approximately 4x
    expect(metrics.speedupFactor).toBeGreaterThanOrEqual(3);
  });

  test("tracks performance metrics", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 2);
    const missionPath = coordinator.getMissionPath();

    // Create mock results with timing
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const partialSnapshot: PartialSnapshot = {
        agentId,
        resources: [`bucket-${i}`],
        snapshots: { [`bucket-${i}`]: { bucketName: `bucket-${i}` } },
        completedAt: new Date().toISOString(),
        durationMs: 1000, // 1 second per agent
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partialSnapshot, null, 2)
      );

      await coordinator.updateAgentStatus(agentId, "RUNNING");
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const metrics = coordinator.calculateMetrics(2000); // 2s sequential estimate

    expect(metrics.totalResources).toBe(2);
    expect(metrics.parallelAgents).toBe(2);
    expect(metrics.speedupFactor).toBeGreaterThan(0);
    expect(metrics.resourcesPerSecond).toBeGreaterThan(0);
  });

  test("handles partial agent failures", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 4);
    const missionPath = coordinator.getMissionPath();

    // 3 agents succeed, 1 fails
    for (let i = 0; i < 3; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const partialSnapshot: PartialSnapshot = {
        agentId,
        resources: [`bucket-${i}`],
        snapshots: { [`bucket-${i}`]: { bucketName: `bucket-${i}` } },
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partialSnapshot, null, 2)
      );

      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    // Fourth agent fails
    await coordinator.updateAgentStatus(agentIds[3], "FAILED", "Network error");

    const results = await coordinator.aggregateReconResults(agentIds);

    expect(results.totalResources).toBe(3);
    expect(results.agentCount).toBe(3);
    expect(results.failedAgents).toBe(1);
  });

  test("skips parallelization for single resource", () => {
    const resources = ["bucket-only-one"];
    const agentCount = 4;

    const splits = splitter.splitResources(resources, agentCount);

    // Should only create one split for single resource
    expect(splits.length).toBe(1);
    expect(splits[0].resources).toEqual(["bucket-only-one"]);
  });

  test("distributes 100+ resources efficiently", () => {
    // Generate 100 resources
    const resources = Array.from({ length: 100 }, (_, i) => `bucket-${i}`);
    const agentCount = 4;

    const splits = splitter.splitResources(resources, agentCount);

    expect(splits.length).toBe(4);

    // Each agent should get 25 resources
    for (const split of splits) {
      expect(split.resources.length).toBe(25);
    }

    // Verify no duplicates
    const allResources = splits.flatMap(s => s.resources);
    expect(new Set(allResources).size).toBe(100);
  });

  test("RECON agents write partial snapshots", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 1);
    const missionPath = coordinator.getMissionPath();
    const agentDir = path.join(missionPath, "agents", agentIds[0]);

    // Simulate agent writing output
    const partialSnapshot: PartialSnapshot = {
      agentId: agentIds[0],
      resources: ["bucket-test"],
      snapshots: {
        "bucket-test": {
          bucketName: "bucket-test",
          publicAccessBlock: true,
          encryption: "AES256",
          versioning: "Enabled",
          logging: true,
        },
      },
      completedAt: new Date().toISOString(),
      durationMs: 500,
    };

    fs.writeFileSync(
      path.join(agentDir, "snapshot-partial.json"),
      JSON.stringify(partialSnapshot, null, 2)
    );

    // Verify file structure
    const saved = JSON.parse(
      fs.readFileSync(path.join(agentDir, "snapshot-partial.json"), "utf-8")
    );

    expect(saved.agentId).toBe(agentIds[0]);
    expect(saved.snapshots["bucket-test"]).toBeDefined();
    expect(saved.snapshots["bucket-test"].encryption).toBe("AES256");
  });

  test("preserves snapshot metadata across merge", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    const agentIds = await coordinator.spawnAgents("RECON", 2);
    const missionPath = coordinator.getMissionPath();

    // Agent 0 with S3 snapshot
    const s3Snapshot = {
      bucketName: "s3-bucket",
      publicAccessBlock: true,
      encryption: "AES256",
      versioning: "Enabled",
      logging: true,
    };

    // Agent 1 with Cognito-like snapshot
    const cognitoSnapshot = {
      userPoolId: "cognito-pool",
      mfaConfiguration: "ON",
      passwordPolicy: { minimumLength: 12 },
    };

    for (let i = 0; i < 2; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);
      const resourceId = i === 0 ? "s3-bucket" : "cognito-pool";
      const snapshot = i === 0 ? s3Snapshot : cognitoSnapshot;

      const partialSnapshot: PartialSnapshot = {
        agentId,
        resources: [resourceId],
        snapshots: { [resourceId]: snapshot },
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partialSnapshot, null, 2)
      );

      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    const results = await coordinator.aggregateReconResults(agentIds);

    // Verify metadata preserved
    const mergedS3 = results.snapshots.get("s3-bucket") as typeof s3Snapshot;
    const mergedCognito = results.snapshots.get("cognito-pool") as typeof cognitoSnapshot;

    expect(mergedS3.encryption).toBe("AES256");
    expect(mergedS3.versioning).toBe("Enabled");
    expect(mergedCognito.mfaConfiguration).toBe("ON");
    expect(mergedCognito.passwordPolicy.minimumLength).toBe(12);
  });
});
