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
import { VERSION } from "./src/version";

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
  case "demo-keygen":
    await handleDemoKeygen();
    break;
  case "compliance-txt":
    await handleComplianceTxt();
    break;
  case "init":
    await handleInit();
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${subcommand}`);
    console.error("  Available: init, sign, verify, diff, log, keygen, compliance-txt, help");
    console.error('  Run "corsair help" for details');
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
  let sdJwt = false;
  let sdFields: string[] | undefined;

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
      case "--sd-jwt":
        sdJwt = true;
        break;
      case "--sd-fields":
        sdFields = (args[++i] || "").split(",").filter(Boolean);
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
  cat evidence.json | corsair sign          Pipe from stdin (auto-detect)

OPTIONS:
  -f, --file <PATH>         Path to evidence JSON file (or "-" for stdin)
  -o, --output <PATH>       Write JWT-VC to file (default: <input>.cpoe.jwt)
  -F, --format <NAME>       Force evidence format (bypass auto-detection)
      --key-dir <DIR>       Ed25519 key directory (default: ./keys)
      --did <DID>           Issuer DID (default: derived from key)
      --scope <TEXT>        Override scope string
      --expiry-days <N>     CPOE validity in days (default: 90)
      --dry-run             Parse + classify but don't sign. Output would-be subject.
      --json                Output structured JSON (jwt + metadata) to stdout
      --sd-jwt              Enable SD-JWT selective disclosure
      --sd-fields <FIELDS>  Comma-separated fields to make disclosable (default: summary,frameworks)
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
  corsair sign --file evidence.json --sd-jwt --sd-fields summary,provenance
  cat trivy-report.json | corsair sign --format trivy --output cpoe.jwt
`);
    return;
  }

  // Determine input source: file, stdin flag, or piped stdin (auto-detect)
  let rawJson: string;
  const isStdinExplicit = filePath === "-";
  const isStdinPiped = !process.stdin.isTTY && !filePath;

  if (isStdinExplicit || isStdinPiped) {
    if (verbose && !quiet) console.error("Reading evidence from stdin...");
    rawJson = await new Response(Bun.stdin.stream()).text();
    if (!rawJson.trim()) {
      if (isStdinExplicit) {
        console.error("Error: Empty input from stdin.");
        console.error("  Pipe evidence JSON: cat evidence.json | corsair sign --file -");
      } else {
        // Auto-detected stdin was empty — treat as "no input provided"
        console.error("Error: No evidence provided.");
        console.error("  Sign a file:  corsair sign --file evidence.json");
        console.error("  Pipe stdin:   cat evidence.json | corsair sign");
        console.error('  See options:  corsair sign --help');
      }
      process.exit(2);
    }
  } else if (filePath) {
    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      console.error(`  Check the path and try again: corsair sign --file <path>`);
      process.exit(2);
    }
    rawJson = readFileSync(filePath, "utf-8");
  } else {
    console.error("Error: No evidence provided.");
    console.error("  Sign a file:  corsair sign --file evidence.json");
    console.error("  Pipe stdin:   cat evidence.json | corsair sign");
    console.error('  See options:  corsair sign --help');
    process.exit(2);
  }

  // Load key manager — auto-generate keys on first use
  const { MarqueKeyManager } = await import("./src/parley/marque-key-manager");
  const keyManager = new MarqueKeyManager(keyDir);
  let keypair = await keyManager.loadKeypair();
  if (!keypair) {
    if (!quiet) console.error("No signing keys found. Generating Ed25519 keypair...");
    await keyManager.generateKeypair();
    keypair = await keyManager.loadKeypair();
    if (!quiet) {
      console.error(`  Private key: ${keyDir}/corsair-signing.key`);
      console.error(`  Public key:  ${keyDir}/corsair-signing.pub`);
    }
  }

  // Show progress indicator for large files
  const rawSize = Buffer.byteLength(rawJson);
  if (!quiet && !jsonOutput && rawSize > 1_000_000) {
    console.error(`Processing ${(rawSize / 1_000_000).toFixed(1)}MB of evidence...`);
  } else if (verbose && !quiet) {
    console.error("Parsing evidence...");
  }

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
      sdJwt,
      sdFields,
    }, keyManager);

    // Always show compact summary (not just with --verbose)
    if (!quiet && !jsonOutput) {
      console.error(`  Format:     ${result.detectedFormat} (${format ? "forced" : "auto-detected"})`);
      console.error(`  Controls:   ${result.summary.controlsTested} tested, ${result.summary.controlsPassed} passed, ${result.summary.controlsFailed} failed (${result.summary.overallScore}%)`);
      console.error(`  Provenance: ${result.provenance.source} (${result.provenance.sourceIdentity || "unknown"})`);
    }

    // Show warnings
    for (const w of result.warnings) {
      if (!quiet) console.error(`Warning: ${w}`);
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
      if (sdJwt) {
        dryOutput.sdJwt = true;
        dryOutput.sdFields = sdFields ?? ["summary", "frameworks"];
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
      if (result.disclosures) {
        structuredOutput.disclosures = result.disclosures;
      }
      process.stdout.write(JSON.stringify(structuredOutput, null, 2));
      return;
    }

    // Determine output path: explicit --output, auto-derive from input, or stdout
    const isTTY = process.stdout.isTTY;
    const effectiveOutputPath = outputPath
      ?? (filePath && filePath !== "-" && isTTY
        ? filePath.replace(/\.json$/i, "") + ".cpoe.jwt"
        : undefined);

    // Check if a previous CPOE exists at the output path (for auto-diff)
    let previousJwt: string | undefined;
    if (effectiveOutputPath && existsSync(effectiveOutputPath)) {
      try {
        previousJwt = readFileSync(effectiveOutputPath, "utf-8").trim();
        if (!previousJwt.startsWith("eyJ")) previousJwt = undefined;
      } catch { previousJwt = undefined; }
    }

    // Standard output
    if (effectiveOutputPath) {
      const { writeFileSync } = await import("fs");
      writeFileSync(effectiveOutputPath, result.jwt);
      if (!quiet) {
        const size = Buffer.byteLength(result.jwt);
        console.error(`\nCPOE signed successfully.`);
        console.error(`  Output:     ${effectiveOutputPath} (${size.toLocaleString()} bytes)`);
        console.error(`  Verify:     corsair verify --file ${effectiveOutputPath}`);

        // Auto-diff: if a previous CPOE existed, show quick regression summary
        if (previousJwt) {
          try {
            const prevPayload = decodeJwtPayload(previousJwt);
            const newPayload = decodeJwtPayload(result.jwt);
            const prevScore = (prevPayload?.vc as any)?.credentialSubject?.summary?.overallScore;
            const newScore = (newPayload?.vc as any)?.credentialSubject?.summary?.overallScore;
            if (typeof prevScore === "number" && typeof newScore === "number") {
              const delta = newScore - prevScore;
              const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "\u2192";
              console.error(`  Diff:       ${prevScore}% ${arrow} ${newScore}% (${delta > 0 ? "+" : ""}${delta}pp vs previous)`);
            }
          } catch { /* non-critical */ }
        }
      }
    } else {
      // Write JWT to stdout (for piping), info to stderr
      process.stdout.write(result.jwt);
      if (!quiet && isTTY) {
        console.error(`\n  Verify: corsair verify --file <saved.jwt>`);
      }
    }
  } catch (err) {
    if (err instanceof SignError) {
      console.error(`Error: ${err.message}`);
      // Provide actionable guidance based on common errors
      if (err.message.includes("No controls found") || err.message.includes("empty")) {
        console.error("  Check that your evidence file matches a supported format.");
        console.error("  Supported: generic, prowler, securityhub, inspec, trivy, gitlab, ciso-assistant");
        console.error("  Force format: corsair sign --file <path> --format <name>");
      } else if (err.message.includes("keypair") || err.message.includes("key")) {
        console.error("  Generate keys: corsair keygen");
      } else if (err.message.includes("parse") || err.message.includes("JSON")) {
        console.error("  Ensure the file is valid JSON: cat <file> | jq .");
      }
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
  let jsonOutput = false;
  let verify = false;

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
      case "--json":
        jsonOutput = true;
        break;
      case "--verify":
        verify = true;
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
      --verify              Verify signatures via DID:web before diffing
      --json                Output structured JSON
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

  if (verify) {
    const { verifyVCJWTViaDID } = await import("./src/parley/vc-verifier");
    const currentVerification = await verifyVCJWTViaDID(currentJwt);
    if (!currentVerification.valid) {
      console.error(`Error: current CPOE verification failed (${currentVerification.reason || "invalid"})`);
      process.exit(2);
    }
    const previousVerification = await verifyVCJWTViaDID(previousJwt);
    if (!previousVerification.valid) {
      console.error(`Error: previous CPOE verification failed (${previousVerification.reason || "invalid"})`);
      process.exit(2);
    }
  }

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

  // Score comparison
  const currentScore = currentSubject.summary?.overallScore ?? 0;
  const previousScore = previousSubject.summary?.overallScore ?? 0;
  const scoreChange = currentScore - previousScore;

  // Output results
  const hasRegression = newFailures.length > 0 || scoreChange < 0;

  if (jsonOutput) {
    const report = {
      score: {
        previous: previousScore,
        current: currentScore,
        change: scoreChange,
      },
      regressions: newFailures,
      improvements,
      added: addedControls,
      removed: removedControls,
      result: hasRegression ? "regression" : "ok",
    };
    process.stdout.write(JSON.stringify(report, null, 2));
    process.exit(hasRegression ? 1 : 0);
  }

  console.log("CORSAIR DIFF REPORT");
  console.log("===================");
  console.log("");

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
// DEMO KEYGEN
// =============================================================================

async function handleDemoKeygen(): Promise<void> {
  const args = process.argv.slice(3);
  let did = "did:web:demo.grcorsair.com";
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--did":
        did = args[++i];
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR DEMO KEYGEN — Generate demo signing keys (local dev)

USAGE:
  corsair demo-keygen [--did <did>]

OPTIONS:
  --did <DID>    Demo DID to export (default: did:web:demo.grcorsair.com)
  -h, --help     Show this help

This prints env exports for CORSAIR_DEMO_PUBLIC_KEY and CORSAIR_DEMO_PRIVATE_KEY.
Do NOT use these keys in production.
`);
    return;
  }

  const crypto = await import("crypto");
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  console.log(`\n# Demo signing keys (DO NOT USE IN PRODUCTION)\n`);
  console.log(`export CORSAIR_DEMO_PUBLIC_KEY='${publicKey.trim().replace(/'/g, "'\\\\''")}'`);
  console.log(`export CORSAIR_DEMO_PRIVATE_KEY='${privateKey.trim().replace(/'/g, "'\\\\''")}'`);
  console.log(`export CORSAIR_DEMO_DID='${did}'\n`);
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
// COMPLIANCE-TXT
// =============================================================================

async function handleComplianceTxt(): Promise<void> {
  const args = process.argv.slice(3);
  const ctSubcommand = args[0];

  if (!ctSubcommand || ctSubcommand === "--help" || ctSubcommand === "-h") {
    printComplianceTxtHelp();
    return;
  }

  switch (ctSubcommand) {
    case "generate":
      await handleComplianceTxtGenerate(args.slice(1));
      break;
    case "validate":
      await handleComplianceTxtValidate(args.slice(1));
      break;
    case "discover":
      await handleComplianceTxtDiscover(args.slice(1));
      break;
    default:
      console.error(`Unknown compliance-txt subcommand: ${ctSubcommand}`);
      console.error('Run "corsair compliance-txt --help" for usage');
      process.exit(1);
  }
}

function printComplianceTxtHelp(): void {
  console.log(`
CORSAIR COMPLIANCE-TXT -- Compliance proof discovery at /.well-known/

USAGE:
  corsair compliance-txt <subcommand> [options]

SUBCOMMANDS:
  generate    Generate a compliance.txt from local config
  validate    Fetch and validate a domain's compliance.txt
  discover    Fetch compliance.txt, list CPOEs, verify each

ABOUT:
  compliance.txt is a discovery layer for compliance proofs, modeled after
  security.txt (RFC 9116). Organizations publish /.well-known/compliance.txt
  to advertise their DID identity, CPOE proofs, SCITT log, and signal endpoints.

  Standard           | Discovery for...
  ------------------- | ----------------
  robots.txt          | Web crawlers
  security.txt        | Vulnerability reporters
  openid-configuration| Auth clients
  compliance.txt      | Compliance verifiers + agentic audits

  Origin: @toufik-airane (github.com/grcorsair/corsair/issues/2)
  Spec:   https://grcorsair.com/spec/compliance-txt

EXAMPLES:
  corsair compliance-txt generate --did did:web:acme.com --cpoes ./cpoes/ --output compliance.txt
  corsair compliance-txt validate acme.com
  corsair compliance-txt discover acme.com
  corsair compliance-txt discover acme.com --verify

OPTIONS:
  -h, --help    Show this help
`);
}

// ---------------------------------------------------------------------------
// COMPLIANCE-TXT GENERATE
// ---------------------------------------------------------------------------

async function handleComplianceTxtGenerate(args: string[]): Promise<void> {
  let did: string | undefined;
  let cpoeDir: string | undefined;
  let cpoeUrls: string[] = [];
  let scitt: string | undefined;
  let flagship: string | undefined;
  let frameworks: string[] = [];
  let contact: string | undefined;
  let expiryDays = 365;
  let outputPath: string | undefined;
  let baseUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--did":
        did = args[++i];
        break;
      case "--cpoes":
        cpoeDir = args[++i];
        break;
      case "--cpoe-url":
        cpoeUrls.push(args[++i]);
        break;
      case "--scitt":
        scitt = args[++i];
        break;
      case "--flagship":
        flagship = args[++i];
        break;
      case "--frameworks":
        frameworks = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--contact":
        contact = args[++i];
        break;
      case "--expiry-days":
        expiryDays = parseInt(args[++i], 10) || 365;
        break;
      case "--output":
      case "-o":
        outputPath = args[++i];
        break;
      case "--base-url":
        baseUrl = args[++i];
        break;
      case "--help":
      case "-h":
        console.log(`
CORSAIR COMPLIANCE-TXT GENERATE -- Create a compliance.txt

USAGE:
  corsair compliance-txt generate --did <DID> [options]

OPTIONS:
  --did <DID>              DID:web identity (required)
  --cpoes <DIR>            Directory to scan for .jwt CPOE files
  --cpoe-url <URL>         Add a CPOE URL (repeatable)
  --base-url <URL>         Base URL to prefix scanned CPOE filenames
  --scitt <URL>            SCITT transparency log endpoint
  --flagship <URL>         FLAGSHIP signal stream endpoint
  --frameworks <LIST>      Comma-separated framework names
  --contact <EMAIL>        Compliance contact email
  --expiry-days <N>        Validity in days (default: 365)
  -o, --output <PATH>      Write to file (default: stdout)
  -h, --help               Show this help

EXAMPLES:
  corsair compliance-txt generate --did did:web:acme.com --cpoe-url https://acme.com/soc2.jwt
  corsair compliance-txt generate --did did:web:acme.com --cpoes ./cpoes/ --output compliance.txt
`);
        return;
    }
  }

  if (!did) {
    console.error("Error: --did is required");
    console.error('Run "corsair compliance-txt generate --help" for usage');
    process.exit(2);
  }

  // Scan directory for .jwt files if specified
  if (cpoeDir) {
    const { readdirSync } = await import("fs");
    const { join } = await import("path");
    try {
      const files = readdirSync(cpoeDir);
      for (const file of files) {
        if (file.endsWith(".jwt")) {
          if (baseUrl) {
            const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
            try {
              cpoeUrls.push(new URL(file, normalizedBase).toString());
            } catch {
              cpoeUrls.push(join(cpoeDir, file));
            }
          } else {
            // Use the file path as a URL placeholder — user should replace with actual URLs
            cpoeUrls.push(join(cpoeDir, file));
          }
        }
      }
    } catch {
      console.error(`Error: Cannot read directory: ${cpoeDir}`);
      process.exit(2);
    }
    if (!baseUrl) {
      console.error("Note: --cpoes without --base-url uses local file paths. Replace with public URLs before publishing.");
    }
  }

  // Calculate expiry
  const expiresDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const { generateComplianceTxt } = await import("./src/parley/compliance-txt");

  const output = generateComplianceTxt({
    did,
    cpoes: cpoeUrls,
    scitt,
    flagship,
    frameworks,
    contact,
    expires: expiresDate.toISOString(),
  });

  if (outputPath) {
    const { writeFileSync } = await import("fs");
    writeFileSync(outputPath, output);
    console.error("compliance.txt generated successfully.");
    console.error(`  Output: ${outputPath}`);
    console.error(`  Host at: https://${did.replace("did:web:", "")}/.well-known/compliance.txt`);
  } else {
    process.stdout.write(output);
  }
}

// ---------------------------------------------------------------------------
// COMPLIANCE-TXT VALIDATE
// ---------------------------------------------------------------------------

async function handleComplianceTxtValidate(args: string[]): Promise<void> {
  const domain = args.find(a => !a.startsWith("--"));
  const jsonOutput = args.includes("--json");

  if (!domain) {
    console.error("Error: domain is required");
    console.error('Usage: corsair compliance-txt validate <domain>');
    process.exit(2);
  }

  const { resolveComplianceTxt, validateComplianceTxt } = await import("./src/parley/compliance-txt");

  console.error(`Fetching https://${domain}/.well-known/compliance.txt ...`);

  const resolution = await resolveComplianceTxt(domain);

  if (!resolution.complianceTxt) {
    console.error(`Error: ${resolution.error}`);
    process.exit(1);
  }

  const validation = validateComplianceTxt(resolution.complianceTxt);

  if (jsonOutput) {
    process.stdout.write(JSON.stringify({
      domain,
      complianceTxt: resolution.complianceTxt,
      validation,
    }, null, 2));
    return;
  }

  console.log(`COMPLIANCE.TXT VALIDATION: ${domain}`);
  console.log("=".repeat(50));
  console.log("");
  console.log(`  DID:        ${resolution.complianceTxt.did || "(missing)"}`);
  console.log(`  CPOEs:      ${resolution.complianceTxt.cpoes.length}`);
  console.log(`  Frameworks: ${resolution.complianceTxt.frameworks.join(", ") || "(none)"}`);
  console.log(`  Contact:    ${resolution.complianceTxt.contact || "(none)"}`);
  console.log(`  Expires:    ${resolution.complianceTxt.expires || "(none)"}`);
  console.log(`  SCITT:      ${resolution.complianceTxt.scitt || "(none)"}`);
  console.log(`  FLAGSHIP:   ${resolution.complianceTxt.flagship || "(none)"}`);
  console.log("");

  if (validation.valid) {
    console.log("  RESULT: VALID");
  } else {
    console.log("  RESULT: INVALID");
    for (const error of validation.errors) {
      console.log(`    - ${error}`);
    }
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// COMPLIANCE-TXT DISCOVER
// ---------------------------------------------------------------------------

async function handleComplianceTxtDiscover(args: string[]): Promise<void> {
  const domain = args.find(a => !a.startsWith("--"));
  const jsonOutput = args.includes("--json");
  const verify = args.includes("--verify");

  if (!domain) {
    console.error("Error: domain is required");
    console.error('Usage: corsair compliance-txt discover <domain>');
    process.exit(2);
  }

  const { resolveComplianceTxt, validateComplianceTxt } = await import("./src/parley/compliance-txt");

  console.error(`Discovering compliance proofs for ${domain}...`);
  console.error(`Fetching https://${domain}/.well-known/compliance.txt ...`);

  const resolution = await resolveComplianceTxt(domain);

  if (!resolution.complianceTxt) {
    console.error(`Error: ${resolution.error}`);
    process.exit(1);
  }

  const ct = resolution.complianceTxt;
  const validation = validateComplianceTxt(ct);
  let verificationResults: Array<{ url: string; valid: boolean; reason?: string; issuer?: string; trustTier?: string }> = [];

  if (verify && ct.cpoes.length > 0) {
    const { verifyVCJWTViaDID } = await import("./src/parley/vc-verifier");
    for (const url of ct.cpoes) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
        if (!res.ok) {
          verificationResults.push({ url, valid: false, reason: `HTTP ${res.status}` });
          continue;
        }
        const text = (await res.text()).trim();
        let jwt = text;
        if (text.startsWith("{")) {
          try {
            const parsed = JSON.parse(text);
            jwt = parsed.cpoe || parsed.jwt || "";
          } catch {
            jwt = "";
          }
        }
        if (!jwt) {
          verificationResults.push({ url, valid: false, reason: "No JWT found" });
          continue;
        }
        const result = await verifyVCJWTViaDID(jwt);
        verificationResults.push({
          url,
          valid: result.valid,
          reason: result.valid ? undefined : result.reason,
          issuer: result.signedBy,
          trustTier: result.issuerTier,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        verificationResults.push({ url, valid: false, reason: message });
      }
    }
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify({
      domain,
      complianceTxt: ct,
      validation,
      cpoeCount: ct.cpoes.length,
      verification: verify ? verificationResults : undefined,
    }, null, 2));
    return;
  }

  console.log(`COMPLIANCE DISCOVERY: ${domain}`);
  console.log("=".repeat(50));
  console.log("");
  console.log(`  Identity: ${ct.did || "(none)"}`);
  console.log(`  Status:   ${validation.valid ? "VALID" : "INVALID"}`);
  console.log("");

  if (ct.cpoes.length > 0) {
    console.log(`  CPOE PROOFS (${ct.cpoes.length}):`);
    for (let i = 0; i < ct.cpoes.length; i++) {
      console.log(`    #${i + 1}  ${ct.cpoes[i]}`);
    }
    console.log("");
  } else {
    console.log("  No CPOEs published.");
    console.log("");
  }

  if (ct.frameworks.length > 0) {
    console.log(`  FRAMEWORKS: ${ct.frameworks.join(", ")}`);
  }

  if (ct.scitt) {
    console.log(`  SCITT LOG:  ${ct.scitt}`);
  }

  if (ct.flagship) {
    console.log(`  FLAGSHIP:   ${ct.flagship}`);
  }

  if (ct.contact) {
    console.log(`  CONTACT:    ${ct.contact}`);
  }

  if (ct.expires) {
    console.log(`  EXPIRES:    ${ct.expires}`);
  }

  console.log("");

  if (verify && verificationResults.length > 0) {
    console.log("  VERIFICATION:");
    for (const v of verificationResults) {
      if (v.valid) {
        console.log(`    ✓ ${v.url} (${v.trustTier || "unknown"})`);
      } else {
        console.log(`    ✗ ${v.url} — ${v.reason || "invalid"}`);
      }
    }
    console.log("");
  }

  if (!validation.valid) {
    console.log("  VALIDATION ERRORS:");
    for (const error of validation.errors) {
      console.log(`    - ${error}`);
    }
    console.log("");
  }
}

// =============================================================================
// HELP
// =============================================================================

// =============================================================================
// INIT
// =============================================================================

async function handleInit(): Promise<void> {
  const args = process.argv.slice(3);
  let keyDir = "./keys";
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--key-dir":
        keyDir = args[++i];
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR INIT — Set up Corsair in the current directory

USAGE:
  corsair init [--key-dir <dir>]

OPTIONS:
  --key-dir <DIR>    Key directory (default: ./keys)
  -h, --help         Show this help

This command:
  1. Generates an Ed25519 signing keypair (if none exists)
  2. Creates an example evidence file (if none exists)
  3. Shows you how to sign your first CPOE
`);
    return;
  }

  console.log("Initializing Corsair...\n");

  // 1. Generate keys
  const { MarqueKeyManager } = await import("./src/parley/marque-key-manager");
  const keyManager = new MarqueKeyManager(keyDir);
  const existing = await keyManager.loadKeypair();
  if (existing) {
    console.log(`  Keys:     ${keyDir}/ (already exists)`);
  } else {
    await keyManager.generateKeypair();
    console.log(`  Keys:     ${keyDir}/corsair-signing.key (generated)`);
    console.log(`            ${keyDir}/corsair-signing.pub`);
  }

  // 2. Create example evidence file
  const examplePath = "example-evidence.json";
  if (!existsSync(examplePath)) {
    const { writeFileSync } = await import("fs");
    const example = {
      metadata: {
        title: "Example Security Assessment",
        issuer: "Your Organization",
        date: new Date().toISOString().split("T")[0],
        scope: "Production Environment",
      },
      controls: [
        {
          id: "MFA-001",
          description: "Multi-factor authentication enabled",
          status: "pass",
          evidence: "MFA enforced for all user groups",
          framework: "NIST-800-53",
          controlId: "IA-2",
        },
        {
          id: "ENC-001",
          description: "Data at rest encrypted",
          status: "pass",
          evidence: "AES-256 encryption verified",
        },
      ],
    };
    writeFileSync(examplePath, JSON.stringify(example, null, 2));
    console.log(`  Example:  ${examplePath} (created)`);
  } else {
    console.log(`  Example:  ${examplePath} (already exists)`);
  }

  // 3. Next steps
  console.log(`
Ready! Try signing your first CPOE:

  corsair sign --file ${examplePath}

Or sign your own evidence:

  corsair sign --file <your-evidence.json>
`);
}

function printHelp(): void {
  const version = VERSION;
  console.log(`
CORSAIR — Git for Compliance

USAGE:
  corsair <command> [options]

COMMANDS:
  init            Set up Corsair (keys + example)          like git init
  sign            Sign evidence as a CPOE (JWT-VC)        like git commit
  verify          Verify a CPOE signature and integrity
  diff            Detect compliance regressions            like git diff
  log             List signed CPOEs (SCITT log)            like git log
  compliance-txt  Discovery layer (generate/validate/discover)
  renew           Re-sign a CPOE with fresh dates          like git commit --amend
  signal          FLAGSHIP real-time notifications         like git webhooks
  keygen          Generate Ed25519 signing keypair
  demo-keygen     Generate demo signing keys (local dev)
  help            Show this help message

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
