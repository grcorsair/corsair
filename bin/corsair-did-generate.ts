#!/usr/bin/env bun
/**
 * CORSAIR DID Document Generator
 *
 * Generates a DID document from the current Ed25519 signing key.
 * Output can be written to stdout or a file for hosting at .well-known/did.json
 *
 * Usage:
 *   bun run bin/corsair-did-generate.ts
 *   bun run bin/corsair-did-generate.ts --domain grcorsair.com
 *   bun run bin/corsair-did-generate.ts --domain grcorsair.com --output ./did.json
 *   bun run bin/corsair-did-generate.ts --key-dir /path/to/keys
 */

import { writeFileSync } from "fs";
import { MarqueKeyManager } from "../src/parley/marque-key-manager";

export interface DIDGenerateArgs {
  domain: string;
  output?: string;
  keyDir?: string;
  help?: boolean;
}

export function parseArgs(): DIDGenerateArgs {
  const args = process.argv.slice(2);
  const result: DIDGenerateArgs = {
    domain: "grcorsair.com",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--domain":
        result.domain = args[++i];
        break;
      case "--output":
      case "-o":
        result.output = args[++i];
        break;
      case "--key-dir":
        result.keyDir = args[++i];
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
CORSAIR DID Document Generator

Generates a DID document from the current Ed25519 signing key.
Output is suitable for hosting at .well-known/did.json

USAGE:
  bun run bin/corsair-did-generate.ts [OPTIONS]

OPTIONS:
  --domain <DOMAIN>   Domain for the DID (default: grcorsair.com)
  --output, -o <PATH> Write output to file (default: stdout)
  --key-dir <PATH>    Override key directory (default: ~/.corsair/keys)
  -h, --help          Show this help message

EXAMPLES:
  # Generate DID document to stdout
  bun run bin/corsair-did-generate.ts

  # Generate for a specific domain
  bun run bin/corsair-did-generate.ts --domain api.grcorsair.com

  # Write to a file for web hosting
  bun run bin/corsair-did-generate.ts --output apps/web/public/.well-known/did.json

  # Use a specific key directory
  bun run bin/corsair-did-generate.ts --key-dir /path/to/keys
`);
}

export async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const manager = new MarqueKeyManager(args.keyDir);

  // Check if keys exist; if not, generate them
  const existing = await manager.loadKeypair();
  if (!existing) {
    console.error("No existing keypair found. Generating new Ed25519 keypair...");
    await manager.generateKeypair();
    console.error("Keypair generated.");
  }

  const didDocument = await manager.generateDIDDocument(args.domain);
  const json = JSON.stringify(didDocument, null, 2);

  if (args.output) {
    writeFileSync(args.output, json + "\n");
    console.error(`DID document written to ${args.output}`);
  } else {
    console.log(json);
  }
}

if (import.meta.main) {
  main();
}
