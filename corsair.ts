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
import { Corsair } from "./src/engine/index";
import type { MarkResult, RaidResult, ThreatModelResult } from "./src/types";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve, join, basename, extname } from "path";
import type { ISCState } from "./src/types/isc";
import { ReportGenerator } from "./src/output/report-generator";
import { OSCALGenerator } from "./src/output/oscal-generator";

export type OutputFormat = "jsonl" | "html" | "oscal" | "md" | "all";

/**
 * Result from running demo mode. Contains all pipeline outputs for verification.
 */
export interface DemoResult {
  providersRun: string[];
  threatModels: ThreatModelResult[];
  markResults: MarkResult[];
  raidResults: RaidResult[];
  totalEvidenceRecords: number;
}

interface CLIOptions {
  target?: string;
  service?: "cognito" | "s3";
  source?: "fixture" | "aws";
  output?: string;
  format?: OutputFormat;
  model?: "sonnet" | "haiku" | "auto";
  maxTurns?: number;
  verbose?: boolean;
  help?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    source: "aws",
    format: "jsonl",
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
      case "--format":
      case "-f": {
        const validFormats: OutputFormat[] = ["jsonl", "html", "oscal", "md", "all"];
        if (validFormats.includes(next as OutputFormat)) {
          options.format = next as OutputFormat;
        } else {
          console.error(`❌ Invalid format: ${next}. Must be one of: ${validFormats.join(", ")}`);
          process.exit(1);
        }
        i++;
        break;
      }
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
  -f, --format <FORMAT>   Output format: jsonl | html | oscal | md | all (default: jsonl)
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

/**
 * Format ISC summary for CLI display.
 */
function formatISCSummary(iscPath: string): string {
  if (!existsSync(iscPath)) {
    return "  No ISC tracking data found";
  }

  try {
    const content = readFileSync(iscPath, "utf-8");
    const state: ISCState = JSON.parse(content);

    const lines: string[] = [];
    lines.push("");
    lines.push("ISC (Ideal State Criteria) Summary");
    lines.push("================================");
    lines.push(`Mission ID: ${state.missionId}`);
    lines.push(`Status: ${state.status}`);
    lines.push("");
    lines.push("Criteria Status:");
    lines.push(`  Total:     ${state.satisfaction.total}`);
    lines.push(`  Satisfied: ${state.satisfaction.satisfied}`);
    lines.push(`  Failed:    ${state.satisfaction.failed}`);
    lines.push(`  Pending:   ${state.satisfaction.pending}`);
    lines.push("");
    lines.push(`Satisfaction Rate: ${state.satisfaction.rate}%`);
    lines.push("");
    lines.push(`ISC File: ${iscPath}`);

    // Add criteria details
    if (state.criteria.length > 0) {
      lines.push("");
      lines.push("Criteria Details:");
      for (const criterion of state.criteria) {
        const statusIcon = criterion.satisfaction === "SATISFIED" ? "[PASS]" :
                          criterion.satisfaction === "FAILED" ? "[FAIL]" : "[    ]";
        lines.push(`  ${statusIcon} ${criterion.text}`);
      }
    }

    return lines.join("\n");
  } catch (error) {
    return `  Error reading ISC file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Generate reports in the specified format(s) after mission completes.
 */
function generateReports(
  format: OutputFormat,
  basePath: string,
  agent: CorsairAgent
): string[] {
  const context = agent.getContext();
  const reportGen = new ReportGenerator();
  const oscalGen = new OSCALGenerator();
  const generatedFiles: string[] = [];

  // Collect data from agent context
  const findings = Array.from(context.markResults.values()).flatMap((m) => m.findings);
  const raidResults = Array.from(context.raidResults.values());
  const chartResults = Array.from(context.chartResults.values());

  // Use first chart result or create a placeholder
  const chartResult = chartResults[0] || {
    mitre: { technique: "N/A", name: "N/A", tactic: "N/A", description: "No chart result" },
    nist: { function: "N/A", category: "N/A", controls: [] },
    soc2: { principle: "N/A", criteria: [], description: "No chart result" },
  };

  // Load ISC criteria if available
  let iscCriteria: { text: string; satisfaction: string }[] = [];
  const missionId = agent.getMissionId();
  if (missionId) {
    const iscPath = agent.getISCPath();
    if (existsSync(iscPath)) {
      try {
        const state: ISCState = JSON.parse(readFileSync(iscPath, "utf-8"));
        iscCriteria = state.criteria.map((c) => ({
          text: c.text,
          satisfaction: c.satisfaction,
        }));
      } catch {}
    }
  }

  const plunderResults = Array.from(context.plunderResults.values());
  const plunderResult = plunderResults[0];

  // Base path without extension
  const dir = dirname(basePath);
  const base = basename(basePath, extname(basePath));
  const pathFor = (ext: string) => join(dir, `${base}.${ext}`);

  const reportOptions = {
    title: "Corsair Assessment Report",
    findings,
    chartResult,
    raidResults,
    plunderResult,
    iscCriteria,
  };

  const formats: OutputFormat[] = format === "all" ? ["jsonl", "html", "oscal", "md"] : [format];

  for (const fmt of formats) {
    switch (fmt) {
      case "html": {
        const html = reportGen.generateHTML(reportOptions);
        const htmlPath = pathFor("html");
        mkdirSync(dirname(htmlPath), { recursive: true });
        writeFileSync(htmlPath, html, "utf-8");
        generatedFiles.push(htmlPath);
        break;
      }
      case "oscal": {
        const oscalResult = oscalGen.generate({
          findings,
          chartResult,
          raidResults,
          iscCriteria,
        });
        const oscalPath = pathFor("oscal.json");
        mkdirSync(dirname(oscalPath), { recursive: true });
        writeFileSync(oscalPath, oscalGen.toJSON(oscalResult), "utf-8");
        generatedFiles.push(oscalPath);
        break;
      }
      case "md": {
        const md = reportGen.generateMarkdown(reportOptions);
        const mdPath = pathFor("md");
        mkdirSync(dirname(mdPath), { recursive: true });
        writeFileSync(mdPath, md, "utf-8");
        generatedFiles.push(mdPath);
        break;
      }
      case "jsonl":
        // JSONL is already written by PLUNDER — just note the path
        generatedFiles.push(basePath);
        break;
    }
  }

  return generatedFiles;
}

/**
 * Demo provider configurations.
 * Each entry maps a provider ID to the service type and a fixture target ID
 * used by the ReconEngine's fixture mode.
 */
const DEMO_PROVIDERS: { provider: string; service: "cognito" | "s3" | "iam" | "lambda" | "rds"; targetId: string }[] = [
  { provider: "aws-cognito", service: "cognito", targetId: "demo-user-pool" },
  { provider: "aws-s3", service: "s3", targetId: "demo-bucket" },
  { provider: "aws-iam", service: "iam", targetId: "demo-account" },
  { provider: "aws-lambda", service: "lambda", targetId: "demo-function" },
  { provider: "aws-rds", service: "rds", targetId: "demo-db" },
];

/**
 * Run the full CORSAIR demo pipeline on fixture data for all providers.
 * No ANTHROPIC_API_KEY or LLM agent required.
 *
 * For each provider: recon (fixture) -> threatModel -> autoMark -> raid (dryRun) -> plunder -> chart
 */
export async function runDemo(options: {
  outputPath: string;
  format: OutputFormat;
}): Promise<DemoResult> {
  const { outputPath, format } = options;

  // Ensure output directory exists
  const dir = dirname(resolve(outputPath));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const corsair = new Corsair({ evidencePath: outputPath });

  const providersRun: string[] = [];
  const threatModels: ThreatModelResult[] = [];
  const allMarkResults: MarkResult[] = [];
  const allRaidResults: RaidResult[] = [];
  let totalEvidenceRecords = 0;

  // Reset evidence engine so all providers write to the same file cleanly
  corsair.resetEvidence();

  for (const { provider, service, targetId } of DEMO_PROVIDERS) {
    // 1. RECON (fixture mode)
    const reconResult = await corsair.recon(targetId, { source: "fixture", service });
    const snapshot = reconResult.snapshot as Record<string, unknown>;

    // 2. THREAT MODEL (SPYGLASS)
    const tm = await corsair.threatModel(snapshot, provider);
    threatModels.push(tm);

    // 3. AUTO MARK (threat-driven expectations -> drift detection)
    const markResult = await corsair.autoMark(snapshot, provider);
    allMarkResults.push(markResult);

    // 4. RAID (dryRun for each attack vector from threat model)
    const raidOptionsList = corsair.autoRaid(snapshot, tm);
    for (const raidOpts of raidOptionsList) {
      const raidResult = await corsair.raid(snapshot, {
        ...raidOpts,
        dryRun: true,
      });
      allRaidResults.push(raidResult);

      // 5. PLUNDER (extract evidence)
      const plunderResult = await corsair.plunder(raidResult, outputPath);
      totalEvidenceRecords += plunderResult.eventCount;
    }

    // 6. CHART (map findings to compliance frameworks)
    if (markResult.findings.length > 0) {
      await corsair.chart(markResult.findings, { providerId: provider });
    }

    providersRun.push(provider);
  }

  return {
    providersRun,
    threatModels,
    markResults: allMarkResults,
    raidResults: allRaidResults,
    totalEvidenceRecords,
  };
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
  console.log(`📄 Format:  ${options.format}`);
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

    // Show ISC summary if available
    const missionId = agent.getMissionId();
    if (missionId) {
      const iscPath = agent.getISCPath();
      console.log("\n" + "=".repeat(80));
      console.log("\n📋 " + formatISCSummary(iscPath));
    }

    // Generate reports based on --format flag
    if (options.format && options.format !== "jsonl") {
      console.log("\n" + "=".repeat(80));
      console.log("\n📄 GENERATING REPORTS:\n");
      const reportFiles = generateReports(options.format, outputPath, agent);
      for (const file of reportFiles) {
        console.log(`  📝 ${file}`);
      }
    }

    console.log("\n" + "=".repeat(80));
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

export { main, parseArgs, generateReports };
