#!/usr/bin/env bun
/**
 * CORSAIR CLI - Command-line interface for autonomous security testing
 *
 * Usage:
 *   corsair [options]
 *   corsair --target <id> --service <type> --output <path>
 *   corsair --help
 *
 * Examples:
 *   # Default output path (./evidence/corsair-{timestamp}.jsonl)
 *   corsair --target us-west-2_ABC123 --service cognito
 *
 *   # Custom output path
 *   corsair --target my-bucket --service s3 --output ./audits/q1-2025/s3-audit.jsonl
 *
 *   # CI/CD integration
 *   corsair --target prod-pool --service cognito --output /var/jenkins/evidence/cognito-$BUILD_ID.jsonl
 */

import { CorsairAgent } from "./src/agents/corsair-agent";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

interface CLIOptions {
  target?: string;
  service?: "cognito" | "s3";
  source?: "fixture" | "aws";
  output?: string;
  model?: "sonnet" | "haiku" | "auto";
  maxTurns?: number;
  verbose?: boolean;
  help?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    source: "aws",
    model: "sonnet",
    maxTurns: 20,
    verbose: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--target":
      case "-t":
        options.target = next;
        i++;
        break;
      case "--service":
      case "-s":
        if (next === "cognito" || next === "s3") {
          options.service = next;
        } else {
          console.error(`❌ Invalid service: ${next}. Must be 'cognito' or 's3'`);
          process.exit(1);
        }
        i++;
        break;
      case "--source":
        if (next === "fixture" || next === "aws") {
          options.source = next;
        } else {
          console.error(`❌ Invalid source: ${next}. Must be 'fixture' or 'aws'`);
          process.exit(1);
        }
        i++;
        break;
      case "--output":
      case "-o":
        options.output = next;
        i++;
        break;
      case "--model":
      case "-m":
        if (next === "sonnet" || next === "haiku" || next === "auto") {
          options.model = next;
        } else {
          console.error(`❌ Invalid model: ${next}. Must be 'sonnet', 'haiku', or 'auto'`);
          process.exit(1);
        }
        i++;
        break;
      case "--max-turns":
        const turns = parseInt(next, 10);
        if (!isNaN(turns) && turns > 0) {
          options.maxTurns = turns;
        } else {
          console.error(`❌ Invalid max-turns: ${next}. Must be a positive number`);
          process.exit(1);
        }
        i++;
        break;
      case "--quiet":
      case "-q":
        options.verbose = false;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`❌ Unknown option: ${arg}`);
          console.error("Run 'corsair --help' for usage information");
          process.exit(1);
        }
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
🏴‍☠️ CORSAIR - Autonomous Security Testing Agent

USAGE:
  corsair [OPTIONS]

OPTIONS:
  -t, --target <ID>       Target resource ID (User Pool ID or Bucket name)
  -s, --service <TYPE>    Service type: cognito | s3
      --source <SOURCE>   Data source: aws | fixture (default: aws)
  -o, --output <PATH>     Custom evidence output path (default: ./evidence/corsair-{timestamp}.jsonl)
  -m, --model <MODEL>     Model selection: sonnet | haiku | auto (default: sonnet)
      --max-turns <NUM>   Maximum agent turns (default: 20)
  -q, --quiet             Suppress verbose output
  -h, --help              Show this help message

EXAMPLES:
  # Test Cognito User Pool with default output
  corsair --target us-west-2_ABC123 --service cognito

  # Test S3 bucket with custom output path
  corsair --target my-bucket --service s3 --output ./audits/s3-test.jsonl

  # CI/CD integration with custom path
  corsair --target prod-pool --service cognito --output /var/jenkins/evidence/\${BUILD_ID}.jsonl

  # Use fixture data for testing
  corsair --target test-pool --service cognito --source fixture

ENVIRONMENT:
  ANTHROPIC_API_KEY      Required: Your Anthropic API key
  AWS_REGION             Optional: AWS region (default: us-west-2)
  AWS_PROFILE            Optional: AWS profile for authentication

OUTPUT:
  Evidence files are written in JSONL format with SHA-256 hash chains.
  Each line is a JSON object representing a security event.

LEARN MORE:
  https://github.com/yourusername/corsair
