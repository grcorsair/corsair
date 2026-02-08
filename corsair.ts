#!/usr/bin/env bun
/**
 * CORSAIR CLI — CPOE Ingestion & Trust Exchange
 *
 * Usage:
 *   corsair ingest --file <path> [--type soc2] [--did <did>] [--output <path>] [--format vc|v1]
 *   corsair verify --file <cpoe.jwt> [--pubkey <path>]
 *   corsair keygen [--output <dir>]
 *   corsair help
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";

// =============================================================================
// SUBCOMMAND ROUTING
// =============================================================================

const subcommand = process.argv[2];

switch (subcommand) {
  case "ingest":
    await handleIngest();
    break;
  case "verify":
    await handleVerify();
    break;
  case "keygen":
    await handleKeygen();
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${subcommand}`);
    console.error('Run "corsair help" for usage information');
    process.exit(1);
}

// =============================================================================
// INGEST
// =============================================================================

async function handleIngest(): Promise<void> {
  const { parseIngestArgs, runIngest } = await import("./src/ingestion/cli");
  const args = parseIngestArgs(process.argv.slice(3));
  await runIngest(args);
}

// =============================================================================
// VERIFY
// =============================================================================

async function handleVerify(): Promise<void> {
  const args = process.argv.slice(3);
  let filePath: string | undefined;
  let pubkeyPath: string | undefined;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--file":
      case "-f":
        filePath = args[++i];
        break;
      case "--pubkey":
      case "-k":
        pubkeyPath = args[++i];
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR VERIFY — Verify a CPOE (JWT-VC or JSON envelope)

USAGE:
  corsair verify --file <path> [--pubkey <path>]

OPTIONS:
  -f, --file <PATH>     Path to the CPOE file (JWT or JSON)
  -k, --pubkey <PATH>   Path to Ed25519 public key PEM (default: ./keys/corsair-signing.pub)
  -h, --help            Show this help
`);
    return;
  }

  if (!filePath) {
    console.error("Error: --file is required");
    console.error('Run "corsair verify --help" for usage');
    process.exit(2);
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(2);
  }

  // Load public key
  const keyPath = pubkeyPath || "./keys/corsair-signing.pub";
  if (!existsSync(keyPath)) {
    console.error(`Error: Public key not found: ${keyPath}`);
    console.error("Generate keys with: corsair keygen");
    process.exit(2);
  }

  const { MarqueVerifier } = await import("./src/parley/marque-verifier");
  const publicKey = readFileSync(keyPath);

  const verifier = new MarqueVerifier([publicKey]);
  const content = readFileSync(filePath, "utf-8").trim();

  // Auto-detect format (JWT starts with eyJ, JSON starts with {)
  let result;
  if (content.startsWith("eyJ")) {
    result = await verifier.verify(content);
  } else {
    const doc = JSON.parse(content);
    result = await verifier.verify(doc);
  }

  if (result.valid) {
    console.log("VERIFIED");
    console.log(`  Signed by: ${result.signedBy || "Unknown"}`);
    console.log(`  Format:    ${content.startsWith("eyJ") ? "JWT-VC" : "JSON Envelope"}`);
    process.exit(0);
  } else {
    console.error("VERIFICATION FAILED");
    console.error(`  Reason: ${result.reason}`);
    process.exit(1);
  }
}

// =============================================================================
// KEYGEN
// =============================================================================

async function handleKeygen(): Promise<void> {
  const args = process.argv.slice(3);
  let outputDir = "./keys";
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--output":
      case "-o":
        outputDir = args[++i];
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR KEYGEN — Generate Ed25519 signing keypair

USAGE:
  corsair keygen [--output <dir>]

OPTIONS:
  -o, --output <DIR>    Output directory (default: ./keys)
  -h, --help            Show this help
`);
    return;
  }

  const { MarqueKeyManager } = await import("./src/parley/marque-key-manager");
  const keyManager = new MarqueKeyManager(outputDir);

  const existing = await keyManager.loadKeypair();
  if (existing) {
    console.log(`Keypair already exists in ${outputDir}`);
    console.log("Delete existing keys to generate new ones.");
    return;
  }

  const keypair = await keyManager.generateKeypair();
  console.log("Ed25519 keypair generated:");
  console.log(`  Private key: ${outputDir}/corsair-signing.key`);
  console.log(`  Public key:  ${outputDir}/corsair-signing.pub`);
}

// =============================================================================
// HELP
// =============================================================================

function printHelp(): void {
  console.log(`
CORSAIR — CPOE Ingestion & Trust Exchange Platform

USAGE:
  corsair <command> [options]

COMMANDS:
  ingest    Parse a compliance document and generate a CPOE
  verify    Verify a CPOE signature and integrity
  keygen    Generate Ed25519 signing keypair
  help      Show this help message

EXAMPLES:
  corsair ingest --file soc2-report.pdf
  corsair ingest --file soc2.pdf --did "did:web:acme.com" --output cpoe.jwt
  corsair verify --file cpoe.jwt --pubkey keys/corsair-signing.pub
  corsair keygen --output ./my-keys

VERSION: 0.3.0
`);
}
