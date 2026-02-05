/**
 * Phase 3.4: Agent Specialization Tests
 *
 * Tests for agent type specialization:
 * - Phase-specific system prompts
 * - Optimization goals per agent type
 * - Agent type validation
 * - Tool access restrictions
 *
 * 8 test cases validating agent specialization.
 */

import { describe, test, expect } from "bun:test";
import {
  getAgentSystemPrompt,
  RECON_SYSTEM_PROMPT,
  MARK_SYSTEM_PROMPT,
  RAID_SYSTEM_PROMPT,
} from "../../src/agents/system-prompts";
import { AgentValidator } from "../../src/agents/agent-validator";
import type { AgentType } from "../../src/types/coordination";

describe("Phase 3.4: Agent Specialization", () => {
  const validator = new AgentValidator();

  test("RECON agent uses reconnaissance system prompt", () => {
    const prompt = getAgentSystemPrompt("RECON");

    // Verify RECON-specific content
    expect(prompt).toContain("reconnaissance");
    expect(prompt).toContain("observation");
    expect(prompt.toLowerCase()).toContain("read-only");

    // Should not contain RAID-specific content
    expect(prompt.toLowerCase()).not.toContain("attack");
    expect(prompt.toLowerCase()).not.toContain("exploit");
  });

  test("MARK agent uses drift detection system prompt", () => {
    const prompt = getAgentSystemPrompt("MARK");

    // Verify MARK-specific content
    expect(prompt.toLowerCase()).toContain("drift");
    expect(prompt.toLowerCase()).toContain("comparison");
    expect(prompt.toLowerCase()).toContain("expected");
    expect(prompt.toLowerCase()).toContain("actual");
  });

  test("RAID agent uses remediation system prompt", () => {
    const prompt = getAgentSystemPrompt("RAID");

    // Verify RAID-specific content
    expect(prompt.toLowerCase()).toContain("attack");
    expect(prompt.toLowerCase()).toContain("controlled");
    expect(prompt.toLowerCase()).toContain("dryrun");
    expect(prompt.toLowerCase()).toContain("approval");
  });

  test("RECON agent optimized for completeness", () => {
    const prompt = getAgentSystemPrompt("RECON");

    // RECON should emphasize thoroughness
    expect(prompt.toLowerCase()).toContain("complete");
    expect(prompt.toLowerCase()).toContain("thorough");
  });

  test("MARK agent optimized for precision", () => {
    const prompt = getAgentSystemPrompt("MARK");

    // MARK should emphasize accuracy
    expect(prompt.toLowerCase()).toContain("precis");
    expect(prompt.toLowerCase()).toContain("accura");
  });

  test("RAID agent optimized for safety", () => {
    const prompt = getAgentSystemPrompt("RAID");

    // RAID should emphasize safety
    expect(prompt.toLowerCase()).toContain("safe");
    expect(prompt.toLowerCase()).toContain("careful");
    expect(prompt.toLowerCase()).toContain("rollback");
  });

  test("agent type validation enforced", () => {
    // Valid types
    expect(validator.isValidAgentType("RECON")).toBe(true);
    expect(validator.isValidAgentType("MARK")).toBe(true);
    expect(validator.isValidAgentType("RAID")).toBe(true);

    // Invalid types
    expect(validator.isValidAgentType("INVALID")).toBe(false);
    expect(validator.isValidAgentType("recon")).toBe(false); // Case sensitive
    expect(validator.isValidAgentType("")).toBe(false);
  });

  test("phase-specific tools restricted by agent type", () => {
    // RECON can only use recon tool
    const reconTools = validator.getAllowedTools("RECON");
    expect(reconTools).toContain("recon");
    expect(reconTools).not.toContain("raid");
    expect(reconTools).not.toContain("escape");

    // MARK can use recon and mark
    const markTools = validator.getAllowedTools("MARK");
    expect(markTools).toContain("recon");
    expect(markTools).toContain("mark");
    expect(markTools).not.toContain("raid");

    // RAID has access to all tools
    const raidTools = validator.getAllowedTools("RAID");
    expect(raidTools).toContain("recon");
    expect(raidTools).toContain("mark");
    expect(raidTools).toContain("raid");
    expect(raidTools).toContain("plunder");
    expect(raidTools).toContain("chart");
    expect(raidTools).toContain("escape");
  });
});
