/**
 * ResourceSplitter - Work Distribution for Parallel Agents (Phase 3.2)
 *
 * Distributes resources across multiple agents for parallel scanning:
 * - Round-robin distribution for even workload
 * - Handles uneven splits gracefully
 * - Optimizes for single resource case
 *
 * Used by CorsairCoordinator to divide reconnaissance work.
 */

import type { ResourceSplit } from "../types/coordination";

/**
 * ResourceSplitter distributes resources across agents.
 */
export class ResourceSplitter {
  /**
   * Split resources across N agents using round-robin distribution.
   *
   * @param resources - Array of resource identifiers to split
   * @param agentCount - Number of agents to split across
   * @returns Array of ResourceSplit objects
   */
  splitResources(resources: string[], agentCount: number): ResourceSplit[] {
    // Handle edge cases
    if (resources.length === 0) {
      return [];
    }

    // For single resource, only need one agent
    const effectiveAgentCount = Math.min(agentCount, resources.length);

    // Initialize splits
    const splits: ResourceSplit[] = [];
    for (let i = 0; i < effectiveAgentCount; i++) {
      splits.push({
        agentId: `recon-agent-${i}`,
        resources: [],
        index: i,
      });
    }

    // Round-robin distribution
    for (let i = 0; i < resources.length; i++) {
      const splitIndex = i % effectiveAgentCount;
      splits[splitIndex].resources.push(resources[i]);
    }

    return splits;
  }

  /**
   * Calculate optimal agent count for a resource set.
   *
   * @param resourceCount - Number of resources
   * @param maxAgents - Maximum number of agents allowed
   * @param minPerAgent - Minimum resources per agent (default: 1)
   * @returns Optimal number of agents to use
   */
  calculateOptimalAgentCount(
    resourceCount: number,
    maxAgents: number,
    minPerAgent: number = 1
  ): number {
    if (resourceCount === 0) {
      return 0;
    }

    // Calculate based on minimum per agent
    const maxByMinimum = Math.ceil(resourceCount / minPerAgent);

    // Don't exceed resource count
    const maxByResources = resourceCount;

    // Don't exceed max agents
    return Math.min(maxAgents, maxByMinimum, maxByResources);
  }

  /**
   * Estimate parallel execution time.
   *
   * @param resourceCount - Number of resources
   * @param agentCount - Number of parallel agents
   * @param timePerResource - Time per resource in milliseconds
   * @returns Estimated total time in milliseconds
   */
  estimateParallelTime(
    resourceCount: number,
    agentCount: number,
    timePerResource: number
  ): number {
    if (resourceCount === 0 || agentCount === 0) {
      return 0;
    }

    // Resources per agent (ceiling for uneven distribution)
    const resourcesPerAgent = Math.ceil(resourceCount / agentCount);

    // Total time is the slowest agent (which has the most resources)
    return resourcesPerAgent * timePerResource;
  }

  /**
   * Calculate speedup factor compared to sequential execution.
   *
   * @param sequentialTime - Time for sequential execution (ms)
   * @param parallelTime - Time for parallel execution (ms)
   * @returns Speedup factor (e.g., 3.0 means 3x faster)
   */
  calculateSpeedup(sequentialTime: number, parallelTime: number): number {
    if (parallelTime === 0) {
      return 0;
    }
    return sequentialTime / parallelTime;
  }
}
