/**
 * AgentValidator - Agent Type Validation and Tool Access Control (Phase 3.4)
 *
 * Validates agent types and enforces tool access restrictions:
 * - RECON agents: read-only, recon tool only
 * - MARK agents: comparison, recon + mark tools
 * - RAID agents: full access to all tools
 *
 * Used by CorsairCoordinator to enforce agent specialization.
 */

import type { AgentType } from "../types/coordination";

/**
 * Valid agent types.
 */
const VALID_AGENT_TYPES: AgentType[] = ["RECON", "MARK", "RAID"];

/**
 * Tool access by agent type.
 * More specialized agents have fewer tools.
 */
const TOOL_ACCESS: Record<AgentType, string[]> = {
  RECON: ["recon"],
  MARK: ["recon", "mark"],
  RAID: ["recon", "mark", "raid", "plunder", "chart", "escape"],
};

/**
 * AgentValidator enforces agent type rules.
 */
export class AgentValidator {
  /**
   * Check if an agent type is valid.
   *
   * @param type - Agent type to validate
   * @returns true if valid
   */
  isValidAgentType(type: string): boolean {
    return VALID_AGENT_TYPES.includes(type as AgentType);
  }

  /**
   * Get allowed tools for an agent type.
   *
   * @param type - Agent type
   * @returns Array of allowed tool names
   */
  getAllowedTools(type: AgentType): string[] {
    return TOOL_ACCESS[type] || [];
  }

  /**
   * Check if an agent can use a specific tool.
   *
   * @param type - Agent type
   * @param tool - Tool name
   * @returns true if allowed
   */
  canUseTool(type: AgentType, tool: string): boolean {
    const allowed = this.getAllowedTools(type);
    return allowed.includes(tool);
  }

  /**
   * Get all valid agent types.
   *
   * @returns Array of valid agent types
   */
  getValidTypes(): AgentType[] {
    return [...VALID_AGENT_TYPES];
  }

  /**
   * Validate an agent can perform a set of operations.
   *
   * @param type - Agent type
   * @param tools - Array of tools to validate
   * @returns Object with valid flag and list of disallowed tools
   */
  validateOperations(
    type: AgentType,
    tools: string[]
  ): { valid: boolean; disallowed: string[] } {
    const allowed = this.getAllowedTools(type);
    const disallowed = tools.filter(t => !allowed.includes(t));

    return {
      valid: disallowed.length === 0,
      disallowed,
    };
  }

  /**
   * Get a description of an agent type's capabilities.
   *
   * @param type - Agent type
   * @returns Description string
   */
  getTypeDescription(type: AgentType): string {
    switch (type) {
      case "RECON":
        return "Read-only reconnaissance agent for parallel resource scanning";
      case "MARK":
        return "Drift detection agent for comparing expected vs actual state";
      case "RAID":
        return "Attack simulation agent with full tool access and approval gates";
      default:
        return "Unknown agent type";
    }
  }
}
