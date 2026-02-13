#!/usr/bin/env bun
/**
 * CORSAIR CLI — Git for Compliance
 *
 * Usage:
 *   corsair sign --file <evidence.json> [--output <cpoe.jwt>] [--did <did>]
 *   corsair sign --file - < evidence.json          (stdin)
 *   cat evidence.json | corsair sign               (pipe)
 *   corsair verify --file <cpoe.jwt> [--pubkey <path>]
 *   corsair diff --current <new.jwt> --previous <old.jwt>
 *   corsair log [--last <N>] [--dir <DIR>]
 *   corsair signal [--help]
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
  case "diff":
  case "drift":
    await handleDiff();
    break;
  case "log":
    await handleLog();
    break;
  case "signal":
    await handleSignal();
    break;
  case "verify":
    await handleVerify();
    break;
  case "renew":
    await handleRenew();
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
  let expiryDays = 90;
  let showHelp = false;
  let format: string | undefined;
  let verbose = false;
  let dryRun = false;
  let jsonOutput = false;
  let quiet = false;
  let showVersion = false;
  let showScore = false;

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
        expiryDays = parseInt(args[++i], 10) || 90;
        break;
      case "--format":
      case "-F":
        format = args[++i];
        break;
      case "--verbose":
      case "-v":
        verbose = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--json":
        jsonOutput = true;
        break;
      case "--quiet":
      case "-q":
        quiet = true;
        break;
      case "--version":
        showVersion = true;
        break;
      case "--score":
        showScore = true;
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showVersion) {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    console.log(`corsair ${pkg.version}`);
    return;
  }

  if (showHelp) {
    console.log(`
CORSAIR SIGN — Sign evidence as a CPOE (JWT-VC)

USAGE:
  corsair sign --file <path> [options]
  corsair sign --file - [options]           Read from stdin
  cat evidence.json | corsair sign          Pipe from stdin

OPTIONS:
  -f, --file <PATH>         Path to evidence JSON file (or "-" for stdin)
  -o, --output <PATH>       Write JWT-VC to file (default: stdout)
  -F, --format <NAME>       Force evidence format (bypass auto-detection)
      --key-dir <DIR>       Ed25519 key directory (default: ./keys)
      --did <DID>           Issuer DID (default: derived from key)
      --scope <TEXT>        Override scope string
      --expiry-days <N>     CPOE validity in days (default: 90)
      --dry-run             Parse + classify but don't sign. Output would-be subject.
      --json                Output structured JSON (jwt + metadata) to stdout
      --score               Run 7-dimension evidence quality scoring (FICO score)
  -v, --verbose             Print step-by-step progress to stderr
  -q, --quiet               Suppress all stderr output
      --version             Print version
  -h, --help                Show this help

FORMATS (auto-detected or forced with --format):
  generic               { metadata, controls[] }
  prowler               Array of findings with StatusCode + FindingInfo
  securityhub           { Findings[] } (AWS SecurityHub ASFF)
  inspec                { profiles[].controls[] } (Chef InSpec)
  trivy                 { SchemaVersion, Results[] } (Aqua Trivy)
  gitlab                { version, scan, vulnerabilities[] }
  ciso-assistant-api    { count, results[] } (CISO Assistant API)
  ciso-assistant-export { meta, requirement_assessments[] }

EXAMPLES:
  corsair sign --file prowler-findings.json
  corsair sign --file inspec-report.json --output cpoe.jwt
  corsair sign --file evidence.json --did did:web:acme.com --scope "AWS Production"
  corsair sign --file evidence.json --dry-run
  corsair sign --file evidence.json --json | jq .summary
  cat trivy-report.json | corsair sign --format trivy --output cpoe.jwt
`);
    return;
  }

  // Determine input source: file, stdin flag, or piped stdin
  // Only read stdin when explicitly requested with "--file -"
  let rawJson: string;
  const isStdinExplicit = filePath === "-";

  if (isStdinExplicit) {
    if (verbose && !quiet) console.error("Reading evidence from stdin...");
    rawJson = await new Response(Bun.stdin.stream()).text();
    if (!rawJson.trim()) {
      console.error("Error: Empty input from stdin");
      process.exit(2);
    }
  } else if (filePath) {
    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(2);
    }
    rawJson = readFileSync(filePath, "utf-8");
  } else {
    console.error("Error: --file is required");
    console.error('Run "corsair sign --help" for usage');
    process.exit(2);
  }

  // Load key manager
  const { MarqueKeyManager } = await import("./src/parley/marque-key-manager");
  const keyManager = new MarqueKeyManager(keyDir);
  const keypair = await keyManager.loadKeypair();
  if (!keypair && !dryRun) {
    console.error(`Error: No keypair found in ${keyDir}`);
    console.error('Generate keys with: corsair keygen --output ' + keyDir);
    process.exit(2);
  }

  // For dry-run without keys, generate temporary in-memory keys
  if (!keypair && dryRun) {
    await keyManager.generateKeypair();
  }

  if (verbose && !quiet) console.error("Parsing evidence...");

  // Call the shared sign engine
  const { signEvidence, SignError } = await import("./src/sign/sign-core");
  type EvidenceFormat = import("./src/sign/sign-core").EvidenceFormat;

  try {
    const result = await signEvidence({
      evidence: rawJson,
      format: format as EvidenceFormat | undefined,
      did,
      scope,
      expiryDays,
      dryRun,
    }, keyManager);

    if (verbose && !quiet) {
      console.error(`Format:     ${result.detectedFormat} (${format ? "forced" : "auto-detected"})`);
      console.error(`Controls:   ${result.summary.controlsTested} tested, ${result.summary.controlsPassed} passed, ${result.summary.controlsFailed} failed (${result.summary.overallScore}%)`);
      console.error(`Provenance: ${result.provenance.source} (${result.provenance.sourceIdentity || "unknown"})`);
    }

    // Show warnings
    for (const w of result.warnings) {
      if (!quiet) console.error(`Warning: ${w}`);
    }

    // Run scoring engine if --score was requested
    let scoreResult: import("./src/scoring/types").EvidenceQualityScore | undefined;
    if (showScore) {
      const { normalizeDocument } = await import("./src/normalize/normalize");
      const { scoreEvidence: runScoring } = await import("./src/scoring/scoring-engine");
      const normalized = normalizeDocument(result.document);
      const hasProcessProvenance = (result.document as any).processReceipts?.length > 0;
      scoreResult = runScoring(normalized.controls, { hasProcessProvenance });

      if (!quiet && !jsonOutput) {
        const dimSummary = scoreResult.dimensions
          .map(d => `${d.name}=${d.score}`)
          .join(", ");
        console.error(`\n  Evidence Quality: ${scoreResult.composite}/100 (${scoreResult.grade}) -- ${dimSummary}`);
      }
    }

    // Dry-run output
    if (dryRun) {
      const dryOutput: Record<string, unknown> = {
        dryRun: true,
        detectedFormat: result.detectedFormat,
        summary: result.summary,
        provenance: result.provenance,
        controlCount: result.document.controls.length,
        warnings: result.warnings,
      };
      if (scoreResult) {
        dryOutput.score = scoreResult;
      }
      console.log(JSON.stringify(dryOutput, null, 2));
      return;
    }

    // JSON output mode
    if (jsonOutput) {
      const structuredOutput: Record<string, unknown> = {
        cpoe: result.jwt,
        marqueId: result.marqueId,
        detectedFormat: result.detectedFormat,
        summary: result.summary,
        provenance: result.provenance,
        warnings: result.warnings,
      };
      if (scoreResult) {
        structuredOutput.score = scoreResult;
      }
      process.stdout.write(JSON.stringify(structuredOutput, null, 2));
      return;
    }

    // Standard output
    if (outputPath) {
      const { writeFileSync } = await import("fs");
      writeFileSync(outputPath, result.jwt);
      if (!quiet) {
        const size = Buffer.byteLength(result.jwt);
        console.error(`\nCPOE signed successfully.`);
        console.error(`  Format:     ${result.detectedFormat} (${format ? "forced" : "auto-detected"})`);
        console.error(`  Controls:   ${result.summary.controlsTested} tested, ${result.summary.controlsPassed} passed, ${result.summary.controlsFailed} failed (${result.summary.overallScore}%)`);
        console.error(`  Provenance: ${result.provenance.source} (${result.provenance.sourceIdentity || "unknown"})`);
        console.error(`  Output:     ${outputPath} (${size.toLocaleString()} bytes)`);
        console.error(`  Verify:     corsair verify --file ${outputPath}`);
      }
    } else {
      // Write JWT to stdout (for piping), info to stderr
      process.stdout.write(result.jwt);
    }
  } catch (err) {
    if (err instanceof SignError) {
      console.error(`Error: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
}

// =============================================================================
// DRIFT
// =============================================================================

interface DriftControl {
  controlId: string;
  status: string;
}

async function handleDiff(): Promise<void> {
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
CORSAIR DIFF — Detect compliance regressions between CPOEs

USAGE:
  corsair diff --current <cpoe.jwt> --previous <cpoe.jwt>

OPTIONS:
  -c, --current <PATH>      Path to the current (new) CPOE
  -p, --previous <PATH>     Path to the previous (baseline) CPOE
  -h, --help                Show this help

EXIT CODES:
  0    No regression detected
  1    Regression detected (new failures or score downgrade)
  2    Invalid arguments or missing files

ALIASES:
  corsair drift              (backwards-compatible alias)

EXAMPLES:
  corsair diff --current cpoe-v2.jwt --previous cpoe-v1.jwt
  corsair diff -c pipeline-latest.jwt -p pipeline-previous.jwt
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

  console.log("CORSAIR DIFF REPORT");
  console.log("===================");
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
// LOG
// =============================================================================

async function handleLog(): Promise<void> {
  const args = process.argv.slice(3);
  let showHelp = false;
  let last = 10;
  let dir = ".";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        showHelp = true;
        break;
      case "--last":
      case "-n":
        last = parseInt(args[++i], 10) || 10;
        break;
      case "--dir":
      case "-d":
        dir = args[++i];
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR LOG — List signed CPOEs (local SCITT transparency log)

USAGE:
  corsair log [options]

OPTIONS:
  -n, --last <N>            Show last N entries (default: 10)
  -d, --dir <DIR>           Directory to scan for .jwt files (default: .)
  -h, --help                Show this help

EXAMPLES:
  corsair log                         List recent CPOEs in current directory
  corsair log --last 5                Show last 5 CPOEs
  corsair log --dir ./cpoes           Scan specific directory

NOTE:
  Local mode scans .jwt files on disk. For remote SCITT log queries,
  use the API: POST /scitt/register (see docs).
`);
    return;
  }

  // Scan for .jwt files in the directory
  const { readdirSync, statSync } = await import("fs");
  const { join, resolve } = await import("path");

  const targetDir = resolve(dir);
  let jwtFiles: Array<{ path: string; mtime: Date; size: number }> = [];

  try {
    const files = readdirSync(targetDir);
    for (const file of files) {
      if (!file.endsWith(".jwt")) continue;
      const fullPath = join(targetDir, file);
      const stat = statSync(fullPath);
      if (stat.isFile()) {
        jwtFiles.push({ path: fullPath, mtime: stat.mtime, size: stat.size });
      }
    }
  } catch {
    console.error(`Error: Cannot read directory: ${targetDir}`);
    process.exit(2);
  }

  // Sort by modification time (newest first)
  jwtFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  jwtFiles = jwtFiles.slice(0, last);

  if (jwtFiles.length === 0) {
    console.log("No .jwt files found in " + targetDir);
    console.log('Sign evidence with: corsair sign --file <path> --output cpoe.jwt');
    return;
  }

  console.log("CORSAIR LOG");
  console.log("===========");
  console.log(`  Directory: ${targetDir}`);
  console.log(`  Entries:   ${jwtFiles.length}`);
  console.log("");

  for (let i = 0; i < jwtFiles.length; i++) {
    const entry = jwtFiles[i];
    const jwt = readFileSync(entry.path, "utf-8").trim();
    const payload = decodeJwtPayload(jwt);
    const fileName = entry.path.split("/").pop() || entry.path;

    const iss = payload?.iss as string || "unknown";
    const subject = payload?.vc as Record<string, unknown> | undefined;
    const credSubject = subject?.credentialSubject as Record<string, unknown> | undefined;
    const summary = credSubject?.summary as Record<string, unknown> | undefined;
    const provenance = credSubject?.provenance as Record<string, unknown> | undefined;
    const score = summary?.overallScore ?? "?";
    const source = provenance?.source ?? "?";
    const date = entry.mtime.toISOString().split("T")[0];

    const marker = i === 0 ? " ← LATEST" : "";
    console.log(`  #${i + 1}  ${date}  ${fileName}  ${source}  ${iss}  score:${score}%${marker}`);
  }
  console.log("");
}

// =============================================================================
// SIGNAL
// =============================================================================

async function handleSignal(): Promise<void> {
  const args = process.argv.slice(3);
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") {
      showHelp = true;
    }
  }

  if (showHelp || args.length === 0) {
    console.log(`
CORSAIR SIGNAL — FLAGSHIP real-time compliance change notifications

USAGE:
  corsair signal [options]

ABOUT:
  FLAGSHIP delivers compliance change notifications via the OpenID Shared
  Signals Framework (SSF) and Continuous Access Evaluation Protocol (CAEP).
  Events are Ed25519-signed Security Event Tokens (SETs).

EVENT TYPES:
  FLEET_ALERT       compliance-change        Control drift detected
  COLORS_CHANGED    assurance-level-change   Trust tier transition
  PAPERS_CHANGED    credential-change        CPOE issued/renewed/revoked
  MARQUE_REVOKED    session-revoked          Emergency revocation

DELIVERY:
  Push (webhook) and poll modes with retry and circuit breaker.

API ENDPOINTS:
  GET  /.well-known/ssf-configuration    SSF discovery
  POST /ssf/stream                       Create/manage streams
  POST /scitt/register                   Register CPOE + trigger signals

NOTE:
  FLAGSHIP operates via the API layer (SSF/CAEP over HTTP).
  See https://grcorsair.com/docs for stream configuration.
`);
    return;
  }

  // For now, signal is informational — show what's available
  console.error("CORSAIR SIGNAL — FLAGSHIP SSF/CAEP");
  console.error("");
  console.error("  FLAGSHIP streams are managed via the API layer.");
  console.error("  Available endpoints:");
  console.error("    GET  /.well-known/ssf-configuration");
  console.error("    POST /ssf/stream (create, read, update, delete)");
  console.error("");
  console.error('  Run "corsair signal --help" for details.');
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
// RENEW
// =============================================================================

async function handleRenew(): Promise<void> {
  const args = process.argv.slice(3);
  let filePath: string | undefined;
  let evidencePath: string | undefined;
  let outputPath: string | undefined;
  let keyDir = "./keys";
  let jsonOutput = false;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--file":
      case "-f":
        filePath = args[++i];
        break;
      case "--evidence":
      case "-e":
        evidencePath = args[++i];
        break;
      case "--output":
      case "-o":
        outputPath = args[++i];
        break;
      case "--key-dir":
        keyDir = args[++i];
        break;
      case "--json":
        jsonOutput = true;
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR RENEW — Re-sign a CPOE with fresh dates

USAGE:
  corsair renew --file <cpoe.jwt> [options]

OPTIONS:
  -f, --file <PATH>         Path to existing CPOE JWT file (required)
  -e, --evidence <PATH>     Path to new evidence JSON (re-signs with new evidence)
  -o, --output <PATH>       Write renewed JWT-VC to file (default: stdout)
      --key-dir <DIR>       Ed25519 key directory (default: ./keys)
      --json                Output structured JSON to stdout
  -h, --help                Show this help

BEHAVIOR:
  Without --evidence: Re-signs existing CPOE payload with fresh iat/exp dates.
  With --evidence:    Signs new evidence, preserving the original scope and DID.

EXAMPLES:
  corsair renew --file cpoe.jwt --output renewed.jwt
  corsair renew --file cpoe.jwt --evidence new-findings.json --output renewed.jwt
  corsair renew --file cpoe.jwt --json | jq .cpoe
`);
    return;
  }

  if (!filePath) {
    console.error("Error: --file is required");
    console.error('Run "corsair renew --help" for usage');
    process.exit(2);
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(2);
  }

  // Read and decode existing CPOE
  const existingJwt = readFileSync(filePath, "utf-8").trim();
  const existingPayload = decodeJwtPayload(existingJwt);
  if (!existingPayload || !existingPayload.vc) {
    console.error("Error: Invalid CPOE file — cannot decode JWT payload");
    process.exit(2);
  }

  const existingVc = existingPayload.vc as Record<string, unknown>;
  const existingSubject = existingVc.credentialSubject as Record<string, unknown> | undefined;
  const existingIss = existingPayload.iss as string;
  const existingScope = (existingSubject?.scope as string) || undefined;

  // Load key manager
  const { MarqueKeyManager } = await import("./src/parley/marque-key-manager");
  const keyManager = new MarqueKeyManager(keyDir);
  const keypair = await keyManager.loadKeypair();
  if (!keypair) {
    console.error(`Error: No keypair found in ${keyDir}`);
    console.error('Generate keys with: corsair keygen --output ' + keyDir);
    process.exit(2);
  }

  let renewedJwt: string;

  if (evidencePath) {
    // Renewal with new evidence — re-sign with signEvidence, preserving DID + scope
    if (!existsSync(evidencePath)) {
      console.error(`Error: Evidence file not found: ${evidencePath}`);
      process.exit(2);
    }

    const rawJson = readFileSync(evidencePath, "utf-8");
    const { signEvidence } = await import("./src/sign/sign-core");

    const result = await signEvidence({
      evidence: rawJson,
      did: existingIss,
      scope: existingScope,
    }, keyManager);

    renewedJwt = result.jwt;
  } else {
    // Renewal without new evidence — re-sign existing payload with fresh dates
    const { generateVCJWT } = await import("./src/parley/vc-generator");
    const { mapToMarqueInput } = await import("./src/ingestion/mapper");

    // Reconstruct a minimal MarqueGeneratorInput from the existing CPOE
    const marqueInput = {
      document: undefined,
      chartResults: [] as import("./src/types").ChartResult[],
      issuer: { id: existingIss, did: existingIss, name: (existingVc.issuer as Record<string, unknown>)?.name as string || "Unknown" },
      providers: [],
    };

    // We need to re-create the JWT-VC manually to preserve the existing credentialSubject
    const { SignJWT, importPKCS8 } = await import("jose");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const crypto = await import("crypto");
    const marqueId = `marque-${crypto.randomUUID()}`;

    const vc = {
      ...existingVc,
      validFrom: now.toISOString(),
      validUntil: expiresAt.toISOString(),
    };

    const privateKey = await importPKCS8(keypair.privateKey.toString(), "EdDSA");

    renewedJwt = await new SignJWT({
      vc,
      parley: existingPayload.parley || "2.1",
    })
      .setProtectedHeader({
        alg: "EdDSA",
        typ: "vc+jwt",
        kid: `${existingIss}#key-1`,
      })
      .setIssuedAt()
      .setIssuer(existingIss)
      .setSubject(marqueId)
      .setJti(marqueId)
      .setExpirationTime(expiresAt)
      .sign(privateKey);
  }

  // Output
  if (jsonOutput) {
    const structuredOutput = {
      cpoe: renewedJwt,
      renewedFrom: filePath,
      issuer: existingIss,
      scope: existingScope,
    };
    process.stdout.write(JSON.stringify(structuredOutput, null, 2));
    return;
  }

  if (outputPath) {
    const { writeFileSync } = await import("fs");
    writeFileSync(outputPath, renewedJwt);
    console.error("CPOE renewed successfully.");
    console.error(`  Output: ${outputPath}`);
    console.error(`  Verify: corsair verify --file ${outputPath}`);
  } else {
    process.stdout.write(renewedJwt);
  }
}

// =============================================================================
// HELP
// =============================================================================

function printHelp(): void {
  let version = "0.5.0";
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    version = pkg.version || version;
  } catch {}
  console.log(`
CORSAIR — Git for Compliance

USAGE:
  corsair <command> [options]

COMMANDS:
  sign      Sign evidence as a CPOE (JWT-VC)        like git commit
  verify    Verify a CPOE signature and integrity
  diff      Detect compliance regressions            like git diff
  log       List signed CPOEs (SCITT log)            like git log
  renew     Re-sign a CPOE with fresh dates          like git commit --amend
  signal    FLAGSHIP real-time notifications         like git webhooks
  keygen    Generate Ed25519 signing keypair
  help      Show this help message

ALIASES:
  drift     Backwards-compatible alias for diff

EXAMPLES:
  corsair sign --file evidence.json --output cpoe.jwt
  corsair sign --file gl-sast-report.json --did did:web:acme.com
  corsair sign --file - < prowler-findings.json
  cat trivy-report.json | corsair sign --format trivy
  corsair sign --file evidence.json --dry-run
  corsair diff --current cpoe-new.jwt --previous cpoe-old.jwt
  corsair verify --file cpoe.jwt --pubkey keys/corsair-signing.pub
  corsair keygen --output ./my-keys

VERSION: ${version}
`);
}
