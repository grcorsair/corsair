#!/usr/bin/env bun
/**
 * Standalone MARQUE Verifier CLI
 *
 * Verifies MARQUE document integrity without requiring the full Corsair installation.
 * Supports both v1 (JSON) and v2 (JWT-VC) formats with auto-detection.
 * Only needs the MARQUE file and the issuer's public key.
 *
 * Usage:
 *   bun run bin/corsair-verify.ts --marque ./path.json --pubkey ./key.pub
 *   bun run bin/corsair-verify.ts --marque ./path.jwt --pubkey ./key.pub --verbose
 */

import { readFileSync, existsSync } from "fs";
import { MarqueVerifier } from "../src/parley/marque-verifier";

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
  --marque <PATH>     Path to the MARQUE document (JSON v1 or JWT-VC v2)
  --pubkey <PATH>   Path to the issuer's Ed25519 public key (PEM)
  -v, --verbose     Show detailed verification output
  -h, --help        Show this help message

FORMATS:
  v1 (JSON):  MARQUE document with parley, marque, and signature fields
  v2 (JWT):   JWT-VC string (vc+jwt) with Ed25519 signature

EXIT CODES:
  0  MARQUE is valid
  1  MARQUE is invalid or verification failed
  2  Missing arguments or file not found
`);
}

async function main(): Promise<void> {
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
    const marqueContent = readFileSync(args.marquePath, "utf-8").trim();
    const publicKey = readFileSync(args.pubkeyPath);
    const verifier = new MarqueVerifier([Buffer.from(publicKey)]);

    // Auto-detect format
    const isJWT = marqueContent.startsWith("eyJ") && marqueContent.split(".").length === 3;
    const formatLabel = isJWT ? "v2 (JWT-VC)" : "v1 (JSON)";

    let result;
    if (isJWT) {
      result = await verifier.verify(marqueContent);
    } else {
      const marque = JSON.parse(marqueContent);
      result = await verifier.verify(marque);
    }

    if (args.verbose) {
      console.log("MARQUE Verification Report");
      console.log("========================");
      console.log(`Format:      ${formatLabel}`);
      if (!isJWT) {
        const doc = JSON.parse(marqueContent);
        console.log(`Document ID: ${doc.marque.id}`);
      }
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
      const id = isJWT ? "(JWT-VC)" : JSON.parse(marqueContent).marque.id;
      console.log(`VALID: MARQUE ${id} verified successfully [${formatLabel}]`);
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
