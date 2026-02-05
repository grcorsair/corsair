/**
 * CorsairCoordinator - Multi-Agent Delegation Core (Phase 3.1)
 *
 * Coordinates parallel agent execution for Corsair missions:
 * - Spawns RECON agents for parallel resource scanning
 * - Spawns MARK agents for parallel drift detection
 * - Manages agent lifecycle and work directories
 * - Aggregates results from multiple agents
 * - Handles agent failures gracefully
 *
 * Directory Structure:
 * corsair-work/WORK/{date}/{missionId}/
 *   coordinator-state.json
 *   agents/
 *     recon-agent-0/
 *       assignment.json
 *       snapshot-partial.json
 *       agent-status.json
 *     recon-agent-1/...
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type {
  AgentType,
  AgentStatus,
  AgentMetadata,
  CoordinatorState,
  CoordinatorOptions,
  CoordinatorMetrics,
  AgentAssignment,
  PartialSnapshot,
  AgentDriftFindings,
  AggregatedReconResults,
  AggregatedMarkResults,
  ResourceSplit,
  ISCDistribution,
} from "../types/coordination";
import type { ISCCriterion } from "../types/isc";
import type { DriftFinding } from "../types";
import { extractDateFromMissionId } from "../utils/mission-utils";

/**
 * Default configuration values.
 */
const DEFAULT_OPTIONS: Required<CoordinatorOptions> = {
  maxReconAgents: 4,
  agentTimeoutMs: 300000, // 5 minutes
  pollIntervalMs: 2000, // 2 seconds
  workDir: "./corsair-work",
  verbose: false,
};

/**
 * Result of waiting for agents to complete.
 */
export interface WaitResult {
  /** Agents that completed successfully */
  completed: string[];
  /** Agents that failed */
  failed: string[];
  /** Agents that timed out */
  timedOut: string[];
}

/**
 * CorsairCoordinator manages multi-agent parallel execution.
 */
export class CorsairCoordinator {
  private options: Required<CoordinatorOptions>;
  private state: CoordinatorState | null = null;
  private missionPath: string = "";
  private agentsDir: string = "";

