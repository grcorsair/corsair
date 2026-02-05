#!/usr/bin/env bun
/**
 * CORSAIR PAI Algorithm Example
 *
 * Demonstrates pirate-themed 7-phase Algorithm execution.
 * Shows how ISC criteria generation, attack execution, and verification
 * flow through the Algorithm phases with bounded autonomy.
 *
 * Usage:
 *   export ANTHROPIC_API_KEY=your_key_here
 *   export AWS_PROFILE=insecure-corsair
 *   bun run src/agents/example-pai-algorithm.ts
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

  console.log("🏴‍☠️ CORSAIR PAI Algorithm Demonstration\n");
  console.log("⚓ The 7-Phase Security Testing Engine\n");

  // Create agent with Sonnet for strategic thinking
  const agent = new CorsairAgent({
    apiKey,
    maxTurns: 20,
    model: "sonnet",
    verbose: true,
  });

  // Mission that leverages full Algorithm structure
  const mission = `
Ahoy! Your mission demonstrates the PAI Algorithm in action.

Target: S3 bucket 'corsair-81740c58-public-data'
Service: s3
Source: aws

Execute the complete 7-phase Algorithm cycle:

🔭 SCOUT THE WATERS (OBSERVE):
- Use RECON to gather intelligence on the S3 bucket
- Document current configuration state

🧭 CHART THE COURSE (THINK):
- Apply your S3 security knowledge
- Identify what IDEAL STATE looks like for S3 storage
- Reason about likely vulnerabilities

📜 PLOT THE RAID (PLAN):
- Choose attack vectors based on discovered gaps
- Plan intensity levels for testing

⚔️ READY THE CANNONS (BUILD):
- Generate ISC (Ideal State Criteria) for S3 security
- Each criterion: 8 words, binary, granular, testable
- Examples:
  * "Public access block enabled at bucket level"
  * "Server-side encryption configured using AES-256 standard"
  * "Versioning enabled to prevent data loss scenarios"
  * "Access logging enabled for audit trail compliance"

🏴‍☠️ RAID! (EXECUTE):
- Execute attack vectors (dryRun: true)
- Test S3 security controls under adversarial conditions

💰 TALLY THE SPOILS (VERIFY):
- MARK: Verify each ISC criterion (PASS/FAIL)
- PLUNDER: Extract cryptographic evidence
- CHART: Map findings to MITRE/NIST/SOC2

📖 LOG THE VOYAGE (LEARN):
- ESCAPE: Verify clean state restoration
- Document lessons for next mission

Show your work at each phase. Narrate your pirate strategy while maintaining
professional technical analysis. Let the Algorithm guide you from chaos to evidence.

What treasures do you discover, pirate? 🏴‍☠️
  `.trim();

  console.log("🎯 Mission Brief:");
  console.log(mission);
  console.log("\n" + "=".repeat(80) + "\n");

  try {
    // Execute mission with Algorithm structure
    const result = await agent.executeMission(mission);

    console.log("\n" + "=".repeat(80));
    console.log("\n📊 ALGORITHM EXECUTION COMPLETE\n");
    console.log(result);

    // Show Algorithm execution context
    console.log("\n" + "=".repeat(80));
    console.log("\n🔍 ALGORITHM EXECUTION METRICS:\n");
    const context = agent.getContext();
    console.log(`🔭 SCOUT:  ${context.reconResults.size} reconnaissance operations`);
    console.log(`💰 TALLY:  ${context.markResults.size} drift detection operations`);
    console.log(`🏴‍☠️ RAID:   ${context.raidResults.size} attack operations`);
    console.log(`💎 PLUNDER: ${context.plunderResults.size} evidence extractions`);
    console.log(`🗺️  CHART:  ${context.chartResults.size} compliance mappings`);
    console.log(`📸 SNAPSHOTS: ${context.snapshots.size} state captures`);

    console.log("\n✅ Mission complete! Algorithm phases executed successfully.");
    console.log("\n🏴‍☠️ The Algorithm turns chaos into verifiable evidence.");
    console.log("   From CURRENT STATE (insecure) → IDEAL STATE (proven secure)");
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
