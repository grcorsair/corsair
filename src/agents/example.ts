#!/usr/bin/env bun
/**
 * CORSAIR Agent Example
 *
 * Demonstrates autonomous security testing with Claude.
 *
 * Usage:
 *   export ANTHROPIC_API_KEY=your_key_here
 *   bun run src/agents/example.ts
 */

import { CorsairAgent } from "./corsair-agent";

async function main() {
  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: ANTHROPIC_API_KEY environment variable not set");
    console.error("\nSet your API key:");
    console.error("  export ANTHROPIC_API_KEY=your_key_here");
    process.exit(1);
  }

  console.log("⚓ Initializing CORSAIR Agent...\n");

  // Create agent with Sonnet for strategic thinking
  const agent = new CorsairAgent({
    apiKey,
    maxTurns: 15,
    model: "sonnet",
    verbose: true,
  });

  // Define mission
  const mission = `
Your mission: Test the MFA security of AWS Cognito User Pool 'us-west-2_tMGmGp8cg'

IMPORTANT: Use source "aws" (not "fixture") when calling the recon tool to fetch REAL AWS configuration.

Your objectives:
1. Perform reconnaissance to understand current MFA configuration from REAL AWS
2. Identify any drift from security best practices (MFA should be ON/required)
3. Execute an MFA bypass attack simulation to test if controls hold
4. Extract cryptographic evidence of your findings
5. Map your findings to compliance frameworks (MITRE, NIST, SOC2)

Use dryRun mode for all attacks. Document your reasoning at each step.

What do you discover, pirate? 🏴‍☠️
  `.trim();

  console.log("🎯 Mission Brief:");
  console.log(mission);
  console.log("\n" + "=".repeat(80) + "\n");

  try {
    // Execute autonomous mission
    const result = await agent.executeMission(mission);

    console.log("\n" + "=".repeat(80));
    console.log("\n📊 FINAL REPORT:\n");
    console.log(result);

    // Show context for debugging
    console.log("\n" + "=".repeat(80));
    console.log("\n🔍 EXECUTION CONTEXT:\n");
    const context = agent.getContext();
    console.log(`Snapshots captured: ${context.snapshots.size}`);
    console.log(`Recon operations: ${context.reconResults.size}`);
    console.log(`Mark operations: ${context.markResults.size}`);
    console.log(`Raid operations: ${context.raidResults.size}`);
    console.log(`Plunder operations: ${context.plunderResults.size}`);
    console.log(`Chart operations: ${context.chartResults.size}`);

    console.log("\n✅ Mission complete!");
  } catch (error) {
    console.error("\n❌ Mission failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { main };
