#!/usr/bin/env bun
/**
 * CORSAIR CLI — CPOE Trust Exchange Platform
 *
 * Usage:
 *   corsair sign --file <evidence.json> [--output <cpoe.jwt>] [--did <did>]
 *   corsair drift --current <new.jwt> --previous <old.jwt>
 *   corsair verify --file <cpoe.jwt> [--pubkey <path>]
 *   corsair keygen [--output <dir>]
 *   corsair help
 */

import { existsSync, readFileSync } from "fs";

// =============================================================================
// SUBCOMMAND ROUTING
// =============================================================================

const subcommand = process.argv[2];

switch (subcommand) {
  case "sign":
    await handleSign();
    break;
  case "drift":
    await handleDrift();
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
// SIGN
// =============================================================================

async function handleSign(): Promise<void> {
  const args = process.argv.slice(3);
  let filePath: string | undefined;
  let outputPath: string | undefined;
  let keyDir = "./keys";
  let did: string | undefined;
  let scope: string | undefined;
  let expiryDays = 7;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--file":
      case "-f":
        filePath = args[++i];
        break;
      case "--output":
      case "-o":
        outputPath = args[++i];
        break;
      case "--key-dir":
        keyDir = args[++i];
        break;
      case "--did":
        did = args[++i];
        break;
      case "--scope":
        scope = args[++i];
        break;
      case "--expiry-days":
        expiryDays = parseInt(args[++i], 10) || 7;
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR SIGN — Sign evidence as a CPOE (JWT-VC)

USAGE:
  corsair sign --file <path> [options]

OPTIONS:
  -f, --file <PATH>         Path to evidence JSON file (required)
  -o, --output <PATH>       Write JWT-VC to file (default: stdout)
      --key-dir <DIR>       Ed25519 key directory (default: ./keys)
      --did <DID>           Issuer DID (default: derived from key)
      --scope <TEXT>        Override scope string
      --expiry-days <N>     CPOE validity in days (default: 7)
  -h, --help                Show this help

SUPPORTED FORMATS (auto-detected):
  Generic JSON      { metadata, controls[] }
  Prowler OCSF      Array of findings with StatusCode + FindingInfo
  SecurityHub ASFF  { Findings[] }
  InSpec            { profiles[].controls[] }
  Trivy             { SchemaVersion, Results[] }

EXAMPLES:
  corsair sign --file prowler-findings.json
  corsair sign --file inspec-report.json --output cpoe.jwt
  corsair sign --file evidence.json --did did:web:acme.com --scope "AWS Production"
`);
    return;
  }

  if (!filePath) {
    console.error("Error: --file is required");
    console.error('Run "corsair sign --help" for usage');
    process.exit(2);
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(2);
  }

  // Load keypair
  const { MarqueKeyManager } = await import("./src/parley/marque-key-manager");
  const keyManager = new MarqueKeyManager(keyDir);
  const keypair = await keyManager.loadKeypair();
  if (!keypair) {
    console.error(`Error: No keypair found in ${keyDir}`);
    console.error('Generate keys with: corsair keygen --output ' + keyDir);
    process.exit(2);
  }

  // Read and parse evidence JSON
  const rawJson = readFileSync(filePath, "utf-8");
  const { parseJSON } = await import("./src/ingestion/json-parser");
  const doc = parseJSON(rawJson);

  // Apply scope override if provided
  if (scope) {
    doc.metadata.scope = scope;
  }

  // Map to MarqueGeneratorInput
  const { mapToMarqueInput } = await import("./src/ingestion/mapper");
  const marqueInput = mapToMarqueInput(doc, { did });

  // Build process receipt chain
  const { ReceiptChain } = await import("./src/parley/receipt-chain");
  const { hashData } = await import("./src/parley/process-receipt");
  const chain = new ReceiptChain(keypair.privateKey.toString());

  // Receipt 0: EVIDENCE (captures tool/platform provenance)
  await chain.captureStep({
    step: "evidence",
    inputData: { source: doc.source, fileHash: doc.metadata.rawTextHash },
    outputData: { controlCount: doc.controls.length },
    reproducible: doc.source !== "manual",
    codeVersion: `corsair-sign@2026-02-12`,
    toolAttestation: {
      toolName: doc.source,
      toolVersion: "unknown",
      scanTimestamp: doc.metadata.date,
      scanTarget: doc.metadata.scope,
      outputFormat: doc.source,
    },
  });

  // Receipt 1: CLASSIFY (deterministic)
  await chain.captureStep({
    step: "classify",
    inputData: { controlCount: doc.controls.length, source: doc.source },
    outputData: { assurance: "calculated" },
    reproducible: true,
    codeVersion: "assurance-calculator@2026-02-09",
  });

  // Receipt 2: CHART (deterministic)
  await chain.captureStep({
    step: "chart",
    inputData: doc.controls.map((c: { frameworkRefs?: unknown }) => c.frameworkRefs),
    outputData: marqueInput.chartResults,
    reproducible: true,
    codeVersion: "chart-engine@1.0",
  });

  marqueInput.processReceipts = chain.getReceipts();

  // Generate JWT-VC
  const { generateVCJWT } = await import("./src/parley/vc-generator");
  const jwt = await generateVCJWT(marqueInput, keyManager, { expiryDays });

  // Output
  if (outputPath) {
    const { writeFileSync } = await import("fs");
    writeFileSync(outputPath, jwt);
    console.error(`CPOE signed: ${outputPath}`);
  } else {
    // Write JWT to stdout (for piping), info to stderr
    process.stdout.write(jwt);
  }
}

// =============================================================================
// DRIFT
// =============================================================================

interface DriftControl {
  controlId: string;
  status: string;
}

async function handleDrift(): Promise<void> {
  const args = process.argv.slice(3);
  let currentPath: string | undefined;
  let previousPath: string | undefined;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--current":
      case "-c":
        currentPath = args[++i];
        break;
      case "--previous":
      case "-p":
        previousPath = args[++i];
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR DRIFT — Detect compliance regressions between CPOEs

USAGE:
  corsair drift --current <cpoe.jwt> --previous <cpoe.jwt>

OPTIONS:
  -c, --current <PATH>      Path to the current (new) CPOE
  -p, --previous <PATH>     Path to the previous (baseline) CPOE
  -h, --help                Show this help

EXIT CODES:
  0    No regression detected
  1    Regression detected (new failures or assurance downgrade)
  2    Invalid arguments or missing files

EXAMPLES:
  corsair drift --current cpoe-v2.jwt --previous cpoe-v1.jwt
  corsair drift -c pipeline-latest.jwt -p pipeline-previous.jwt
`);
    return;
  }

  if (!currentPath) {
    console.error("Error: --current is required");
    console.error('Run "corsair drift --help" for usage');
    process.exit(2);
  }

  if (!previousPath) {
    console.error("Error: --previous is required");
    console.error('Run "corsair drift --help" for usage');
    process.exit(2);
  }

  if (!existsSync(currentPath)) {
    console.error(`Error: File not found: ${currentPath}`);
    process.exit(2);
  }

  if (!existsSync(previousPath)) {
    console.error(`Error: File not found: ${previousPath}`);
    process.exit(2);
  }

  // Decode both JWTs (just base64url decode, no signature verification needed)
  const currentJwt = readFileSync(currentPath, "utf-8").trim();
  const previousJwt = readFileSync(previousPath, "utf-8").trim();

  const currentPayload = decodeJwtPayload(currentJwt);
  const previousPayload = decodeJwtPayload(previousJwt);

  if (!currentPayload || !previousPayload) {
    console.error("Error: Could not decode one or both CPOE files");
    process.exit(2);
  }

  const currentSubject = currentPayload.vc?.credentialSubject;
  const previousSubject = previousPayload.vc?.credentialSubject;

  if (!currentSubject || !previousSubject) {
    console.error("Error: CPOE files do not contain valid credentialSubject");
    process.exit(2);
  }

  // Build control maps from frameworks
  const currentControls = extractControls(currentSubject);
  const previousControls = extractControls(previousSubject);

  // Detect drift
  const newFailures: string[] = [];
  const improvements: string[] = [];
  const addedControls: string[] = [];
  const removedControls: string[] = [];

  // Check for regressions and improvements
  for (const [id, ctrl] of currentControls) {
    const prev = previousControls.get(id);
    if (!prev) {
      addedControls.push(id);
      if (ctrl.status === "failed") {
        newFailures.push(id);
      }
      continue;
    }
    if (prev.status === "passed" && ctrl.status === "failed") {
      newFailures.push(id);
    } else if (prev.status === "failed" && ctrl.status === "passed") {
      improvements.push(id);
    }
  }

  // Check for removed controls
  for (const [id] of previousControls) {
    if (!currentControls.has(id)) {
      removedControls.push(id);
    }
  }

  // Assurance level comparison
  const currentAssurance = currentSubject.assurance?.declared ?? -1;
  const previousAssurance = previousSubject.assurance?.declared ?? -1;
  const assuranceChange = currentAssurance - previousAssurance;

  // Score comparison
  const currentScore = currentSubject.summary?.overallScore ?? 0;
  const previousScore = previousSubject.summary?.overallScore ?? 0;
  const scoreChange = currentScore - previousScore;

  // Output results
  const hasRegression = newFailures.length > 0 || assuranceChange < 0;

  console.log("CORSAIR DRIFT REPORT");
  console.log("====================");
  console.log("");

  if (assuranceChange !== 0) {
    const arrow = assuranceChange > 0 ? "↑" : "↓";
    console.log(`  Assurance: L${previousAssurance} → L${currentAssurance} (${arrow})`);
  } else {
    console.log(`  Assurance: L${currentAssurance} (unchanged)`);
  }

  if (scoreChange !== 0) {
    const arrow = scoreChange > 0 ? "↑" : "↓";
    console.log(`  Score: ${previousScore}% → ${currentScore}% (${arrow}${Math.abs(scoreChange)})`);
  } else {
    console.log(`  Score: ${currentScore}% (unchanged)`);
  }

  console.log("");

  if (newFailures.length > 0) {
    console.log(`  REGRESSIONS (${newFailures.length}):`);
    for (const id of newFailures) {
      const ctrl = currentControls.get(id);
      console.log(`    ✗ ${id} — ${ctrl?.status || "failed"}`);
    }
    console.log("");
  }

  if (improvements.length > 0) {
    console.log(`  IMPROVEMENTS (${improvements.length}):`);
    for (const id of improvements) {
      console.log(`    ✓ ${id} — now passing`);
    }
    console.log("");
  }

  if (addedControls.length > 0) {
    console.log(`  ADDED (${addedControls.length}):`);
    for (const id of addedControls) {
      const ctrl = currentControls.get(id);
      console.log(`    + ${id} — ${ctrl?.status || "unknown"}`);
    }
    console.log("");
  }

  if (removedControls.length > 0) {
    console.log(`  REMOVED (${removedControls.length}):`);
    for (const id of removedControls) {
      console.log(`    - ${id}`);
    }
    console.log("");
  }

  if (hasRegression) {
    console.log("  RESULT: REGRESSION DETECTED");
    process.exit(1);
  } else {
    console.log("  No regression detected.");
    process.exit(0);
  }
}

