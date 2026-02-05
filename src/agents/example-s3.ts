#!/usr/bin/env bun
/**
 * CORSAIR Agent S3 Example
 *
 * Demonstrates autonomous S3 security discovery with bounded autonomy.
 * Agent uses structured reconnaissance (S3Snapshot) + autonomous reasoning.
 *
 * Usage:
 *   export ANTHROPIC_API_KEY=your_key_here
 *   export AWS_PROFILE=insecure-corsair
 *   bun run src/agents/example-s3.ts
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

  console.log("⚓ Initializing CORSAIR Agent for S3 testing...\n");

  // Create agent with Sonnet for strategic thinking
  const agent = new CorsairAgent({
    apiKey,
    maxTurns: 15,
    model: "sonnet",
    verbose: true,
  });

  // Define mission with bounded autonomy
  // We provide: structure (S3Snapshot fields), attack vectors
  // Agent provides: intelligence (what's secure, what's not)
  const mission = `
Your mission: Autonomously assess the security of S3 bucket 'corsair-81740c58-public-data'

IMPORTANT: Use service "s3" and source "aws" when calling recon.

Your objectives:
1. Perform reconnaissance to understand current S3 bucket configuration
2. Use your security knowledge to identify what SHOULD be configured for S3
3. Identify any drift from AWS security best practices
4. Determine which S3 vulnerabilities exist based on your findings
5. Map your findings to compliance frameworks (MITRE, NIST, SOC2)

AWS S3 Security Best Practices (your knowledge base):
- Public access should be BLOCKED
- Encryption should be ENABLED (AES256 or aws:kms)
- Versioning should be ENABLED
- Logging should be ENABLED

Use dryRun mode for any simulated attacks. Document your reasoning at each step.

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
