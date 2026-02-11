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

import { parseSOC2 } from "./soc2-parser";
import { parseJSON } from "./json-parser";
import { mapToMarqueInput } from "./mapper";
import { MarqueGenerator } from "../parley/marque-generator";
import { MarqueKeyManager } from "../parley/marque-key-manager";
import { MarqueVerifier } from "../parley/marque-verifier";
import { ReceiptChain } from "../parley/receipt-chain";
import { hashData } from "../parley/process-receipt";
import type { IngestedDocument } from "./types";

// =============================================================================
// CLI ARGS
// =============================================================================

export interface IngestArgs {
  file?: string;
  type: "soc2" | "iso27001" | "prowler" | "securityhub" | "json" | "manual";
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
  -t, --type <TYPE>     Document type: soc2 (default), json, prowler, securityhub, iso27001, manual
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

  if (!(await Bun.file(args.file).exists())) {
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
    case "json":
    case "prowler":
    case "securityhub": {
      const rawText = await Bun.file(args.file).text();
      const sourceOverride = args.type !== "json" ? args.type : undefined;
      ingested = parseJSON(rawText, sourceOverride ? { source: sourceOverride } : undefined);
      break;
    }
    default:
      console.error(`Error: Document type "${args.type}" is not yet supported.`);
      console.error("Supported: soc2, json, prowler, securityhub");
      process.exit(2);
      throw new Error("unreachable");
  }

  console.log(`      Title:    ${ingested.metadata.title}`);
  console.log(`      Issuer:   ${ingested.metadata.issuer}`);
  console.log(`      Controls: ${ingested.controls.length} extracted`);
  console.log(`      Effective:    ${ingested.controls.filter(c => c.status === "effective").length}`);
  console.log(`      Ineffective:  ${ingested.controls.filter(c => c.status === "ineffective").length}`);
  console.log(`      Not tested:   ${ingested.controls.filter(c => c.status === "not-tested").length}`);

  // Initialize process receipt chain
  const keyManager = new MarqueKeyManager();
  let keypair = await keyManager.loadKeypair();
  if (!keypair) {
    keypair = await keyManager.generateKeypair();
    console.log("      Generated new Ed25519 keypair");
  }

  const chain = new ReceiptChain(keypair.privateKey.toString());

  // Receipt 1: INGEST (non-deterministic — Claude extraction)
  await chain.captureStep({
    step: "ingest",
    inputData: { fileHash: ingested.metadata.rawTextHash, filename },
    outputData: { controls: ingested.controls.map(c => ({ id: c.id, status: c.status })) },
    reproducible: false,
    llmAttestation: {
      model: args.model || "claude-sonnet-4-5-20250929",
      promptDigest: hashData("Extract controls from SOC 2 report"),
      temperature: 0,
    },
  });

  // 2. Map to MarqueGeneratorInput
  console.log(`\n[2/5] Mapping to CPOE input...`);
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

  // Receipt 2: CLASSIFY (deterministic)
  await chain.captureStep({
    step: "classify",
    inputData: ingested,
    outputData: input.document,
    reproducible: true,
    codeVersion: "assurance-calculator@2026-02-09",
  });

  // Receipt 3: CHART (deterministic)
  await chain.captureStep({
    step: "chart",
    inputData: ingested.controls.map(c => c.frameworkRefs),
    outputData: input.chartResults,
    reproducible: true,
    codeVersion: "chart-engine@1.0",
  });

  // Pass receipts to CPOE generator
  input.processReceipts = chain.getReceipts();

  // 3. Generate CPOE
  console.log(`\n[3/5] Generating ${args.format === "vc" ? "JWT-VC" : "JSON"} CPOE...`);

  const generator = new MarqueGenerator(keyManager, {
    expiryDays: 90,
    format: args.format,
  });

  const output = await generator.generateOutput(input);
  console.log(`      MARQUE ID: ${output.marqueId}`);

  // Receipt 4: MARQUE (deterministic signing)
  await chain.captureStep({
    step: "marque",
    inputData: { receiptChainDigest: chain.getChainDigest() },
    outputData: { cpoeHash: hashData(output.jwt || JSON.stringify(output.v1)) },
    reproducible: true,
    codeVersion: "vc-generator@2.1",
  });

  const receipts = chain.getReceipts();
  const reproducibleCount = receipts.filter(r => r.predicate.reproducible).length;
  const attestedCount = receipts.filter(r => r.predicate.llmAttestation).length;
  console.log(`\n[4/5] Process provenance: ${receipts.length} receipts (${reproducibleCount} reproducible, ${attestedCount} attested)`);

  // 5. Verify
  console.log(`\n[5/5] Verifying CPOE...`);
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
    await Bun.write(args.output, content);
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