  constructor(options: CoordinatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize coordinator for a mission.
   *
   * @param missionId - Mission identifier
   */
  async initialize(missionId: string): Promise<void> {
    // Extract date from mission ID
    const dateDir = extractDateFromMissionId(missionId);

    // Create mission directory
    this.missionPath = path.join(this.options.workDir, "WORK", dateDir, missionId);
    this.agentsDir = path.join(this.missionPath, "agents");

    try {
      await fsp.access(this.missionPath);
    } catch {
      await fsp.mkdir(this.missionPath, { recursive: true });
    }

    try {
      await fsp.access(this.agentsDir);
    } catch {
      await fsp.mkdir(this.agentsDir, { recursive: true });
    }

    // Initialize state
    this.state = {
      missionId,
      currentPhase: "IDLE",
      agents: [],
      agentCount: 0,
      startedAt: new Date().toISOString(),
    };

    this.log(`Coordinator initialized for mission: ${missionId}`);
  }

  /**
   * Get the mission path.
   */
  getMissionPath(): string {
    return this.missionPath;
  }

  /**
   * Get current coordinator state.
   */
  getState(): CoordinatorState {
    if (!this.state) {
      throw new Error("Coordinator not initialized");
    }
    return { ...this.state };
  }

  /**
   * Spawn agents of a specific type.
   *
   * @param type - Agent type (RECON, MARK, RAID)
   * @param count - Number of agents to spawn
   * @returns Array of agent IDs
   */
  async spawnAgents(type: AgentType, count: number): Promise<string[]> {
    if (!this.state) {
      throw new Error("Coordinator not initialized");
    }

    const agentIds: string[] = [];
    const timestamp = new Date().toISOString();

    // Update current phase
    this.state.currentPhase = type;

    for (let i = 0; i < count; i++) {
      const agentId = `${type.toLowerCase()}-agent-${i}`;
      const agentDir = path.join(this.agentsDir, agentId);

      // Create agent directory
      try {
        await fsp.access(agentDir);
      } catch {
        await fsp.mkdir(agentDir, { recursive: true });
      }

      // Create agent metadata
      const metadata: AgentMetadata = {
        agentId,
        type,
        status: "SPAWNING",
        spawnedAt: timestamp,
        workDir: agentDir,
        assignmentCount: 0,
      };

      // Add to state
      this.state.agents.push(metadata);
      agentIds.push(agentId);

      // Write status file
      await this.writeAgentStatus(agentId, metadata);

      this.log(`Spawned agent: ${agentId}`);
    }

    this.state.agentCount = this.state.agents.length;

    return agentIds;
  }

  /**
   * Distribute ISC criteria to agents.
   *
   * @param agentIds - Agent IDs to receive criteria
   * @param criteria - ISC criteria to distribute
   */
  async distributeCriteria(agentIds: string[], criteria: ISCCriterion[]): Promise<void> {
    if (!this.state) {
      throw new Error("Coordinator not initialized");
    }

    for (const agentId of agentIds) {
      const agentDir = path.join(this.agentsDir, agentId);
      const assignmentPath = path.join(agentDir, "assignment.json");

      const assignment: AgentAssignment = {
        agentId,
        type: "RECON", // Default to RECON
        missionId: this.state.missionId,
        criteria,
        assignedAt: new Date().toISOString(),
      };

      await fsp.writeFile(assignmentPath, JSON.stringify(assignment, null, 2), "utf-8");

      // Update agent metadata
      const agent = this.state.agents.find(a => a.agentId === agentId);
      if (agent) {
        agent.assignmentCount = criteria.length;
      }

      this.log(`Distributed ${criteria.length} criteria to ${agentId}`);
    }
  }

  /**
   * Distribute resources to RECON agents.
   *
   * @param resources - Resource identifiers to distribute
   * @param agentIds - Agent IDs to receive resources
   * @returns Resource splits
   */
  async distributeResources(resources: string[], agentIds: string[]): Promise<ResourceSplit[]> {
    if (!this.state) {
      throw new Error("Coordinator not initialized");
    }

    const splits: ResourceSplit[] = [];

    // Round-robin distribution
    for (let i = 0; i < agentIds.length; i++) {
      splits.push({
        agentId: agentIds[i],
        resources: [],
        index: i,
      });
    }

    for (let i = 0; i < resources.length; i++) {
      const splitIndex = i % agentIds.length;
      splits[splitIndex].resources.push(resources[i]);
    }

    // Write assignment files
    for (const split of splits) {
      const agentDir = path.join(this.agentsDir, split.agentId);
      const assignmentPath = path.join(agentDir, "assignment.json");

      const assignment: AgentAssignment = {
        agentId: split.agentId,
        type: "RECON",
        missionId: this.state.missionId,
        resources: split.resources,
        assignedAt: new Date().toISOString(),
      };

      await fsp.writeFile(assignmentPath, JSON.stringify(assignment, null, 2), "utf-8");

      // Update agent metadata
      const agent = this.state.agents.find(a => a.agentId === split.agentId);
      if (agent) {
        agent.assignmentCount = split.resources.length;
      }

      this.log(`Assigned ${split.resources.length} resources to ${split.agentId}`);
    }

    return splits;
  }

  /**
   * Update agent status.
   *
   * @param agentId - Agent ID
   * @param status - New status
   * @param error - Error message (if status is FAILED)
   */
  async updateAgentStatus(agentId: string, status: AgentStatus, error?: string): Promise<void> {
    if (!this.state) {
      throw new Error("Coordinator not initialized");
    }

    const agent = this.state.agents.find(a => a.agentId === agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const now = new Date().toISOString();

    agent.status = status;

    if (status === "RUNNING") {
      agent.startedAt = now;
    }

    if (status === "COMPLETED" || status === "FAILED" || status === "TIMEOUT") {
      agent.completedAt = now;

      if (agent.startedAt) {
        agent.durationMs = new Date(now).getTime() - new Date(agent.startedAt).getTime();
      }
    }

    if (error) {
      agent.error = error;
    }

    // Write status file
    await this.writeAgentStatus(agentId, agent);

    this.log(`Agent ${agentId} status: ${status}${error ? ` (${error})` : ""}`);
  }

  /**
   * Wait for agents to complete with timeout.
   *
   * @param agentIds - Agent IDs to wait for
   * @param timeoutMs - Timeout in milliseconds (overrides default)
   * @returns Wait result with completed/failed/timedOut lists
   */
  async waitForAgents(agentIds: string[], timeoutMs?: number): Promise<WaitResult> {
    const timeout = timeoutMs ?? this.options.agentTimeoutMs;
    const startTime = Date.now();

    const result: WaitResult = {
      completed: [],
      failed: [],
      timedOut: [],
    };

    const pending = new Set(agentIds);

    while (pending.size > 0) {
      // Check timeout
      if (Date.now() - startTime >= timeout) {
        // Mark remaining as timed out
        for (const agentId of pending) {
          result.timedOut.push(agentId);
          await this.updateAgentStatus(agentId, "TIMEOUT");
        }
        break;
      }

      // Poll status for each pending agent
      for (const agentId of [...pending]) {
        const status = await this.readAgentStatus(agentId);

        if (status?.status === "COMPLETED") {
          result.completed.push(agentId);
          pending.delete(agentId);
        } else if (status?.status === "FAILED") {
          result.failed.push(agentId);
          pending.delete(agentId);
        } else if (status?.status === "TIMEOUT") {
          result.timedOut.push(agentId);
          pending.delete(agentId);
        }
      }

      // Wait before next poll
      if (pending.size > 0) {
        await this.sleep(this.options.pollIntervalMs);
      }
    }

    return result;
  }

  /**
   * Aggregate RECON results from all agents.
   *
   * @param agentIds - Agent IDs to aggregate from
   * @returns Aggregated results
   */
  async aggregateReconResults(agentIds: string[]): Promise<AggregatedReconResults> {
    const startTime = Date.now();
    const snapshots = new Map<string, unknown>();
    let totalResources = 0;
    let agentCount = 0;
    let failedAgents = 0;

    for (const agentId of agentIds) {
      const status = await this.readAgentStatus(agentId);

      if (status?.status === "FAILED" || status?.status === "TIMEOUT") {
        failedAgents++;
        continue;
      }

      const agentDir = path.join(this.agentsDir, agentId);
      const snapshotPath = path.join(agentDir, "snapshot-partial.json");

      try {
        await fsp.access(snapshotPath);
        const content = await fsp.readFile(snapshotPath, "utf-8");
        const partial: PartialSnapshot = JSON.parse(content);

        // Merge snapshots
        for (const [resourceId, snapshot] of Object.entries(partial.snapshots)) {
          snapshots.set(resourceId, snapshot);
          totalResources++;
        }

        agentCount++;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          this.log(`Error reading snapshot from ${agentId}: ${error}`);
        }
        failedAgents++;
      }
    }

    const totalDurationMs = Date.now() - startTime;

    this.log(`Aggregated ${totalResources} resources from ${agentCount} agents`);

    return {
      snapshots,
      totalResources,
      agentCount,
      failedAgents,
      totalDurationMs,
    };
  }

  /**
   * Aggregate MARK results from all agents.
   *
   * @param agentIds - Agent IDs to aggregate from
   * @returns Aggregated results
   */
  async aggregateMarkResults(agentIds: string[]): Promise<AggregatedMarkResults> {
    const startTime = Date.now();
    const findings: DriftFinding[] = [];
    const evaluatedCriteria: ISCCriterion[] = [];
    let totalResources = 0;
    let agentCount = 0;
    let failedAgents = 0;

    for (const agentId of agentIds) {
      const status = await this.readAgentStatus(agentId);

      if (status?.status === "FAILED" || status?.status === "TIMEOUT") {
        failedAgents++;
        continue;
      }

      const agentDir = path.join(this.agentsDir, agentId);
      const findingsPath = path.join(agentDir, "drift-findings.json");

      try {
        await fsp.access(findingsPath);
        const content = await fsp.readFile(findingsPath, "utf-8");
        const agentFindings: AgentDriftFindings = JSON.parse(content);

        // Merge findings
        findings.push(...agentFindings.findings);
        evaluatedCriteria.push(...agentFindings.evaluatedCriteria);
        totalResources++;
        agentCount++;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          this.log(`Error reading findings from ${agentId}: ${error}`);
        }
        failedAgents++;
      }
    }

    // Calculate satisfaction rate
    const satisfied = evaluatedCriteria.filter(c => c.satisfaction === "SATISFIED").length;
    const total = evaluatedCriteria.length;
    const satisfactionRate = total > 0 ? (satisfied / total) * 100 : 0;

    const totalDurationMs = Date.now() - startTime;

    this.log(`Aggregated ${findings.length} findings from ${agentCount} agents`);

    return {
      findings,
      evaluatedCriteria,
      totalResources,
      agentCount,
      failedAgents,
      satisfactionRate,
      totalDurationMs,
    };
  }

