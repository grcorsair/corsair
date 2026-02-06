#!/usr/bin/env bun
/**
 * Standalone CPOE Verifier CLI
 *
 * Verifies CPOE document integrity without requiring the full Corsair installation.
 * Only needs the CPOE JSON file and the issuer's public key.
 *
 * Usage:
 *   bun run bin/corsair-verify.ts --cpoe ./path.json --pubkey ./key.pub
 *   bun run bin/corsair-verify.ts --cpoe ./path.json --pubkey ./key.pub --verbose
 */

import { readFileSync, existsSync } from "fs";
import { CPOEVerifier } from "../src/parley/cpoe-verifier";
import type { CPOEDocument } from "../src/parley/cpoe-types";

interface VerifyArgs {
  cpoePath?: string;
  pubkeyPath?: string;
  verbose?: boolean;
  help?: boolean;
}

function parseArgs(): VerifyArgs {
  const args = process.argv.slice(2);
  const result: VerifyArgs = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--cpoe":
        result.cpoePath = args[++i];
        break;
      case "--pubkey":
        result.pubkeyPath = args[++i];
        break;
      case "--verbose":
      case "-v":
        result.verbose = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
CORSAIR CPOE Verifier

USAGE:
  bun run bin/corsair-verify.ts --cpoe <path> --pubkey <path>

OPTIONS:
  --cpoe <PATH>     Path to the CPOE JSON document
  --pubkey <PATH>   Path to the issuer's Ed25519 public key (PEM)
  -v, --verbose     Show detailed verification output
  -h, --help        Show this help message

EXIT CODES:
  0  CPOE is valid
  1  CPOE is invalid or verification failed
  2  Missing arguments or file not found
`);
}

function main(): void {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.cpoePath || !args.pubkeyPath) {
    console.error("Error: Both --cpoe and --pubkey are required");
    console.error("Run with --help for usage information");
    process.exit(2);
  }

  if (!existsSync(args.cpoePath)) {
    console.error(`Error: CPOE file not found: ${args.cpoePath}`);
    process.exit(2);
  }

  if (!existsSync(args.pubkeyPath)) {
    console.error(`Error: Public key file not found: ${args.pubkeyPath}`);
    process.exit(2);
  }

  try {
    const cpoeContent = readFileSync(args.cpoePath, "utf-8");
    const cpoe: CPOEDocument = JSON.parse(cpoeContent);
    const publicKey = readFileSync(args.pubkeyPath);

    const verifier = new CPOEVerifier([Buffer.from(publicKey)]);
    const result = verifier.verify(cpoe);

    if (args.verbose) {
      console.log("CPOE Verification Report");
      console.log("========================");
      console.log(`Document ID: ${cpoe.cpoe.id}`);
      console.log(`Issuer:      ${result.signedBy || "unknown"}`);
      console.log(`Generated:   ${result.generatedAt || "unknown"}`);
      console.log(`Expires:     ${result.expiresAt || "unknown"}`);
      console.log(`Valid:       ${result.valid}`);
      if (result.reason) {
        console.log(`Reason:      ${result.reason}`);
      }
      console.log();
    }

    if (result.valid) {
      console.log(`VALID: CPOE ${cpoe.cpoe.id} verified successfully`);
      process.exit(0);
    } else {
      console.error(`INVALID: ${result.reason}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { main, parseArgs };
