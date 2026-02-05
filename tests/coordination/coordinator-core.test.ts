/**
 * Phase 3.1: Coordinator Core Tests
 *
 * Tests for CorsairCoordinator - the multi-agent delegation core.
 * 8 test cases validating:
 * - Agent spawning with unique IDs
 * - Agent work directory creation
 * - ISC criteria distribution
 * - Result aggregation
 * - Failure handling
 * - State persistence
 * - Status polling with timeout
 * - Lifecycle tracking
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { CorsairCoordinator } from "../../src/agents/coordinator-agent";
import type {
  AgentMetadata,
  CoordinatorState,
  AgentType,
  AgentStatus,
} from "../../src/types/coordination";

// Test fixtures directory
const TEST_WORK_DIR = "./tests/fixtures/coordination-test-work";

describe("Phase 3.1: Coordinator Core", () => {
  let coordinator: CorsairCoordinator;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_WORK_DIR)) {
      fs.rmSync(TEST_WORK_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_WORK_DIR, { recursive: true });

    coordinator = new CorsairCoordinator({
      workDir: TEST_WORK_DIR,
      maxReconAgents: 4,
      agentTimeoutMs: 5000, // 5 seconds for tests
      pollIntervalMs: 100, // Fast polling for tests
      verbose: false,
    });
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(TEST_WORK_DIR)) {
      fs.rmSync(TEST_WORK_DIR, { recursive: true });
    }
  });

  test("spawns agents with unique IDs", async () => {
    // Generate mission ID
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Spawn multiple RECON agents
    const agentIds = await coordinator.spawnAgents("RECON", 4);

    // Verify unique IDs
    expect(agentIds.length).toBe(4);
    const uniqueIds = new Set(agentIds);
    expect(uniqueIds.size).toBe(4);

    // Verify ID format: {type}-agent-{index}
    expect(agentIds[0]).toBe("recon-agent-0");
    expect(agentIds[1]).toBe("recon-agent-1");
    expect(agentIds[2]).toBe("recon-agent-2");
    expect(agentIds[3]).toBe("recon-agent-3");
  });

  test("creates agent work directories", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Spawn agents
    const agentIds = await coordinator.spawnAgents("RECON", 2);

    // Verify directories exist
    const missionPath = coordinator.getMissionPath();
    const agentsDir = path.join(missionPath, "agents");

    expect(fs.existsSync(agentsDir)).toBe(true);

    for (const agentId of agentIds) {
      const agentDir = path.join(agentsDir, agentId);
      expect(fs.existsSync(agentDir)).toBe(true);
    }
  });

  test("distributes ISC criteria to agents", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Create test criteria
    const criteria = [
      { id: "ISC-1", text: "Public access blocked at bucket level", satisfaction: "PENDING" as const, evidenceRefs: [], createdAt: new Date().toISOString() },
      { id: "ISC-2", text: "Encryption enabled using AES256 algorithm", satisfaction: "PENDING" as const, evidenceRefs: [], createdAt: new Date().toISOString() },
      { id: "ISC-3", text: "Versioning enabled for data protection", satisfaction: "PENDING" as const, evidenceRefs: [], createdAt: new Date().toISOString() },
    ];

    // Spawn RECON agents and distribute criteria
    const agentIds = await coordinator.spawnAgents("RECON", 2);
    await coordinator.distributeCriteria(agentIds, criteria);

    // Verify assignment files exist
    const missionPath = coordinator.getMissionPath();
    for (const agentId of agentIds) {
      const assignmentPath = path.join(missionPath, "agents", agentId, "assignment.json");
      expect(fs.existsSync(assignmentPath)).toBe(true);

      const assignment = JSON.parse(fs.readFileSync(assignmentPath, "utf-8"));
      expect(assignment.agentId).toBe(agentId);
      expect(assignment.criteria).toBeDefined();
    }
  });

  test("aggregates results from multiple agents", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Spawn agents and create mock results
    const agentIds = await coordinator.spawnAgents("RECON", 2);
    const missionPath = coordinator.getMissionPath();

    // Create mock partial snapshots for each agent
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const partialSnapshot = {
        agentId,
        resources: [`bucket-${i}`],
        snapshots: {
          [`bucket-${i}`]: {
            bucketName: `bucket-${i}`,
            publicAccessBlock: true,
            encryption: "AES256",
          },
        },
        completedAt: new Date().toISOString(),
        durationMs: 100,
      };

      fs.writeFileSync(
        path.join(agentDir, "snapshot-partial.json"),
        JSON.stringify(partialSnapshot, null, 2)
      );

      // Mark agent as completed
      await coordinator.updateAgentStatus(agentId, "COMPLETED");
    }

    // Aggregate results
    const results = await coordinator.aggregateReconResults(agentIds);

    expect(results.totalResources).toBe(2);
    expect(results.agentCount).toBe(2);
    expect(results.failedAgents).toBe(0);
    expect(results.snapshots.size).toBe(2);
    expect(results.snapshots.has("bucket-0")).toBe(true);
    expect(results.snapshots.has("bucket-1")).toBe(true);
  });

  test("handles agent failures gracefully", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Spawn agents
    const agentIds = await coordinator.spawnAgents("RECON", 3);
    const missionPath = coordinator.getMissionPath();

    // Create results for 2 agents, let 1 fail
    for (let i = 0; i < 2; i++) {
      const agentId = agentIds[i];
      const agentDir = path.join(missionPath, "agents", agentId);

      const partialSnapshot = {
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

    // Mark third agent as failed
    await coordinator.updateAgentStatus(agentIds[2], "FAILED", "Test failure");

    // Aggregate should still work with 2/3 agents
    const results = await coordinator.aggregateReconResults(agentIds);

    expect(results.totalResources).toBe(2);
    expect(results.agentCount).toBe(2);
    expect(results.failedAgents).toBe(1);
  });

  test("saves coordinator state to file", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Spawn agents
    await coordinator.spawnAgents("RECON", 2);

    // Save state
    await coordinator.saveState();

    // Verify state file exists
    const missionPath = coordinator.getMissionPath();
    const statePath = path.join(missionPath, "coordinator-state.json");

    expect(fs.existsSync(statePath)).toBe(true);

    const state: CoordinatorState = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    expect(state.missionId).toBe(missionId);
    expect(state.agents.length).toBe(2);
    expect(state.agentCount).toBe(2);
    expect(state.currentPhase).toBe("RECON");
  });

  test("polls agent status with timeout", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Spawn agents
    const agentIds = await coordinator.spawnAgents("RECON", 2);

    // Update one agent to completed immediately
    await coordinator.updateAgentStatus(agentIds[0], "COMPLETED");

    // Start polling with short timeout
    const startTime = Date.now();

    // This should timeout since agent 1 never completes
    const result = await coordinator.waitForAgents(agentIds, 500);

    const elapsed = Date.now() - startTime;

    // Should have timed out in ~500ms
    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(1000);

    // One completed, one timed out
    expect(result.completed.length).toBe(1);
    expect(result.timedOut.length).toBe(1);
  });

  test("tracks agent lifecycle in coordinator state", async () => {
    const missionId = `mission_${Date.now()}_test`;
    await coordinator.initialize(missionId);

    // Spawn agents
    const agentIds = await coordinator.spawnAgents("RECON", 2);

    // Get initial state
    let state = coordinator.getState();
    expect(state.agents.length).toBe(2);

    // Verify initial status
    for (const agent of state.agents) {
      expect(agent.status).toBe("SPAWNING");
      expect(agent.spawnedAt).toBeDefined();
    }

    // Update lifecycle
    await coordinator.updateAgentStatus(agentIds[0], "RUNNING");
    await coordinator.updateAgentStatus(agentIds[0], "COMPLETED");
    await coordinator.updateAgentStatus(agentIds[1], "FAILED", "Test error");

    // Get updated state
    state = coordinator.getState();

    const agent0 = state.agents.find(a => a.agentId === agentIds[0]);
    const agent1 = state.agents.find(a => a.agentId === agentIds[1]);

    expect(agent0?.status).toBe("COMPLETED");
    expect(agent0?.completedAt).toBeDefined();

    expect(agent1?.status).toBe("FAILED");
    expect(agent1?.error).toBe("Test error");
  });
});