  /**
   * Save coordinator state to file.
   */
  async saveState(): Promise<void> {
    if (!this.state) {
      throw new Error("Coordinator not initialized");
    }

    const statePath = path.join(this.missionPath, "coordinator-state.json");
    await fsp.writeFile(statePath, JSON.stringify(this.state, null, 2), "utf-8");

    this.log("Coordinator state saved");
  }

  /**
   * Load coordinator state from file.
   *
   * @param missionPath - Path to mission directory
   */
  async loadState(missionPath: string): Promise<CoordinatorState | null> {
    const statePath = path.join(missionPath, "coordinator-state.json");

    try {
      await fsp.access(statePath);
      const content = await fsp.readFile(statePath, "utf-8");
      const state: CoordinatorState = JSON.parse(content);
      this.state = state;
      this.missionPath = missionPath;
      this.agentsDir = path.join(missionPath, "agents");
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.log(`Error loading coordinator state: ${error}`);
      }
      return null;
    }
  }

  /**
   * Calculate performance metrics.
   *
   * @param sequentialEstimateMs - Estimated time for sequential execution
   */
  calculateMetrics(sequentialEstimateMs: number): CoordinatorMetrics {
    if (!this.state) {
      throw new Error("Coordinator not initialized");
    }

    const completedAgents = this.state.agents.filter(a => a.status === "COMPLETED");

    // Count resources and durations from agent metadata, or read from partial snapshots
    let totalResources = completedAgents.reduce((sum, a) => sum + a.assignmentCount, 0);
    const agentDurations: number[] = [];

    // Read from partial snapshot files to get resources and durations
    for (const agent of completedAgents) {
      const snapshotPath = path.join(agent.workDir, "snapshot-partial.json");
      if (fs.existsSync(snapshotPath)) {
        try {
          const partial: PartialSnapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
          // Only count if assignmentCount wasn't already set
          if (agent.assignmentCount === 0) {
            totalResources += partial.resources.length;
          }
          // Use snapshot durationMs if agent doesn't have it
          if (partial.durationMs > 0) {
            agentDurations.push(partial.durationMs);
          } else if (agent.durationMs && agent.durationMs > 0) {
            agentDurations.push(agent.durationMs);
          }
        } catch {
          // Fallback to agent durationMs
          if (agent.durationMs && agent.durationMs > 0) {
            agentDurations.push(agent.durationMs);
          }
        }
      } else if (agent.durationMs && agent.durationMs > 0) {
        agentDurations.push(agent.durationMs);
      }
    }

    // Calculate actual duration
    let totalDurationMs = 0;
    if (this.state.completedAt && this.state.startedAt) {
      totalDurationMs = new Date(this.state.completedAt).getTime() -
        new Date(this.state.startedAt).getTime();
    } else if (agentDurations.length > 0) {
      // Use max agent duration (parallel execution time = slowest agent)
      totalDurationMs = Math.max(...agentDurations);
    }

    const speedupFactor = totalDurationMs > 0 ? sequentialEstimateMs / totalDurationMs : 1;
    const resourcesPerSecond = totalDurationMs > 0 ? (totalResources / totalDurationMs) * 1000 : 0;

    return {
      totalResources,
      parallelAgents: this.state.agentCount,
      speedupFactor,
      resourcesPerSecond,
    };
  }

  /**
   * Write agent status file.
   */
  private async writeAgentStatus(agentId: string, metadata: AgentMetadata): Promise<void> {
    const agentDir = path.join(this.agentsDir, agentId);
    const statusPath = path.join(agentDir, "agent-status.json");

    await fsp.writeFile(statusPath, JSON.stringify(metadata, null, 2), "utf-8");
  }

  /**
   * Read agent status file.
   */
  private async readAgentStatus(agentId: string): Promise<AgentMetadata | null> {
    const agentDir = path.join(this.agentsDir, agentId);
    const statusPath = path.join(agentDir, "agent-status.json");

    try {
      await fsp.access(statusPath);
      const content = await fsp.readFile(statusPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log output (respects verbose flag).
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[Coordinator] ${message}`);
    }
  }
}
