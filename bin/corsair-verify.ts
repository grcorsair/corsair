#!/usr/bin/env bun
/**
 * Standalone MARQUE Verifier CLI
 *
 * Verifies MARQUE document integrity without requiring the full Corsair installation.
 * Only needs the MARQUE JSON file and the issuer's public key.
 *
 * Usage:
 *   bun run bin/corsair-verify.ts --marque ./path.json --pubkey ./key.pub
 *   bun run bin/corsair-verify.ts --marque ./path.json --pubkey ./key.pub --verbose
 */

import { readFileSync, existsSync } from "fs";
import { MarqueVerifier } from "../src/parley/marque-verifier";
import type { MarqueDocument } from "../src/parley/marque-types";

interface VerifyArgs {
  marquePath?: string;
  pubkeyPath?: string;
  verbose?: boolean;
  help?: boolean;
}

function parseArgs(): VerifyArgs {
  const args = process.argv.slice(2);
  const result: VerifyArgs = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--marque":
        result.marquePath = args[++i];
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
CORSAIR MARQUE Verifier

USAGE:
  bun run bin/corsair-verify.ts --marque <path> --pubkey <path>

OPTIONS:
  --marque <PATH>     Path to the MARQUE JSON document
  --pubkey <PATH>   Path to the issuer's Ed25519 public key (PEM)
  -v, --verbose     Show detailed verification output
  -h, --help        Show this help message

EXIT CODES:
  0  MARQUE is valid
  1  MARQUE is invalid or verification failed
  2  Missing arguments or file not found
`);
}

function main(): void {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.marquePath || !args.pubkeyPath) {
    console.error("Error: Both --marque and --pubkey are required");
    console.error("Run with --help for usage information");
    process.exit(2);
  }

  if (!existsSync(args.marquePath)) {
    console.error(`Error: MARQUE file not found: ${args.marquePath}`);
    process.exit(2);
  }

  if (!existsSync(args.pubkeyPath)) {
    console.error(`Error: Public key file not found: ${args.pubkeyPath}`);
    process.exit(2);
  }

  try {
    const marqueContent = readFileSync(args.marquePath, "utf-8");
    const marque: MarqueDocument = JSON.parse(marqueContent);
    const publicKey = readFileSync(args.pubkeyPath);

    const verifier = new MarqueVerifier([Buffer.from(publicKey)]);
    const result = verifier.verify(marque);

    if (args.verbose) {
      console.log("MARQUE Verification Report");
      console.log("========================");
      console.log(`Document ID: ${marque.marque.id}`);
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
      console.log(`VALID: MARQUE ${marque.marque.id} verified successfully`);
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
