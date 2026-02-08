/**
 * Ingestion CLI — Document → CPOE Pipeline
 *
 * CLI handler for the `ingest` subcommand.
 *
 * Usage:
 *   bun run corsair.ts ingest --file report.pdf --type soc2
 *   bun run corsair.ts ingest --file report.pdf --type soc2 --did "did:web:acme.com"
 *   bun run corsair.ts ingest --file report.pdf --type soc2 --output ./cpoe.jwt --format vc
 */

import * as fs from "fs";
import { parseSOC2 } from "./soc2-parser";
import { mapToMarqueInput } from "./mapper";
import { MarqueGenerator } from "../parley/marque-generator";
import { MarqueKeyManager } from "../parley/marque-key-manager";
import { MarqueVerifier } from "../parley/marque-verifier";
import type { IngestedDocument } from "./types";

// =============================================================================
// CLI ARGS
// =============================================================================

export interface IngestArgs {
  file?: string;
  type: "soc2" | "iso27001" | "prowler" | "manual";
  did?: string;
  output?: string;
  format: "v1" | "vc";
  model?: string;
  help: boolean;
}

export function parseIngestArgs(argv: string[]): IngestArgs {
  const result: IngestArgs = { type: "soc2", format: "vc", help: false };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--file":
      case "-f":
        result.file = argv[++i];
        break;
      case "--type":
      case "-t":
        result.type = argv[++i] as IngestArgs["type"];
        break;
      case "--did":
        result.did = argv[++i];
        break;
      case "--output":
      case "-o":
        result.output = argv[++i];
        break;
      case "--format":
        result.format = argv[++i] as "v1" | "vc";
        break;
      case "--model":
      case "-m":
        result.model = argv[++i];
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
    }
  }

  return result;
}

export function printIngestHelp(): void {
  console.log(`
CORSAIR INGEST — Document → CPOE Pipeline

USAGE:
  bun run corsair.ts ingest --file <path> [OPTIONS]

OPTIONS:
  -f, --file <PATH>     Path to the document (PDF, JSON, CSV)
  -t, --type <TYPE>     Document type: soc2 (default), iso27001, prowler, manual
  --did <DID>           Issuer DID (e.g., "did:web:yourdomain.com")
  -o, --output <PATH>   Write CPOE to file (default: stdout)
  --format <v1|vc>      Output format: JWT-VC (default) or JSON envelope
  -m, --model <MODEL>   Claude model for extraction (default: claude-sonnet-4-5-20250929)
  -h, --help            Show this help

EXAMPLES:
  bun run corsair.ts ingest --file ./soc2-report.pdf
  bun run corsair.ts ingest -f ./soc2.pdf --did "did:web:acme.com" -o cpoe.jwt
  bun run corsair.ts ingest -f ./prowler.json -t prowler -o cpoe.jwt
`);
}

// =============================================================================
// INGEST COMMAND
// =============================================================================

export async function runIngest(args: IngestArgs): Promise<void> {
  if (args.help) {
    printIngestHelp();
    return;
  }

  if (!args.file) {
    console.error("Error: --file is required");
    console.error('Run "bun run corsair.ts ingest --help" for usage');
    process.exit(2);
  }

  if (!fs.existsSync(args.file)) {
    console.error(`Error: File not found: ${args.file}`);
    process.exit(2);
  }

  const filename = args.file.split("/").pop() || args.file;
  console.log("CORSAIR INGEST");
  console.log("==============\n");

  // 1. Parse document
  console.log(`[1/4] Parsing ${args.type.toUpperCase()} document: ${filename}`);
  let ingested: IngestedDocument;

  switch (args.type) {
    case "soc2":
      ingested = await parseSOC2(args.file, { model: args.model });
      break;
    default:
      console.error(`Error: Document type "${args.type}" is not yet supported.`);
      console.error("Supported: soc2");
      process.exit(2);
      throw new Error("unreachable");
  }

  console.log(`      Title:    ${ingested.metadata.title}`);
  console.log(`      Issuer:   ${ingested.metadata.issuer}`);
  console.log(`      Controls: ${ingested.controls.length} extracted`);
  console.log(`      Effective:    ${ingested.controls.filter(c => c.status === "effective").length}`);
  console.log(`      Ineffective:  ${ingested.controls.filter(c => c.status === "ineffective").length}`);
  console.log(`      Not tested:   ${ingested.controls.filter(c => c.status === "not-tested").length}`);

  // 2. Map to MarqueGeneratorInput
  console.log(`\n[2/4] Mapping to CPOE input...`);
  const input = mapToMarqueInput(ingested, { did: args.did });
  const frameworks = new Set<string>();
  for (const chart of input.chartResults) {
    if (chart.frameworks) {
      for (const fw of Object.keys(chart.frameworks)) {
        frameworks.add(fw);
      }
    }
  }
  console.log(`      Frameworks: ${[...frameworks].join(", ") || "none"}`);

  // 3. Generate CPOE
  console.log(`\n[3/4] Generating ${args.format === "vc" ? "JWT-VC" : "JSON"} CPOE...`);
  const keyManager = new MarqueKeyManager();
  let keypair = await keyManager.loadKeypair();
  if (!keypair) {
    keypair = await keyManager.generateKeypair();
    console.log("      Generated new Ed25519 keypair");
  }

  const generator = new MarqueGenerator(keyManager, {
    expiryDays: 90,
    format: args.format,
  });

  const output = await generator.generateOutput(input);
  console.log(`      MARQUE ID: ${output.marqueId}`);

  // 4. Verify
  console.log(`\n[4/4] Verifying CPOE...`);
  const verifier = new MarqueVerifier([keypair.publicKey]);
  const verification = args.format === "vc"
    ? await verifier.verify(output.jwt!)
    : await verifier.verify(output.v1!);

  if (!verification.valid) {
    console.error(`      VERIFICATION FAILED: ${verification.reason}`);
    process.exit(1);
  }
  console.log("      VERIFIED: Signature valid, document intact.");

  // 5. Output
  const content = args.format === "vc"
    ? output.jwt!
    : JSON.stringify(output.v1!, null, 2);

  if (args.output) {
    fs.writeFileSync(args.output, content);
    console.log(`\nCPOE written to: ${args.output}`);
  } else {
    console.log("\n--- CPOE ---");
    console.log(content);
    console.log("--- END ---");
  }

  // Summary
  console.log("\n==============");
  console.log("INGEST SUMMARY");
  console.log("==============");
  console.log(`Source:       ${ingested.metadata.title}`);
  console.log(`Controls:     ${ingested.controls.length}`);
  console.log(`Frameworks:   ${[...frameworks].join(", ")}`);
  console.log(`Format:       ${args.format === "vc" ? "JWT-VC" : "JSON Envelope"}`);
  console.log(`Verified:     YES`);
  if (ingested.assessmentContext?.gaps?.length) {
    console.log(`Gaps noted:   ${ingested.assessmentContext.gaps.length}`);
  }
  console.log(`\nVerify at: grcorsair.com/marque`);
}