/** Decode JWT payload without verification (base64url decode) */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString();
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** Extract control map from CPOE credentialSubject frameworks */
function extractControls(subject: Record<string, unknown>): Map<string, DriftControl> {
  const controls = new Map<string, DriftControl>();

  // Extract from frameworks
  const frameworks = subject.frameworks as Record<string, { controls?: Array<{ controlId: string; status: string }> }> | undefined;
  if (frameworks) {
    for (const [, fw] of Object.entries(frameworks)) {
      if (!fw.controls) continue;
      for (const ctrl of fw.controls) {
        controls.set(ctrl.controlId, { controlId: ctrl.controlId, status: ctrl.status });
      }
    }
  }

  // Also extract from controlClassifications if present
  const classifications = subject.controlClassifications as Array<{ controlId: string; level: number }> | undefined;
  if (classifications && controls.size === 0) {
    for (const cls of classifications) {
      // level 0 = not meeting any standard = "failed" equivalent
      controls.set(cls.controlId, {
        controlId: cls.controlId,
        status: cls.level > 0 ? "passed" : "failed",
      });
    }
  }

  return controls;
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
CORSAIR — CPOE Trust Exchange Platform

USAGE:
  corsair <command> [options]

COMMANDS:
  sign      Sign evidence as a CPOE (JWT-VC)
  drift     Detect compliance regressions between CPOEs
  verify    Verify a CPOE signature and integrity
  keygen    Generate Ed25519 signing keypair
  help      Show this help message

EXAMPLES:
  corsair sign --file evidence.json --output cpoe.jwt
  corsair sign --file gl-sast-report.json --did did:web:acme.com
  corsair drift --current cpoe-new.jwt --previous cpoe-old.jwt
  corsair verify --file cpoe.jwt --pubkey keys/corsair-signing.pub
  corsair keygen --output ./my-keys

VERSION: 0.4.0
`);
}