`);
}

function generateDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `./evidence/corsair-${timestamp}.jsonl`;
}

function validateOutputPath(outputPath: string): void {
  const absolutePath = resolve(outputPath);
  const dir = dirname(absolutePath);

  // Ensure parent directory exists
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
      console.log(`📁 Created output directory: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create output directory: ${dir}`);
      console.error(error);
      process.exit(1);
    }
  }

  // Check if file already exists (warn but don't block)
  if (existsSync(absolutePath)) {
    console.warn(`⚠️  Output file already exists: ${absolutePath}`);
    console.warn(`   Evidence will be appended to existing file`);
  }
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Validate required options
  if (!options.target) {
    console.error("❌ Error: --target is required");
    console.error("Run 'corsair --help' for usage information");
    process.exit(1);
  }

  if (!options.service) {
    console.error("❌ Error: --service is required");
    console.error("Run 'corsair --help' for usage information");
    process.exit(1);
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: ANTHROPIC_API_KEY environment variable not set");
    console.error("\nSet your API key:");
    console.error("  export ANTHROPIC_API_KEY=your_key_here");
    process.exit(1);
  }

  // Determine output path
  const outputPath = options.output || generateDefaultOutputPath();
  validateOutputPath(outputPath);

  console.log("🏴‍☠️ CORSAIR AUTONOMOUS SECURITY AGENT\n");
  console.log(`🎯 Target:  ${options.target}`);
  console.log(`📦 Service: ${options.service}`);
  console.log(`📊 Source:  ${options.source}`);
  console.log(`📁 Output:  ${outputPath}`);
  console.log(`🤖 Model:   ${options.model}`);
  console.log("");

  // Create agent
  const agent = new CorsairAgent({
    apiKey,
    maxTurns: options.maxTurns,
    model: options.model,
    verbose: options.verbose,
  });

  // Build mission with custom output path
  const mission = `
Ahoy! Your mission is to test the security of a ${options.service.toUpperCase()} resource.

Target: ${options.target}
Service: ${options.service}
Source: ${options.source}

**CRITICAL INSTRUCTION - Evidence Output Path:**
When you execute the PLUNDER primitive to extract evidence, you MUST use this EXACT path:
evidencePath: "${outputPath}"

Do NOT generate a custom path. Use the path provided above.

Execute the complete security testing cycle:

🔭 SCOUT (RECON):
- Gather intelligence on the ${options.service} resource
- Document current security configuration

🧭 ANALYZE (THINK):
- Apply your security knowledge for ${options.service}
- Identify ideal security state
- Reason about potential vulnerabilities

📜 PLAN (STRATEGY):
- Choose attack vectors based on discovered gaps
- Plan testing intensity

⚔️ PREPARE (BUILD):
- Generate security expectations (ISC criteria)
- Each criterion: 8 words, binary, testable

🏴‍☠️ ATTACK (RAID):
- Execute attack vectors (dryRun: true)
- Test security controls under adversarial conditions

💰 EXTRACT (VERIFY):
- MARK: Verify each security criterion (PASS/FAIL)
- PLUNDER: Extract cryptographic evidence to "${outputPath}"
- CHART: Map findings to compliance frameworks

📖 REPORT (LEARN):
- ESCAPE: Verify clean state restoration
- Document lessons learned

Execute your mission with professional precision, pirate! 🏴‍☠️
  `.trim();

  try {
    // Execute mission
    const result = await agent.executeMission(mission);

    console.log("\n" + "=".repeat(80));
    console.log("\n📊 MISSION COMPLETE\n");
    console.log(result);

    // Show execution metrics
    console.log("\n" + "=".repeat(80));
    console.log("\n🔍 EXECUTION METRICS:\n");
    const context = agent.getContext();
    console.log(`🔭 RECON:   ${context.reconResults.size} operations`);
    console.log(`💰 MARK:    ${context.markResults.size} drift checks`);
    console.log(`🏴‍☠️ RAID:    ${context.raidResults.size} attacks`);
    console.log(`💎 PLUNDER: ${context.plunderResults.size} evidence extractions`);
    console.log(`🗺️  CHART:   ${context.chartResults.size} compliance mappings`);

    console.log(`\n✅ Evidence written to: ${outputPath}`);
    console.log("\n🏴‍☠️ Mission successful! Fair winds and following seas.");
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

export { main, parseArgs };
