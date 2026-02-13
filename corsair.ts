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

// Singleton CertificationEngine instance (declared early to avoid TDZ with top-level await)
let _certEngineInstance: unknown;

// Singleton TPRMEngine instance (same lazy pattern as CertificationEngine)
let _tprmEngineInstance: unknown;

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
  case "audit":
    await handleAudit();
    break;
  case "cert":
    await handleCert();
    break;
  case "tprm":
    await handleTprm();
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
// AUDIT
// =============================================================================

async function handleAudit(): Promise<void> {
  const args = process.argv.slice(3);
  const files: string[] = [];
  let scope: string | undefined;
  let frameworks: string[] = [];
  let format: string | undefined;
  let includeScore = true;
  let includeGovernance = false;
  let jsonOutput = false;
  let excludeControls: string[] = [];
  let signResult = false;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--files":
        // Consume all subsequent args that don't start with "--" as file paths
        i++;
        while (i < args.length && !args[i].startsWith("--")) {
          files.push(args[i]);
          i++;
        }
        i--; // Back up one since the for loop will increment
        break;
      case "--scope":
        scope = args[++i];
        break;
      case "--frameworks":
        frameworks = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--format":
      case "-F":
        format = args[++i];
        break;
      case "--score":
        includeScore = true;
        break;
      case "--no-score":
        includeScore = false;
        break;
      case "--governance":
        includeGovernance = true;
        break;
      case "--json":
        jsonOutput = true;
        break;
      case "--exclude":
        excludeControls = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--sign":
        signResult = true;
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR AUDIT — Run a full compliance audit

USAGE:
  corsair audit --files <paths...> --scope <name> [options]

OPTIONS:
  --files <PATHS...>       Evidence file paths (required, supports multiple)
  --scope <NAME>           Audit scope name (required)
  --frameworks <LIST>      Comma-separated framework names (e.g., SOC2,NIST-800-53)
  -F, --format <NAME>      Force evidence format (bypass auto-detection)
  --score                  Include scoring (default: true)
  --no-score               Disable scoring
  --governance             Include quartermaster governance checks (default: false)
  --json                   Output full AuditResult as JSON
  --exclude <IDS>          Comma-separated control IDs to exclude
  --sign                   Sign the audit result as a CPOE (default: false)
  -h, --help               Show this help

EXAMPLES:
  corsair audit --files prowler.json inspec.json --scope "AWS Production"
  corsair audit --files evidence/*.json --scope "SOC 2" --frameworks SOC2,NIST-800-53
  corsair audit --files report.json --scope "Cloud" --score --governance
  corsair audit --files report.json --scope "Cloud" --json
  corsair audit --files report.json --scope "Cloud" --exclude CC7.3,CC7.4
`);
    return;
  }

  if (files.length === 0) {
    console.error("Error: --files is required");
    console.error('Run "corsair audit --help" for usage');
    process.exit(2);
  }

  if (!scope) {
    console.error("Error: --scope is required");
    console.error('Run "corsair audit --help" for usage');
    process.exit(2);
  }

  // Validate that all files exist
  for (const file of files) {
    if (!existsSync(file)) {
      console.error(`Error: File not found: ${file}`);
      process.exit(2);
    }
  }

  // Build audit scope
  const { runAudit, formatAuditSummary } = await import("./src/audit/audit-engine");
  type AuditScope = import("./src/audit/types").AuditScope;

  const auditScope: AuditScope = {
    name: scope,
    frameworks,
    evidencePaths: files,
    formats: format ? files.map(() => format!) : undefined,
    excludeControls: excludeControls.length > 0 ? excludeControls : undefined,
  };

  const result = await runAudit(auditScope, {
    includeScore,
    includeGovernance,
    signResult,
  });

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(result, null, 2));
  } else {
    console.log(formatAuditSummary(result));
  }
}

// =============================================================================
// CERT
// =============================================================================

async function handleCert(): Promise<void> {
  const args = process.argv.slice(3);
  const certSubcommand = args[0];

  // Handle help flags and no subcommand
  if (!certSubcommand || certSubcommand === "--help" || certSubcommand === "-h") {
    printCertHelp();
    return;
  }

  switch (certSubcommand) {
    case "create":
      await handleCertCreate(args.slice(1));
      break;
    case "check":
      await handleCertCheck(args.slice(1));
      break;
    case "list":
      await handleCertList(args.slice(1));
      break;
    case "renew":
      await handleCertRenew(args.slice(1));
      break;
    case "suspend":
      await handleCertSuspend(args.slice(1));
      break;
    case "revoke":
      await handleCertRevoke(args.slice(1));
      break;
    case "history":
      await handleCertHistory(args.slice(1));
      break;
    case "expiring":
      await handleCertExpiring(args.slice(1));
      break;
    default:
      console.error(`Unknown cert subcommand: ${certSubcommand}`);
      console.error('Run "corsair cert --help" for usage');
      process.exit(1);
  }
}

function printCertHelp(): void {
  console.log(`
CORSAIR CERT — Manage continuous compliance certifications

USAGE:
  corsair cert <subcommand> [options]

SUBCOMMANDS:
  create    Create a new certification
  check     Check certification status
  list      List all certifications
  renew     Renew a certification (re-run audit)
  suspend   Suspend a certification
  revoke    Revoke a certification
  history   Show certification status history
  expiring  Show certifications expiring soon

EXAMPLES:
  corsair cert create --scope "AWS Production" --frameworks SOC2,NIST-800-53 --files evidence/*.json
  corsair cert check <cert-id>
  corsair cert list --status active
  corsair cert renew <cert-id> --files evidence/*.json
  corsair cert suspend <cert-id> --reason "Compliance drift detected"
  corsair cert revoke <cert-id> --reason "Critical vulnerability found"
  corsair cert history <cert-id>
  corsair cert expiring --within 30

OPTIONS:
  -h, --help    Show this help
`);
}

async function getCertEngine() {
  if (!_certEngineInstance) {
    const { CertificationEngine } = await import("./src/certification/certification-engine");
    _certEngineInstance = new CertificationEngine();
  }
  return _certEngineInstance as import("./src/certification/certification-engine").CertificationEngine;
}

// ---------------------------------------------------------------------------
// CERT CREATE
// ---------------------------------------------------------------------------

async function handleCertCreate(args: string[]): Promise<void> {
  const files: string[] = [];
  let scope: string | undefined;
  let frameworks: string[] = [];
  let minScore = 70;
  let warningThreshold = 80;
  let auditInterval = 90;
  let jsonOutput = false;
  let orgId = "default";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--files":
        // Consume all subsequent args that don't start with "--" as file paths
        i++;
        while (i < args.length && !args[i].startsWith("--")) {
          files.push(args[i]);
          i++;
        }
        i--; // Back up one since the for loop will increment
        break;
      case "--scope":
        scope = args[++i];
        break;
      case "--frameworks":
        frameworks = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--min-score":
        minScore = parseInt(args[++i], 10) || 70;
        break;
      case "--warning-threshold":
        warningThreshold = parseInt(args[++i], 10) || 80;
        break;
      case "--audit-interval":
        auditInterval = parseInt(args[++i], 10) || 90;
        break;
      case "--org":
        orgId = args[++i];
        break;
      case "--json":
        jsonOutput = true;
        break;
    }
  }

  if (!scope) {
    console.error("Error: --scope is required");
    console.error('Run "corsair cert create --help" for usage');
    process.exit(2);
  }

  if (files.length === 0) {
    console.error("Error: --files is required");
    console.error('Run "corsair cert create --help" for usage');
    process.exit(2);
  }

  // Validate files exist
  for (const file of files) {
    if (!existsSync(file)) {
      console.error(`Error: File not found: ${file}`);
      process.exit(2);
    }
  }

  // Run initial audit
  const { runAudit } = await import("./src/audit/audit-engine");
  type AuditScope = import("./src/audit/types").AuditScope;
  type CertificationPolicy = import("./src/certification/types").CertificationPolicy;

  const auditScope: AuditScope = {
    name: scope,
    frameworks,
    evidencePaths: files,
  };

  const auditResult = await runAudit(auditScope, {
    includeScore: true,
    generateFindings: true,
  });

  // Build certification policy
  const { randomUUID } = await import("crypto");
  const policyId = `policy-${randomUUID()}`;

  const policy: CertificationPolicy = {
    id: policyId,
    name: `${scope} Policy`,
    scope: auditScope,
    minimumScore: minScore,
    warningThreshold,
    auditIntervalDays: auditInterval,
    freshnessMaxDays: 7,
    gracePeriodDays: 14,
    autoRenew: false,
    autoSuspend: false,
    notifyOnChange: false,
  };

  // Create certification
  const engine = await getCertEngine();
  const cert = engine.createCertification(orgId, policy, auditResult);

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(cert, null, 2));
  } else {
    console.log("Certification created successfully.");
    console.log(`  ID:       ${cert.id}`);
    console.log(`  Status:   ${cert.status}`);
    console.log(`  Score:    ${cert.currentScore}/100 (${cert.currentGrade})`);
    console.log(`  Scope:    ${scope}`);
    console.log(`  Expires:  ${cert.expiresAt}`);
    console.log(`  Next audit: ${cert.nextAuditAt}`);
  }
}

// ---------------------------------------------------------------------------
// CERT CHECK
// ---------------------------------------------------------------------------

async function handleCertCheck(args: string[]): Promise<void> {
  const certId = args.find((a) => !a.startsWith("--"));

  if (!certId) {
    console.error("Error: certification ID is required");
    console.error('Usage: corsair cert check <cert-id>');
    process.exit(2);
  }

  const engine = await getCertEngine();
  const result = engine.checkCertification(certId);

  if (!result) {
    console.error(`Error: Certification not found: ${certId}`);
    process.exit(1);
  }

  const statusIndicators: Record<string, string> = {
    active: "[ACTIVE]",
    warning: "[WARNING]",
    degraded: "[DEGRADED]",
    suspended: "[SUSPENDED]",
    expired: "[EXPIRED]",
    revoked: "[REVOKED]",
  };

  const indicator = statusIndicators[result.status] || `[${result.status.toUpperCase()}]`;

  console.log(`CERTIFICATION CHECK: ${certId}`);
  console.log(`  Status:              ${indicator} ${result.status}`);
  console.log(`  Score:               ${result.currentScore}/100`);
  console.log(`  Needs re-audit:      ${result.needsReaudit ? "Yes" : "No"}`);
  console.log(`  Grace period expired: ${result.gracePeriodExpired ? "Yes" : "No"}`);
}

// ---------------------------------------------------------------------------
// CERT LIST
// ---------------------------------------------------------------------------

async function handleCertList(args: string[]): Promise<void> {
  let orgId: string | undefined;
  let statusFilter: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--org":
        orgId = args[++i];
        break;
      case "--status":
        statusFilter = args[++i];
        break;
      case "--json":
        jsonOutput = true;
        break;
    }
  }

  const engine = await getCertEngine();
  let certs = engine.listCertifications(orgId);

  // Apply status filter
  if (statusFilter) {
    certs = certs.filter((c) => c.status === statusFilter);
  }

  if (certs.length === 0) {
    if (jsonOutput) {
      process.stdout.write("[]");
    } else {
      console.log("No certifications found.");
    }
    return;
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(certs, null, 2));
    return;
  }

  console.log("CERTIFICATIONS");
  console.log("==============");
  console.log("");
  console.log(
    "  ID".padEnd(44) +
    "Status".padEnd(12) +
    "Score".padEnd(8) +
    "Grade".padEnd(8) +
    "Expires",
  );
  console.log("  " + "-".repeat(80));

  for (const cert of certs) {
    const expiresDate = cert.expiresAt
      ? new Date(cert.expiresAt).toISOString().split("T")[0]
      : "N/A";
    console.log(
      `  ${cert.id.padEnd(42)}${cert.status.padEnd(12)}${String(cert.currentScore).padEnd(8)}${cert.currentGrade.padEnd(8)}${expiresDate}`,
    );
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// CERT RENEW
// ---------------------------------------------------------------------------

async function handleCertRenew(args: string[]): Promise<void> {
  const files: string[] = [];
  let certId: string | undefined;
  let jsonOutput = false;

  // First non-flag arg is the cert ID
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--files") {
      i++;
      while (i < args.length && !args[i].startsWith("--")) {
        files.push(args[i]);
        i++;
      }
      i--;
    } else if (args[i] === "--json") {
      jsonOutput = true;
    } else if (!args[i].startsWith("--") && !certId) {
      certId = args[i];
    }
  }

  if (!certId) {
    console.error("Error: certification ID is required");
    console.error('Usage: corsair cert renew <cert-id> --files <paths...>');
    process.exit(2);
  }

  if (files.length === 0) {
    console.error("Error: --files is required");
    console.error('Usage: corsair cert renew <cert-id> --files <paths...>');
    process.exit(2);
  }

  // Validate files exist
  for (const file of files) {
    if (!existsSync(file)) {
      console.error(`Error: File not found: ${file}`);
      process.exit(2);
    }
  }

  const engine = await getCertEngine();
  const existing = engine.getCertification(certId);
  if (!existing) {
    console.error(`Error: Certification not found: ${certId}`);
    process.exit(1);
  }

  // Run new audit
  const { runAudit } = await import("./src/audit/audit-engine");
  const auditResult = await runAudit({
    name: existing.policyId,
    frameworks: [],
    evidencePaths: files,
  }, {
    includeScore: true,
    generateFindings: true,
  });

  // Detect drift before renewal
  const drift = engine.detectDrift(certId, auditResult);

  // Renew
  const renewed = engine.renewCertification(certId, auditResult);
  if (!renewed) {
    console.error(`Error: Failed to renew certification: ${certId}`);
    process.exit(1);
  }

  if (jsonOutput) {
    const output: Record<string, unknown> = { certification: renewed };
    if (drift) {
      output.drift = drift;
    }
    process.stdout.write(JSON.stringify(output, null, 2));
  } else {
    console.log("Certification renewed successfully.");
    console.log(`  ID:       ${renewed.id}`);
    console.log(`  Status:   ${renewed.status}`);
    console.log(`  Score:    ${renewed.currentScore}/100 (${renewed.currentGrade})`);
    console.log(`  Expires:  ${renewed.expiresAt}`);
    console.log(`  Next audit: ${renewed.nextAuditAt}`);

    if (drift && drift.degradedControls.length > 0) {
      console.log("");
      console.log("  DRIFT DETECTED:");
      console.log(`    Score delta: ${drift.scoreDelta > 0 ? "+" : ""}${drift.scoreDelta}`);
      console.log(`    Recommendation: ${drift.recommendation}`);
      for (const ctrl of drift.degradedControls) {
        console.log(`    - ${ctrl.controlId}: ${ctrl.previousStatus} -> ${ctrl.currentStatus} (${ctrl.severity})`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CERT SUSPEND
// ---------------------------------------------------------------------------

async function handleCertSuspend(args: string[]): Promise<void> {
  let certId: string | undefined;
  let reason: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--reason") {
      reason = args[++i];
    } else if (!args[i].startsWith("--") && !certId) {
      certId = args[i];
    }
  }

  if (!certId) {
    console.error("Error: certification ID is required");
    console.error('Usage: corsair cert suspend <cert-id> --reason "reason"');
    process.exit(2);
  }

  if (!reason) {
    console.error("Error: --reason is required");
    console.error('Usage: corsair cert suspend <cert-id> --reason "reason"');
    process.exit(2);
  }

  const engine = await getCertEngine();
  const existing = engine.getCertification(certId);
  if (!existing) {
    console.error(`Error: Certification not found: ${certId}`);
    process.exit(1);
  }

  const result = engine.updateStatus(certId, "suspended", reason);
  if (!result) {
    console.error(`Error: Cannot suspend certification in "${existing.status}" state`);
    process.exit(1);
  }

  console.log("Certification suspended.");
  console.log(`  ID:     ${result.id}`);
  console.log(`  Status: ${result.status}`);
  console.log(`  Reason: ${reason}`);
}

// ---------------------------------------------------------------------------
// CERT REVOKE
// ---------------------------------------------------------------------------

async function handleCertRevoke(args: string[]): Promise<void> {
  let certId: string | undefined;
  let reason: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--reason") {
      reason = args[++i];
    } else if (!args[i].startsWith("--") && !certId) {
      certId = args[i];
    }
  }

  if (!certId) {
    console.error("Error: certification ID is required");
    console.error('Usage: corsair cert revoke <cert-id> --reason "reason"');
    process.exit(2);
  }

  if (!reason) {
    console.error("Error: --reason is required");
    console.error('Usage: corsair cert revoke <cert-id> --reason "reason"');
    process.exit(2);
  }

  const engine = await getCertEngine();
  const existing = engine.getCertification(certId);
  if (!existing) {
    console.error(`Error: Certification not found: ${certId}`);
    process.exit(1);
  }

  const result = engine.updateStatus(certId, "revoked", reason);
  if (!result) {
    console.error(`Error: Cannot revoke certification in "${existing.status}" state`);
    process.exit(1);
  }

  console.log("Certification revoked.");
  console.log(`  ID:     ${result.id}`);
  console.log(`  Status: ${result.status}`);
  console.log(`  Reason: ${reason}`);
}

// ---------------------------------------------------------------------------
// CERT HISTORY
// ---------------------------------------------------------------------------

async function handleCertHistory(args: string[]): Promise<void> {
  const certId = args.find((a) => !a.startsWith("--"));

  if (!certId) {
    console.error("Error: certification ID is required");
    console.error('Usage: corsair cert history <cert-id>');
    process.exit(2);
  }

  const engine = await getCertEngine();
  const cert = engine.getCertification(certId);

  if (!cert) {
    console.error(`Error: Certification not found: ${certId}`);
    process.exit(1);
  }

  console.log(`CERTIFICATION HISTORY: ${certId}`);
  console.log("=".repeat(50));
  console.log("");

  for (const entry of cert.statusHistory) {
    const date = new Date(entry.changedAt).toISOString().replace("T", " ").split(".")[0];
    const scoreStr = entry.score !== undefined ? ` (score: ${entry.score})` : "";
    console.log(`  ${date}  [${entry.status.toUpperCase()}]  ${entry.reason}${scoreStr}`);
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// CERT EXPIRING
// ---------------------------------------------------------------------------

async function handleCertExpiring(args: string[]): Promise<void> {
  let withinDays = 30;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--within":
        withinDays = parseInt(args[++i], 10) || 30;
        break;
      case "--json":
        jsonOutput = true;
        break;
    }
  }

  const engine = await getCertEngine();
  const expiring = engine.getExpiringCertifications(withinDays);

  if (expiring.length === 0) {
    if (jsonOutput) {
      process.stdout.write("[]");
    } else {
      console.log(`No expiring certifications within ${withinDays} days.`);
    }
    return;
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(expiring, null, 2));
    return;
  }

  console.log(`EXPIRING CERTIFICATIONS (within ${withinDays} days)`);
  console.log("=".repeat(50));
  console.log("");

  for (const cert of expiring) {
    const expiresDate = cert.expiresAt
      ? new Date(cert.expiresAt).toISOString().split("T")[0]
      : "N/A";
    console.log(`  ${cert.id}  ${cert.status}  score:${cert.currentScore}  expires:${expiresDate}`);
  }
  console.log("");
}

// =============================================================================
// TPRM
// =============================================================================

async function handleTprm(): Promise<void> {
  const args = process.argv.slice(3);
  const tprmSubcommand = args[0];

  // Handle help flags and no subcommand
  if (!tprmSubcommand || tprmSubcommand === "--help" || tprmSubcommand === "-h") {
    printTprmHelp();
    return;
  }

  switch (tprmSubcommand) {
    case "register":
      await handleTprmRegister(args.slice(1));
      break;
    case "assess":
      await handleTprmAssess(args.slice(1));
      break;
    case "vendors":
      await handleTprmVendors(args.slice(1));
      break;
    case "assessment":
      await handleTprmAssessment(args.slice(1));
      break;
    case "dashboard":
      await handleTprmDashboard(args.slice(1));
      break;
    default:
      console.error(`Unknown tprm subcommand: ${tprmSubcommand}`);
      console.error('Run "corsair tprm --help" for usage');
      process.exit(1);
  }
}

function printTprmHelp(): void {
  console.log(`
CORSAIR TPRM -- Third-Party Risk Management Automation

USAGE:
  corsair tprm <subcommand> [options]

SUBCOMMANDS:
  register    Register a new vendor
  assess      Assess a vendor using CPOEs
  vendors     List registered vendors
  assessment  Get a single assessment result
  dashboard   Show TPRM dashboard summary

EXAMPLES:
  corsair tprm register --name "Acme Cloud" --domain acme.com --risk-tier high --tags cloud,saas
  corsair tprm assess --vendor <id> --frameworks SOC2,NIST-800-53 --cpoes cpoe1.jwt cpoe2.jwt
  corsair tprm vendors [--risk-tier high] [--tag cloud]
  corsair tprm assessment <id>
  corsair tprm dashboard

OPTIONS:
  -h, --help    Show this help
`);
}

async function getTprmEngine() {
  if (!_tprmEngineInstance) {
    const { TPRMEngine } = await import("./src/tprm/tprm-engine");
    _tprmEngineInstance = new TPRMEngine();
  }
  return _tprmEngineInstance as import("./src/tprm/tprm-engine").TPRMEngine;
}

// ---------------------------------------------------------------------------
// TPRM REGISTER
// ---------------------------------------------------------------------------

async function handleTprmRegister(args: string[]): Promise<void> {
  let name: string | undefined;
  let domain: string | undefined;
  let riskTier = "medium";
  let tags: string[] = [];
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--name":
        name = args[++i];
        break;
      case "--domain":
        domain = args[++i];
        break;
      case "--risk-tier":
        riskTier = args[++i] || "medium";
        break;
      case "--tags":
        tags = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--json":
        jsonOutput = true;
        break;
    }
  }

  if (!name) {
    console.error("Error: --name is required");
    console.error('Run "corsair tprm register --help" for usage');
    process.exit(2);
  }

  if (!domain) {
    console.error("Error: --domain is required");
    console.error('Run "corsair tprm register --help" for usage');
    process.exit(2);
  }

  const engine = await getTprmEngine();
  type RiskTier = import("./src/tprm/types").RiskTier;

  const vendor = engine.registerVendor({
    name,
    domain,
    did: `did:web:${domain}`,
    riskTier: riskTier as RiskTier,
    tags,
  });

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(vendor, null, 2));
  } else {
    console.log("Vendor registered successfully.");
    console.log(`  ID:        ${vendor.id}`);
    console.log(`  Name:      ${vendor.name}`);
    console.log(`  Domain:    ${vendor.domain}`);
    console.log(`  DID:       ${vendor.did}`);
    console.log(`  Risk Tier: ${vendor.riskTier}`);
    console.log(`  Tags:      ${vendor.tags.length > 0 ? vendor.tags.join(", ") : "(none)"}`);
  }
}

// ---------------------------------------------------------------------------
// TPRM ASSESS
// ---------------------------------------------------------------------------

async function handleTprmAssess(args: string[]): Promise<void> {
  let vendorId: string | undefined;
  let frameworks: string[] = [];
  const cpoePaths: string[] = [];
  let jsonOutput = false;
  let minimumScore = 70;
  let minimumAssurance = 0;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--vendor":
        vendorId = args[++i];
        break;
      case "--frameworks":
        frameworks = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--cpoes":
        // Consume all subsequent args that don't start with "--" as file paths
        i++;
        while (i < args.length && !args[i].startsWith("--")) {
          cpoePaths.push(args[i]);
          i++;
        }
        i--; // Back up one since the for loop will increment
        break;
      case "--min-score":
        minimumScore = parseInt(args[++i], 10) || 70;
        break;
      case "--min-assurance":
        minimumAssurance = parseInt(args[++i], 10) || 0;
        break;
      case "--json":
        jsonOutput = true;
        break;
    }
  }

  if (!vendorId) {
    console.error("Error: --vendor is required");
    console.error('Run "corsair tprm assess --help" for usage');
    process.exit(2);
  }

  if (frameworks.length === 0) {
    console.error("Error: --frameworks is required");
    console.error('Run "corsair tprm assess --help" for usage');
    process.exit(2);
  }

  if (cpoePaths.length === 0) {
    console.error("Error: --cpoes is required");
    console.error('Run "corsair tprm assess --help" for usage');
    process.exit(2);
  }

  const engine = await getTprmEngine();
  const vendor = engine.getVendor(vendorId);
  if (!vendor) {
    console.error(`Error: Vendor not found: ${vendorId}`);
    process.exit(1);
  }

  // Validate CPOE files exist
  for (const cpoePath of cpoePaths) {
    if (!existsSync(cpoePath)) {
      console.error(`Error: CPOE file not found: ${cpoePath}`);
      process.exit(2);
    }
  }

  // Read and decode CPOEs
  const cpoes: Array<{
    score: import("./src/scoring/types").EvidenceQualityScore;
    iat: number;
    exp: number;
    vc: {
      credentialSubject: {
        frameworks?: Record<string, unknown>;
        assurance?: { declared?: number };
        summary?: {
          controlsTested?: number;
          controlsPassed?: number;
          controlsFailed?: number;
          overallScore?: number;
        };
      };
    };
  }> = [];

  for (const cpoePath of cpoePaths) {
    const jwt = readFileSync(cpoePath, "utf-8").trim();
    const payload = decodeJwtPayload(jwt);
    if (!payload) {
      console.error(`Error: Could not decode CPOE: ${cpoePath}`);
      process.exit(2);
    }

    // Extract minimal CPOE input shape
    const vc = payload.vc as Record<string, unknown> | undefined;
    const credentialSubject = (vc?.credentialSubject as Record<string, unknown>) || {};
    const summary = credentialSubject.summary as Record<string, unknown> | undefined;

    cpoes.push({
      score: {
        composite: (summary?.overallScore as number) || 0,
        grade: "C",
        dimensions: [],
        controlCount: (summary?.controlsTested as number) || 0,
      },
      iat: (payload.iat as number) || Math.floor(Date.now() / 1000),
      exp: (payload.exp as number) || Math.floor(Date.now() / 1000) + 86400 * 90,
      vc: {
        credentialSubject: {
          frameworks: credentialSubject.frameworks as Record<string, unknown> | undefined,
          assurance: credentialSubject.assurance as { declared?: number } | undefined,
          summary: summary as {
            controlsTested?: number;
            controlsPassed?: number;
            controlsFailed?: number;
            overallScore?: number;
          } | undefined,
        },
      },
    });
  }

  // Request and run assessment
  const request = engine.requestAssessment(vendorId, {
    requestedBy: "corsair-cli",
    frameworks,
    minimumScore,
    minimumAssurance,
  });

  const result = engine.runAssessment(request.id, cpoes);

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(result, null, 2));
  } else {
    console.log("ASSESSMENT RESULT");
    console.log("=================");
    console.log(`  Assessment ID: ${result.id}`);
    console.log(`  Vendor:        ${vendor.name} (${vendorId})`);
    console.log(`  CPOEs:         ${result.cpoeCount}`);
    console.log(`  Composite:     ${result.compositeScore}/100`);
    console.log(`  Decision:      ${result.decision.toUpperCase()}`);
    console.log(`  Reason:        ${result.decisionReason}`);
    console.log("");

    console.log("  SCORE BREAKDOWN:");
    const bd = result.scoreBreakdown;
    console.log(`    Evidence Quality:      ${bd.evidenceQuality}`);
    console.log(`    Certification Status:  ${bd.certificationStatus}`);
    console.log(`    Framework Coverage:    ${bd.frameworkCoverage}`);
    console.log(`    Freshness:             ${bd.freshness}`);
    console.log(`    Historical Trend:      ${bd.historicalTrend}`);

    if (result.findings.length > 0) {
      console.log("");
      console.log(`  FINDINGS (${result.findings.length}):`);
      for (const f of result.findings) {
        console.log(`    [${f.severity.toUpperCase()}] ${f.title}`);
      }
    }

    if (result.conditions && result.conditions.length > 0) {
      console.log("");
      console.log("  CONDITIONS:");
      for (const c of result.conditions) {
        console.log(`    - ${c}`);
      }
    }
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// TPRM VENDORS
// ---------------------------------------------------------------------------

async function handleTprmVendors(args: string[]): Promise<void> {
  let riskTier: string | undefined;
  let tag: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--risk-tier":
        riskTier = args[++i];
        break;
      case "--tag":
        tag = args[++i];
        break;
      case "--json":
        jsonOutput = true;
        break;
    }
  }

  const engine = await getTprmEngine();
  type RiskTier = import("./src/tprm/types").RiskTier;

  const vendors = engine.listVendors({
    riskTier: riskTier as RiskTier | undefined,
    tag,
  });

  if (vendors.length === 0) {
    if (jsonOutput) {
      process.stdout.write("[]");
    } else {
      console.log("No vendors registered.");
    }
    return;
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(vendors, null, 2));
    return;
  }

  console.log("VENDORS");
  console.log("=======");
  console.log("");
  console.log(
    "  ID".padEnd(44) +
    "Name".padEnd(20) +
    "Risk".padEnd(12) +
    "Domain",
  );
  console.log("  " + "-".repeat(80));

  for (const v of vendors) {
    console.log(
      `  ${v.id.padEnd(42)}${v.name.padEnd(20)}${v.riskTier.padEnd(12)}${v.domain}`,
    );
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// TPRM ASSESSMENT
// ---------------------------------------------------------------------------

async function handleTprmAssessment(args: string[]): Promise<void> {
  const assessmentId = args.find((a) => !a.startsWith("--"));
  let jsonOutput = args.includes("--json");

  if (!assessmentId) {
    console.error("Error: assessment ID is required");
    console.error('Usage: corsair tprm assessment <id>');
    process.exit(2);
  }

  const engine = await getTprmEngine();
  const result = engine.getAssessment(assessmentId);

  if (!result) {
    console.error(`Error: Assessment not found: ${assessmentId}`);
    process.exit(1);
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(result, null, 2));
  } else {
    console.log(`ASSESSMENT: ${result.id}`);
    console.log(`  Vendor:    ${result.vendorId}`);
    console.log(`  Score:     ${result.compositeScore}/100`);
    console.log(`  Decision:  ${result.decision.toUpperCase()}`);
    console.log(`  CPOEs:     ${result.cpoeCount}`);
    console.log(`  Assessed:  ${result.assessedAt}`);
  }
}

// ---------------------------------------------------------------------------
// TPRM DASHBOARD
// ---------------------------------------------------------------------------

async function handleTprmDashboard(args: string[]): Promise<void> {
  let jsonOutput = args.includes("--json");

  const engine = await getTprmEngine();
  const dashboard = engine.getDashboard();

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(dashboard, null, 2));
  } else {
    console.log("TPRM DASHBOARD");
    console.log("==============");
    console.log("");
    console.log(`  Total Vendors:         ${dashboard.totalVendors}`);
    console.log(`  Average Score:         ${dashboard.averageScore}`);
    console.log(`  Vendors Needing Review: ${dashboard.vendorsNeedingReview}`);
    console.log(`  Expiring Assessments:  ${dashboard.expiringAssessments}`);
    console.log("");

    console.log("  BY RISK TIER:");
    for (const [tier, count] of Object.entries(dashboard.byRiskTier)) {
      console.log(`    ${tier.padEnd(12)} ${count}`);
    }
    console.log("");

    console.log("  BY DECISION:");
    for (const [decision, count] of Object.entries(dashboard.byDecision)) {
      console.log(`    ${decision.padEnd(18)} ${count}`);
    }

    if (dashboard.recentAssessments.length > 0) {
      console.log("");
      console.log("  RECENT ASSESSMENTS:");
      for (const a of dashboard.recentAssessments) {
        const date = a.assessedAt.split("T")[0];
        console.log(`    ${date}  ${a.vendorId}  score:${a.compositeScore}  ${a.decision}`);
      }
    }
    console.log("");
  }
}

// =============================================================================
// HELP
// =============================================================================

function printHelp(): void {
  let version = "0.6.0";
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
  audit     Run a full compliance audit              like git bisect
  cert      Manage continuous compliance certifications
  tprm      Third-party risk management automation
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
