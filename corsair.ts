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
 *   corsair signal generate --event <event.json> --issuer <did> --audience <did>
 *   corsair keygen [--output <dir>]
 *   corsair help
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { VERSION } from "./src/version";
import type { DocumentSource } from "./src/ingestion/types";

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
  case "trust-txt":
    await handleTrustTxt();
    break;
  case "mappings":
    await handleMappings();
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
    console.error("  Available: init, sign, verify, diff, log, keygen, trust-txt, mappings, help");
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
  let baselinePath: string | undefined;
  let keyDir = "./keys";
  let did: string | undefined;
  let scope: string | undefined;
  let expiryDays = 90;
  let showHelp = false;
  let format: string | undefined;
  let source: string | undefined;
  let verbose = false;
  let dryRun = false;
  let jsonOutput = false;
  let quiet = false;
  let showVersion = false;
  let sdJwt = false;
  let sdFields: string[] | undefined;
  let mappingFiles: string[] = [];
  let mappingDirs: string[] = [];
  let gate = false;

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
      case "--baseline":
        baselinePath = args[++i];
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
      case "--source":
        source = args[++i];
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
      case "--gate":
        gate = true;
        break;
      case "--mapping":
        {
          const value = args[++i];
          if (value) {
            if (value.endsWith(".json")) mappingFiles.push(value);
            else mappingDirs.push(value);
          }
        }
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
      --baseline <PATH>     Compare against a baseline CPOE for regression detection
      --gate                Exit 1 if regression detected (requires --baseline)
      --source <SOURCE>     Override document source (affects provenance)
      --sd-jwt              Enable SD-JWT selective disclosure
      --sd-fields <FIELDS>  Comma-separated fields to make disclosable (default: summary,frameworks)
      --mapping <PATH>      Mapping file or directory (repeatable; JSON maps tool output)
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
  corsair sign --file evidence.json --mapping ./mappings/toolx.json
  corsair sign --file evidence.json --baseline baseline.cpoe.jwt --gate
  cat trivy-report.json | corsair sign --format trivy --output cpoe.jwt
`);
    return;
  }

  if (gate && !baselinePath) {
    console.error("Error: --gate requires --baseline <path>");
    process.exit(2);
  }

  if (baselinePath && dryRun) {
    console.error("Error: --baseline cannot be used with --dry-run");
    process.exit(2);
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

  if (baselinePath && !existsSync(baselinePath)) {
    console.error(`Error: Baseline file not found: ${baselinePath}`);
    process.exit(2);
  }

  // Apply mapping registry overrides (CLI only)
  if (mappingFiles.length > 0) {
    const existing = process.env.CORSAIR_MAPPING_FILE;
    const merged = existing ? `${existing},${mappingFiles.join(",")}` : mappingFiles.join(",");
    process.env.CORSAIR_MAPPING_FILE = merged;
  }
  if (mappingDirs.length > 0) {
    const existing = process.env.CORSAIR_MAPPING_DIR;
    const merged = existing ? `${existing},${mappingDirs.join(",")}` : mappingDirs.join(",");
    process.env.CORSAIR_MAPPING_DIR = merged;
  }
  if (mappingFiles.length > 0 || mappingDirs.length > 0) {
    const { resetMappingRegistry } = await import("./src/ingestion/mapping-registry");
    resetMappingRegistry();
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
      source: source as DocumentSource | undefined,
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

    // Optional baseline diff
    let baselineReport: DiffReport | undefined;
    if (baselinePath) {
      const baselineJwt = readFileSync(baselinePath, "utf-8").trim();
      const diffResult = computeDiffResult(result.jwt, baselineJwt);
      if (!diffResult.ok) {
        console.error(`Error: ${diffResult.error}`);
        process.exit(2);
      }
      baselineReport = diffResult.report;
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
        extensions: result.extensions,
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
        extensions: result.extensions,
      };
      if (baselineReport) {
        structuredOutput.baselineDiff = baselineReport;
      }
      if (result.disclosures) {
        structuredOutput.disclosures = result.disclosures;
      }
      process.stdout.write(JSON.stringify(structuredOutput, null, 2));
      if (gate && baselineReport?.result === "regression") process.exit(1);
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

        if (baselineReport) {
          const delta = baselineReport.score.change;
          const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "\u2192";
          console.error(`  Baseline:   ${baselineReport.score.previous}% ${arrow} ${baselineReport.score.current}% (${delta > 0 ? "+" : ""}${delta}pp)`);
          if (baselineReport.result === "regression") {
            console.error("  Baseline:   regression detected");
          }
        }
      }
    } else {
      // Write JWT to stdout (for piping), info to stderr
      process.stdout.write(result.jwt);
      if (!quiet && isTTY) {
        console.error(`\n  Verify: corsair verify --file <saved.jwt>`);
        if (baselineReport) {
          const delta = baselineReport.score.change;
          const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "\u2192";
          console.error(`  Baseline: ${baselineReport.score.previous}% ${arrow} ${baselineReport.score.current}% (${delta > 0 ? "+" : ""}${delta}pp)`);
          if (baselineReport.result === "regression") {
            console.error("  Baseline: regression detected");
          }
        }
      }
    }

    if (gate && baselineReport?.result === "regression") process.exit(1);
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

interface DiffReport {
  score: {
    previous: number;
    current: number;
    change: number;
  };
  regressions: string[];
  improvements: string[];
  added: string[];
  removed: string[];
  result: "regression" | "ok";
}

type DiffResult =
  | { ok: true; report: DiffReport; currentControls: Map<string, DriftControl> }
  | { ok: false; error: string };

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

  const diffResult = computeDiffResult(currentJwt, previousJwt);
  if (!diffResult.ok) {
    console.error(`Error: ${diffResult.error}`);
    process.exit(2);
  }

  const { report, currentControls } = diffResult;
  const { score, regressions, improvements, added, removed, result } = report;
  const hasRegression = result === "regression";

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2));
    process.exit(hasRegression ? 1 : 0);
  }

  console.log("CORSAIR DIFF REPORT");
  console.log("===================");
  console.log("");

  if (score.change !== 0) {
    const arrow = score.change > 0 ? "↑" : "↓";
    console.log(`  Score: ${score.previous}% → ${score.current}% (${arrow}${Math.abs(score.change)})`);
  } else {
    console.log(`  Score: ${score.current}% (unchanged)`);
  }

  console.log("");

  if (regressions.length > 0) {
    console.log(`  REGRESSIONS (${regressions.length}):`);
    for (const id of regressions) {
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

  if (added.length > 0) {
    console.log(`  ADDED (${added.length}):`);
    for (const id of added) {
      const ctrl = currentControls.get(id);
      console.log(`    + ${id} — ${ctrl?.status || "unknown"}`);
    }
    console.log("");
  }

  if (removed.length > 0) {
    console.log(`  REMOVED (${removed.length}):`);
    for (const id of removed) {
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

function stripSdJwt(jwt: string): string {
  const tildeIndex = jwt.indexOf("~");
  if (tildeIndex === -1) return jwt;
  return jwt.slice(0, tildeIndex);
}

/** Decode JWT payload without verification (base64url decode) */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const baseJwt = stripSdJwt(jwt);
    const parts = baseJwt.split(".");
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

function computeDiffResult(currentJwt: string, previousJwt: string): DiffResult {
  const currentPayload = decodeJwtPayload(currentJwt);
  const previousPayload = decodeJwtPayload(previousJwt);

  if (!currentPayload || !previousPayload) {
    return { ok: false, error: "Could not decode one or both CPOE files" };
  }

  const currentSubject = (currentPayload.vc as any)?.credentialSubject;
  const previousSubject = (previousPayload.vc as any)?.credentialSubject;

  if (!currentSubject || !previousSubject) {
    return { ok: false, error: "CPOE files do not contain valid credentialSubject" };
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

  const hasRegression = newFailures.length > 0 || scoreChange < 0;

  return {
    ok: true,
    currentControls,
    report: {
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
    },
  };
}

// =============================================================================
// MAPPINGS
// =============================================================================

async function handleMappings(): Promise<void> {
  const args = process.argv.slice(3);
  const sub = args[0] && !args[0].startsWith("-") ? args[0] : "list";
  const jsonOutput = args.includes("--json");
  const showHelp = args.includes("--help") || args.includes("-h");
  const strict = args.includes("--strict");

  let mappingFiles: string[] = [];
  let mappingDirs: string[] = [];
  let samplePath: string | undefined;
  let addFile: string | undefined;
  let addUrl: string | undefined;
  let addDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mapping") {
      const value = args[i + 1];
      if (value) {
        if (value.endsWith(".json")) mappingFiles.push(value);
        else mappingDirs.push(value);
        i++;
      }
    }
    if (args[i] === "--sample") {
      samplePath = args[i + 1];
      i++;
    }
    if (args[i] === "--file") {
      addFile = args[i + 1];
      i++;
    }
    if (args[i] === "--url") {
      addUrl = args[i + 1];
      i++;
    }
    if (args[i] === "--dir") {
      addDir = args[i + 1];
      i++;
    }
  }

  if (showHelp || (sub !== "list" && sub !== "validate" && sub !== "add")) {
    console.log(`
CORSAIR MAPPINGS — List and validate evidence mappings

USAGE:
  corsair mappings list [options]
  corsair mappings validate [options]
  corsair mappings add <url> [options]

OPTIONS:
      --mapping <PATH>      Mapping file or directory (repeatable)
      --sample <PATH>       Evidence JSON to test mapping (validate only)
      --strict              Require controls mapping (no evidence-only)
      --json                Output structured JSON
      --file <PATH>         Local mapping file or pack to add (add only)
      --url <URL>           Remote mapping file or pack URL (add only)
      --dir <DIR>           Destination directory (add only)
  -h, --help                Show this help

EXAMPLES:
  corsair mappings list
  corsair mappings list --mapping ./mappings/toolx.json
  corsair mappings list --json
  corsair mappings validate --mapping ./mappings/toolx.json --sample ./evidence.json
  corsair mappings validate --strict --json
  corsair mappings add https://example.com/mappings/pack.json
  corsair mappings add --file ./mappings/toolx.json --dir ~/.corsair/mappings
`);
    return;
  }

  if (mappingFiles.length > 0) {
    const existing = process.env.CORSAIR_MAPPING_FILE;
    const merged = existing ? `${existing},${mappingFiles.join(",")}` : mappingFiles.join(",");
    process.env.CORSAIR_MAPPING_FILE = merged;
  }
  if (mappingDirs.length > 0) {
    const existing = process.env.CORSAIR_MAPPING_DIR;
    const merged = existing ? `${existing},${mappingDirs.join(",")}` : mappingDirs.join(",");
    process.env.CORSAIR_MAPPING_DIR = merged;
  }

  const { getMappings, getMappingsWithDiagnostics, mapEvidenceWithMapping, resetMappingRegistry } = await import("./src/ingestion/mapping-registry");
  resetMappingRegistry();

  if (sub === "add") {
    const { mkdirSync, existsSync, copyFileSync, writeFileSync } = await import("fs");
    const { basename, join } = await import("path");
    const { homedir } = await import("os");

    const destinationDir = addDir || join(homedir(), ".corsair", "mappings");
    if (!existsSync(destinationDir)) {
      mkdirSync(destinationDir, { recursive: true });
    }

    let sourceType: "file" | "url" | null = null;
    let sourceValue: string | undefined;

    if (addFile) {
      sourceType = "file";
      sourceValue = addFile;
    } else if (addUrl) {
      sourceType = "url";
      sourceValue = addUrl;
    } else {
      const arg = args.slice(1).find((a) => a && !a.startsWith("--"));
      if (arg) {
        if (arg.startsWith("http://") || arg.startsWith("https://")) {
          sourceType = "url";
          sourceValue = arg;
        } else {
          sourceType = "file";
          sourceValue = arg;
        }
      }
    }

    if (!sourceType || !sourceValue) {
      console.error("Error: provide a URL or file path for mappings add");
      console.error('Usage: corsair mappings add <url> [--dir <dir>] or --file <path>');
      process.exit(2);
    }

    if (sourceType === "file") {
      const filePath = sourceValue;
      if (!existsSync(filePath)) {
        console.error(`Error: file not found: ${filePath}`);
        process.exit(2);
      }
      const destPath = join(destinationDir, basename(filePath));
      copyFileSync(filePath, destPath);
      console.log(`Mapping added: ${destPath}`);
      console.log(`Load with: CORSAIR_MAPPING_DIR=${destinationDir}`);
      return;
    }

    // URL download
    const url = sourceValue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "error" });
      if (!res.ok) {
        console.error(`Error: failed to download mapping (${res.status})`);
        process.exit(1);
      }
      const content = await res.text();
      let filename = "mapping-pack.json";
      try {
        const parsedUrl = new URL(url);
        const base = basename(parsedUrl.pathname);
        if (base && base !== "/") filename = base;
      } catch {
        // ignore
      }
      const destPath = join(destinationDir, filename);
      writeFileSync(destPath, content);
      console.log(`Mapping added: ${destPath}`);
      console.log(`Load with: CORSAIR_MAPPING_DIR=${destinationDir}`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: failed to download mapping: ${message}`);
      process.exit(1);
    }
  }

  if (sub === "list") {
    const mappings = getMappings();

    if (jsonOutput) {
      process.stdout.write(JSON.stringify(mappings, null, 2));
      return;
    }

    if (mappings.length === 0) {
      console.log("No mappings loaded.");
      return;
    }

    console.log("ID\tMODE\tSOURCE\tMATCH\tCONTROLS/PASSTHROUGH");
    for (const mapping of mappings) {
      const hasControls = Boolean(mapping.controls?.path);
      const mode = hasControls ? "controls" : "evidence-only";
      const source = mapping.source ?? "-";

      const matchParts: string[] = [];
      if (mapping.match?.allOf && mapping.match.allOf.length > 0) {
        matchParts.push(`allOf: ${mapping.match.allOf.join(", ")}`);
      }
      if (mapping.match?.anyOf && mapping.match.anyOf.length > 0) {
        matchParts.push(`anyOf: ${mapping.match.anyOf.join(", ")}`);
      }
      const match = matchParts.length > 0 ? matchParts.join(" | ") : "-";

      let detail = "-";
      if (hasControls && mapping.controls?.path) {
        detail = `controls: ${mapping.controls.path}`;
      } else if (mapping.passthrough?.paths) {
        const keys = Object.keys(mapping.passthrough.paths);
        detail = keys.length > 0 ? `passthrough: ${keys.join(", ")}` : "-";
      }

      console.log(`${mapping.id}\t${mode}\t${source}\t${match}\t${detail}`);
    }
    return;
  }

  // validate
  const { mappings, errors: loadErrors } = getMappingsWithDiagnostics();
  const validationErrors: Array<{ type: string; message: string; mappingId?: string; path?: string }> = [
    ...loadErrors.map((e) => ({ type: "load", message: e.error, path: e.path, mappingId: e.mappingId })),
  ];

  for (const mapping of mappings) {
    if (!mapping.id || typeof mapping.id !== "string") {
      validationErrors.push({ type: "schema", message: "Missing required mapping id", mappingId: "(unknown)" });
      continue;
    }

    const hasMatch = Boolean((mapping.match?.allOf && mapping.match.allOf.length > 0)
      || (mapping.match?.anyOf && mapping.match.anyOf.length > 0));
    if (!hasMatch) {
      validationErrors.push({ type: "schema", message: "Missing match rules (allOf/anyOf)", mappingId: mapping.id });
    }

    const hasControls = Boolean(mapping.controls?.path);
    const hasPassthrough = Boolean(mapping.passthrough?.paths && Object.keys(mapping.passthrough.paths).length > 0);

    if (mapping.controls && !mapping.controls.path) {
      validationErrors.push({ type: "schema", message: "controls.path is required when controls is present", mappingId: mapping.id });
    }

    if (strict) {
      if (!hasControls) {
        validationErrors.push({ type: "schema", message: "Strict mode requires controls.path", mappingId: mapping.id });
      }
    } else {
      if (!hasControls && !hasPassthrough) {
        validationErrors.push({ type: "schema", message: "Mapping has neither controls nor passthrough paths", mappingId: mapping.id });
      }
    }
  }

  let sampleData: unknown | null = null;
  if (samplePath) {
    try {
      const raw = readFileSync(samplePath, "utf-8");
      sampleData = JSON.parse(raw);
    } catch {
      validationErrors.push({ type: "sample", message: `Unable to parse sample JSON: ${samplePath}` });
    }
  }

  let sampleHash: string | null = null;
  if (sampleData !== null) {
    const crypto = await import("crypto");
    sampleHash = crypto.createHash("sha256").update(JSON.stringify(sampleData)).digest("hex");
  }

  const mappingReports = mappings.map((mapping) => {
    const hasControls = Boolean(mapping.controls?.path);
    const mode = hasControls ? "controls" : "evidence-only";
    const matchParts: string[] = [];
    if (mapping.match?.allOf && mapping.match.allOf.length > 0) {
      matchParts.push(`allOf: ${mapping.match.allOf.join(", ")}`);
    }
    if (mapping.match?.anyOf && mapping.match.anyOf.length > 0) {
      matchParts.push(`anyOf: ${mapping.match.anyOf.join(", ")}`);
    }
    const match = matchParts.length > 0 ? matchParts.join(" | ") : "-";

    let controlsCount: number | null = null;
    let passthroughKeys: string[] = [];
    let matched: boolean | null = null;

    if (sampleData !== null && sampleHash) {
      const mapped = mapEvidenceWithMapping(sampleData, mapping, sampleHash);
      matched = Boolean(mapped);
      if (mapped) {
        controlsCount = mapped.controls.length;
        const passthrough = (mapped.extensions?.passthrough as Record<string, unknown> | undefined) || {};
        passthroughKeys = Object.keys(passthrough);
        if (strict && controlsCount === 0) {
          validationErrors.push({
            type: "sample",
            message: "Sample matched but produced zero controls (strict mode)",
            mappingId: mapping.id,
          });
        }
      }
    }

    return {
      id: mapping.id,
      mode,
      source: mapping.source ?? "-",
      match,
      controlsPath: mapping.controls?.path ?? null,
      passthroughKeys: mapping.passthrough?.paths ? Object.keys(mapping.passthrough.paths) : [],
      matched,
      controlsCount,
      samplePassthroughKeys: passthroughKeys,
    };
  });

  const ok = validationErrors.length === 0;

  if (jsonOutput) {
    process.stdout.write(JSON.stringify({ ok, errors: validationErrors, mappings: mappingReports }, null, 2));
    if (!ok) process.exit(1);
    return;
  }

  if (!ok) {
    console.error(`Validation failed (${validationErrors.length} issues):`);
    for (const err of validationErrors) {
      const id = err.mappingId ? ` [${err.mappingId}]` : "";
      const path = err.path ? ` (${err.path})` : "";
      console.error(`  - ${err.type}${id}: ${err.message}${path}`);
    }
  } else {
    console.log(`Validation OK (${mappingReports.length} mappings).`);
  }

  if (mappingReports.length > 0) {
    console.log("ID\tMODE\tSOURCE\tMATCH\tDETAIL");
    for (const m of mappingReports) {
      let detail = m.controlsPath ? `controls: ${m.controlsPath}` : `passthrough: ${m.passthroughKeys.join(", ") || "-"}`;
      if (m.matched !== null) {
        detail += ` | matched: ${m.matched ? "yes" : "no"}`;
        if (m.controlsCount !== null) {
          detail += ` | controls: ${m.controlsCount}`;
        }
        if (m.samplePassthroughKeys.length > 0) {
          detail += ` | sample passthrough: ${m.samplePassthroughKeys.join(", ")}`;
        }
      }
      console.log(`${m.id}\t${m.mode}\t${m.source}\t${m.match}\t${detail}`);
    }
  }

  if (!ok) process.exit(1);
}

// =============================================================================
// LOG
// =============================================================================

async function handleLog(): Promise<void> {
  const args = process.argv.slice(3);
  let showHelp = false;
  let last = 10;
  let lastProvided = false;
  let dir = ".";
  let scittUrl: string | undefined;
  let domain: string | undefined;
  let issuer: string | undefined;
  let framework: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        showHelp = true;
        break;
      case "--last":
      case "-n":
        last = parseInt(args[++i], 10) || 10;
        lastProvided = true;
        break;
      case "--dir":
      case "-d":
        dir = args[++i];
        break;
      case "--scitt":
        scittUrl = args[++i];
        break;
      case "--domain":
        domain = args[++i];
        break;
      case "--issuer":
        issuer = args[++i];
        break;
      case "--framework":
        framework = args[++i];
        break;
      case "--json":
        jsonOutput = true;
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
      --scitt <URL>         SCITT log endpoint to query
      --domain <DOMAIN>     Resolve trust.txt and use its SCITT endpoint
      --issuer <DID>        Filter SCITT log by issuer DID
      --framework <NAME>    Filter SCITT log by framework name
      --json                Output structured JSON
  -h, --help                Show this help

EXAMPLES:
  corsair log                         List recent CPOEs in current directory
  corsair log --last 5                Show last 5 CPOEs
  corsair log --dir ./cpoes           Scan specific directory
  corsair log --scitt https://log.example.com/v1/entries --issuer did:web:acme.com
  corsair log --domain acme.com --framework SOC2

NOTE:
  Local mode scans .jwt files on disk. Remote mode queries SCITT logs.
`);
    return;
  }

  if (domain) {
    const { resolveTrustTxt } = await import("./src/parley/trust-txt");
    const resolution = await resolveTrustTxt(domain);
    if (!resolution.trustTxt) {
      console.error(`Error: ${resolution.error || "Failed to resolve trust.txt"}`);
      process.exit(1);
    }
    if (!resolution.trustTxt.scitt) {
      console.error("Error: trust.txt does not publish a SCITT endpoint");
      process.exit(1);
    }
    scittUrl = resolution.trustTxt.scitt;
  }

  if (scittUrl) {
    const { resolveScittEntries } = await import("./src/parley/scitt-client");
    const resolvedUrl = appendScittQuery(scittUrl, {
      issuer,
      framework,
      limit: lastProvided ? String(last) : undefined,
    });
    const resolution = await resolveScittEntries(resolvedUrl);
    if (resolution.error) {
      console.error(`Error: ${resolution.error}`);
      process.exit(1);
    }

    if (jsonOutput) {
      process.stdout.write(JSON.stringify({
        scitt: resolvedUrl,
        entries: resolution.entries,
        pagination: resolution.pagination,
      }, null, 2));
      return;
    }

    console.log("CORSAIR LOG (SCITT)");
    console.log("===================");
    console.log(`  Endpoint: ${resolvedUrl}`);
    console.log(`  Entries:  ${resolution.entries.length}`);
    console.log("");

    for (const entry of resolution.entries) {
      const score = entry.summary?.overallScore ?? "?";
      const source = entry.provenance?.source ?? "unknown";
      const date = entry.registrationTime.split("T")[0];
      console.log(`  ${entry.entryId}  ${entry.scope}  ${score}%  ${source}  ${date}`);
    }

    if (resolution.entries.length === 0) {
      console.log("  No entries found.");
    }
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

  if (jsonOutput) {
    const entries: Array<{
      path: string;
      issuer: string;
      scope: string;
      score: number | string;
      updatedAt: string;
      size: number;
    }> = [];

    for (const entry of jwtFiles) {
      const jwt = readFileSync(entry.path, "utf-8").trim();
      const payload = decodeJwtPayload(jwt);
      const subject = payload?.vc as Record<string, unknown> | undefined;
      const credSubject = subject?.credentialSubject as Record<string, unknown> | undefined;
      const summary = credSubject?.summary as Record<string, unknown> | undefined;
      const score = summary?.overallScore ?? "?";
      entries.push({
        path: entry.path,
        issuer: (payload?.iss as string) || "unknown",
        scope: (credSubject?.scope as string) || "unknown",
        score,
        updatedAt: entry.mtime.toISOString(),
        size: entry.size,
      });
    }

    process.stdout.write(JSON.stringify({
      directory: targetDir,
      entries,
    }, null, 2));
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

function appendScittQuery(
  url: string,
  params: { issuer?: string; framework?: string; limit?: string },
): string {
  try {
    const parsed = new URL(url);
    if (params.issuer) parsed.searchParams.set("issuer", params.issuer);
    if (params.framework) parsed.searchParams.set("framework", params.framework);
    if (params.limit) parsed.searchParams.set("limit", params.limit);
    return parsed.toString();
  } catch {
    return url;
  }
}

// =============================================================================
// SIGNAL
// =============================================================================

async function handleSignal(): Promise<void> {
  const args = process.argv.slice(3);
  const sub = args[0] && !args[0].startsWith("-") ? args[0] : "";
  const showHelp = args.includes("--help") || args.includes("-h") || !sub;

  if (showHelp) {
    console.log(`
CORSAIR SIGNAL — FLAGSHIP real-time compliance change notifications

USAGE:
  corsair signal <command> [options]

COMMANDS:
  generate   Generate a signed SET from a FLAGSHIP event
  verify     Verify a SET signature

GENERATE OPTIONS:
  --event <PATH>       Path to FLAGSHIP event JSON (required)
  --issuer <DID>       Issuer DID (required)
  --audience <DID>     Audience DID (required)
  --key-dir <DIR>      Key directory (default: ./keys)
  --output <PATH>      Write SET to file instead of stdout
  --json               Output structured JSON

VERIFY OPTIONS:
  --file <PATH>        Path to SET JWT file (required)
  --key-dir <DIR>      Key directory (default: ./keys)
  --json               Output structured JSON

ABOUT:
  FLAGSHIP delivers compliance change notifications via the OpenID Shared
  Signals Framework (SSF) and Continuous Access Evaluation Protocol (CAEP).
  Events are Ed25519-signed Security Event Tokens (SETs).
`);
    return;
  }

  if (sub === "generate") {
    let eventPath: string | undefined;
    let issuer: string | undefined;
    let audience: string | undefined;
    let keyDir = "./keys";
    let outputPath: string | undefined;
    let jsonOutput = false;

    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case "--event":
          eventPath = args[++i];
          break;
        case "--issuer":
          issuer = args[++i];
          break;
        case "--audience":
          audience = args[++i];
          break;
        case "--key-dir":
          keyDir = args[++i];
          break;
        case "--output":
          outputPath = args[++i];
          break;
        case "--json":
          jsonOutput = true;
          break;
      }
    }

    if (!eventPath || !issuer || !audience) {
      console.error("Error: --event, --issuer, and --audience are required");
      console.error('Run "corsair signal --help" for usage');
      process.exit(2);
    }

    if (!existsSync(eventPath)) {
      console.error(`Error: Event file not found: ${eventPath}`);
      process.exit(2);
    }

    let event: import("./src/flagship/flagship-types").FlagshipEvent;
    try {
      event = JSON.parse(readFileSync(eventPath, "utf-8"));
    } catch {
      console.error("Error: Event file is not valid JSON");
      process.exit(2);
    }

    const { FLAGSHIP_EVENTS } = await import("./src/flagship/flagship-types");
    const allowed = new Set(Object.values(FLAGSHIP_EVENTS));
    if (!event || !event.type || !allowed.has(event.type)) {
      console.error("Error: Invalid FLAGSHIP event type");
      process.exit(2);
    }

    const { MarqueKeyManager } = await import("./src/parley/marque-key-manager");
    const { generateSET, generateFlagshipDescription } = await import("./src/flagship/set-generator");

    const keyManager = new MarqueKeyManager(keyDir);
    const set = await generateSET(event, issuer, audience, keyManager);
    const description = generateFlagshipDescription(event);

    if (jsonOutput) {
      process.stdout.write(JSON.stringify({
        set,
        issuer,
        audience,
        eventType: event.type,
        description,
      }, null, 2));
      return;
    }

    if (outputPath) {
      writeFileSync(outputPath, set);
      console.error("SET generated successfully.");
      console.error(`  Output: ${outputPath}`);
      return;
    }

    process.stdout.write(set);
    return;
  }

  if (sub === "verify") {
    let filePath: string | undefined;
    let keyDir = "./keys";
    let jsonOutput = false;

    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case "--file":
        case "-f":
          filePath = args[++i];
          break;
        case "--key-dir":
          keyDir = args[++i];
          break;
        case "--json":
          jsonOutput = true;
          break;
      }
    }

    if (!filePath) {
      console.error("Error: --file is required");
      console.error('Run "corsair signal --help" for usage');
      process.exit(2);
    }

    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(2);
    }

    const token = readFileSync(filePath, "utf-8").trim();
    const { MarqueKeyManager } = await import("./src/parley/marque-key-manager");
    const { verifySET } = await import("./src/flagship/set-generator");
    const keyManager = new MarqueKeyManager(keyDir);
    const result = await verifySET(token, keyManager);

    if (jsonOutput) {
      process.stdout.write(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);
    }

    if (result.valid) {
      console.log("SET VERIFIED");
      process.exit(0);
    } else {
      console.error("SET VERIFICATION FAILED");
      process.exit(1);
    }
  }

  console.error(`Unknown signal command: ${sub}`);
  console.error('Run "corsair signal --help" for usage');
  process.exit(1);
}

// =============================================================================
// VERIFY
// =============================================================================

async function handleVerify(): Promise<void> {
  const args = process.argv.slice(3);
  let filePath: string | undefined;
  let pubkeyPath: string | undefined;
  let showHelp = false;
  let jsonOutput = false;
  let useDid = false;
  let requireIssuer: string | undefined;
  let requireFrameworks: string[] = [];
  let maxAgeDays: number | undefined;
  let minScore: number | undefined;
  let receiptsPath: string | undefined;

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
      case "--did":
        useDid = true;
        break;
      case "--json":
        jsonOutput = true;
        break;
      case "--require-issuer":
        requireIssuer = args[++i];
        break;
      case "--require-framework":
        requireFrameworks = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--max-age":
        maxAgeDays = parseInt(args[++i], 10);
        break;
      case "--min-score":
        minScore = parseInt(args[++i], 10);
        break;
      case "--receipts":
        receiptsPath = args[++i];
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
      --did             Verify via DID:web resolution (no local key needed)
      --require-issuer <DID>      Require a specific issuer DID
      --require-framework <LIST>  Comma-separated frameworks that must be present
      --max-age <DAYS>            Maximum allowed age based on provenance.sourceDate
      --min-score <N>             Minimum overallScore required
      --receipts <PATH>           Verify process receipts (JSON array)
      --json            Output structured JSON
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

  const content = readFileSync(filePath, "utf-8").trim();
  const format = content.startsWith("eyJ") ? "JWT-VC" : "JSON Envelope";

  let publicKey: Buffer | undefined;
  if (!useDid || receiptsPath) {
    const keyPath = pubkeyPath || "./keys/corsair-signing.pub";
    if (!existsSync(keyPath)) {
      console.error(`Error: Public key not found: ${keyPath}`);
      console.error("Generate keys with: corsair keygen");
      process.exit(2);
    }
    publicKey = readFileSync(keyPath);
  }

  const { MarqueVerifier } = await import("./src/parley/marque-verifier");
  const verifier = publicKey ? new MarqueVerifier([publicKey]) : new MarqueVerifier([]);

  // Auto-detect format (JWT starts with eyJ, JSON starts with {)
  let result;
  if (content.startsWith("eyJ")) {
    if (useDid) {
      const { verifyVCJWTViaDID } = await import("./src/parley/vc-verifier");
      result = await verifyVCJWTViaDID(content);
    } else {
      result = await verifier.verify(content);
    }
  } else {
    const doc = JSON.parse(content);
    if (useDid) {
      console.error("Error: --did is only supported for JWT-VC verification");
      process.exit(2);
    }
    result = await verifier.verify(doc);
  }

  const policyRequested = Boolean(requireIssuer || requireFrameworks.length > 0 || maxAgeDays !== undefined || minScore !== undefined);
  let policyResult: { ok: boolean; errors: string[] } | undefined;
  let processResult: import("./src/parley/receipt-verifier").ProcessVerificationResult | undefined;

  let payload: Record<string, unknown> | null = null;
  if (format === "JWT-VC") {
    payload = decodeJwtPayload(content);
  }

  if (policyRequested) {
    if (!payload) {
      policyResult = { ok: false, errors: ["Policy checks require JWT-VC input"] };
    } else {
      const { evaluateVerificationPolicy } = await import("./src/parley/verification-policy");
      policyResult = evaluateVerificationPolicy(payload, {
        requireIssuer,
        requireFramework: requireFrameworks,
        maxAgeDays,
        minScore,
      });
    }
  }

  if (receiptsPath) {
    if (!publicKey) {
      console.error("Error: receipts verification requires a public key");
      process.exit(2);
    }
    try {
      const raw = readFileSync(receiptsPath, "utf-8");
      const receipts = JSON.parse(raw) as Array<import("./src/parley/process-receipt").ProcessReceipt>;
      const { verifyProcessChain } = await import("./src/parley/receipt-verifier");
      processResult = verifyProcessChain(receipts, publicKey.toString());
      if (payload) {
        const cs = (payload.vc as any)?.credentialSubject as Record<string, unknown> | undefined;
        const chainDigest = cs?.processProvenance && (cs.processProvenance as any).chainDigest;
        if (chainDigest && processResult.chainDigest !== chainDigest) {
          processResult = { ...processResult, chainValid: false };
        }
      }
    } catch (err) {
      console.error(`Error: failed to verify receipts: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    }
  }

  if (jsonOutput) {
    const response = {
      valid: result.valid,
      issuer: result.signedBy ?? null,
      trustTier: result.issuerTier ?? null,
      scope: result.scope ?? null,
      summary: result.summary ?? null,
      provenance: result.provenance ?? null,
      extensions: result.extensions ?? null,
      timestamps: {
        issuedAt: result.generatedAt ?? null,
        expiresAt: result.expiresAt ?? null,
      },
      reason: result.reason,
      format,
      policy: policyResult ?? null,
      process: processResult ?? null,
    };
    process.stdout.write(JSON.stringify(response, null, 2));
    const ok = result.valid && (!policyResult || policyResult.ok) && (!processResult || processResult.chainValid);
    process.exit(ok ? 0 : 1);
  }

  if (result.valid) {
    console.log("VERIFIED");
    console.log(`  Signed by: ${result.signedBy || "Unknown"}`);
    console.log(`  Format:    ${format}`);
    console.log(`  Scope:     ${result.scope || "Unknown"}`);
    if (result.summary) {
      console.log(`  Summary:   ${result.summary.controlsTested} tested, ${result.summary.controlsPassed} passed, ${result.summary.controlsFailed} failed (${result.summary.overallScore}%)`);
    } else {
      console.log("  Summary:   unavailable");
    }
    if (result.provenance) {
      const identity = result.provenance.sourceIdentity || "unknown";
      const date = result.provenance.sourceDate ? `, ${result.provenance.sourceDate}` : "";
      console.log(`  Provenance: ${result.provenance.source} (${identity}${date})`);
    } else {
      console.log("  Provenance: unknown");
    }
    if (policyResult) {
      if (policyResult.ok) {
        console.log("  Policy:    PASS");
      } else {
        console.log("  Policy:    FAIL");
        for (const err of policyResult.errors) {
          console.log(`    - ${err}`);
        }
      }
    }
    if (processResult) {
      console.log(`  Process:   ${processResult.chainValid ? "VERIFIED" : "FAILED"} (${processResult.receiptsVerified}/${processResult.receiptsTotal})`);
    }
    const ok = (!policyResult || policyResult.ok) && (!processResult || processResult.chainValid);
    process.exit(ok ? 0 : 1);
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
// TRUST-TXT
// =============================================================================

async function handleTrustTxt(): Promise<void> {
  const args = process.argv.slice(3);
  const ctSubcommand = args[0];

  if (!ctSubcommand || ctSubcommand === "--help" || ctSubcommand === "-h") {
    printTrustTxtHelp();
    return;
  }

  switch (ctSubcommand) {
    case "generate":
      await handleTrustTxtGenerate(args.slice(1));
      break;
    case "validate":
      await handleTrustTxtValidate(args.slice(1));
      break;
    case "discover":
      await handleTrustTxtDiscover(args.slice(1));
      break;
    default:
      console.error(`Unknown trust-txt subcommand: ${ctSubcommand}`);
      console.error('Run "corsair trust-txt --help" for usage');
      process.exit(1);
  }
}

function printTrustTxtHelp(): void {
  console.log(`
CORSAIR TRUST-TXT -- Compliance proof discovery at /.well-known/

USAGE:
  corsair trust-txt <subcommand> [options]

SUBCOMMANDS:
  generate    Generate a trust.txt from local config
  validate    Fetch and validate a domain's trust.txt
  discover    Fetch trust.txt, list CPOEs, verify each

ABOUT:
  trust.txt is a discovery layer for compliance proofs, modeled after
  security.txt (RFC 9116). Organizations publish /.well-known/trust.txt
  to advertise their DID identity, CPOE proofs, SCITT log, optional catalog snapshot,
  and signal endpoints.

  Standard           | Discovery for...
  ------------------- | ----------------
  robots.txt          | Web crawlers
  security.txt        | Vulnerability reporters
  openid-configuration| Auth clients
  trust.txt      | Compliance verifiers + agentic audits

  Origin: @toufik-airane (github.com/grcorsair/corsair/issues/2)
  Spec:   https://grcorsair.com/spec/trust-txt

EXAMPLES:
  corsair trust-txt generate --did did:web:acme.com --cpoes ./cpoes/ --output trust.txt
  corsair trust-txt validate acme.com
  corsair trust-txt discover acme.com
  corsair trust-txt discover acme.com --verify

OPTIONS:
  --json            Output structured JSON (validate/discover)
  --verify          Verify CPOEs when discovering/validating
  --scitt-limit <N> Limit SCITT entries returned in discover (default: 5)
  -h, --help        Show this help
`);
}

// ---------------------------------------------------------------------------
// TRUST-TXT GENERATE
// ---------------------------------------------------------------------------

async function handleTrustTxtGenerate(args: string[]): Promise<void> {
  let did: string | undefined;
  let cpoeDir: string | undefined;
  let cpoeUrls: string[] = [];
  let scitt: string | undefined;
  let catalog: string | undefined;
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
      case "--catalog":
        catalog = args[++i];
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
CORSAIR TRUST-TXT GENERATE -- Create a trust.txt

USAGE:
  corsair trust-txt generate --did <DID> [options]

OPTIONS:
  --did <DID>              DID:web identity (required)
  --cpoes <DIR>            Directory to scan for .jwt CPOE files
  --cpoe-url <URL>         Add a CPOE URL (repeatable)
  --base-url <URL>         Base URL to prefix scanned CPOE filenames
  --scitt <URL>            SCITT transparency log endpoint
  --catalog <URL>          Catalog snapshot with per-CPOE metadata
  --flagship <URL>         FLAGSHIP signal stream endpoint
  --frameworks <LIST>      Comma-separated framework names
  --contact <EMAIL>        Compliance contact email
  --expiry-days <N>        Validity in days (default: 365)
  -o, --output <PATH>      Write to file (default: stdout)
  -h, --help               Show this help

EXAMPLES:
  corsair trust-txt generate --did did:web:acme.com --cpoe-url https://acme.com/soc2.jwt
  corsair trust-txt generate --did did:web:acme.com --cpoes ./cpoes/ --output trust.txt
`);
        return;
    }
  }

  if (!did) {
    console.error("Error: --did is required");
    console.error('Run "corsair trust-txt generate --help" for usage');
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

  const catalogWarningThreshold = 10;
  if (!catalog && cpoeUrls.length > catalogWarningThreshold) {
    console.error(`Warning: ${cpoeUrls.length} CPOEs listed. Consider hosting a catalog snapshot and referencing it via CATALOG: <url>.`);
  }

  // Calculate expiry
  const expiresDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const { generateTrustTxt } = await import("./src/parley/trust-txt");

  const output = generateTrustTxt({
    did,
    cpoes: cpoeUrls,
    scitt,
    catalog,
    flagship,
    frameworks,
    contact,
    expires: expiresDate.toISOString(),
  });

  if (outputPath) {
    const { writeFileSync } = await import("fs");
    writeFileSync(outputPath, output);
    console.error("trust.txt generated successfully.");
    console.error(`  Output: ${outputPath}`);
    console.error(`  Host at: https://${did.replace("did:web:", "")}/.well-known/trust.txt`);
  } else {
    process.stdout.write(output);
  }
}

// ---------------------------------------------------------------------------
// TRUST-TXT VALIDATE
// ---------------------------------------------------------------------------

async function handleTrustTxtValidate(args: string[]): Promise<void> {
  const domain = args.find(a => !a.startsWith("--"));
  const jsonOutput = args.includes("--json");
  const verify = args.includes("--verify");
  const catalogAll = args.includes("--catalog-all");
  const sampleIndex = args.findIndex(a => a === "--catalog-sample");
  const catalogSample = sampleIndex >= 0 ? parseInt(args[sampleIndex + 1], 10) || 0 : undefined;

  if (!domain) {
    console.error("Error: domain is required");
    console.error('Usage: corsair trust-txt validate <domain>');
    process.exit(2);
  }

  const { resolveTrustTxt, validateTrustTxt } = await import("./src/parley/trust-txt");
  const { resolveComplianceCatalog, validateComplianceCatalog } = await import("./src/parley/compliance-catalog");
  const { verifyVCJWTViaDID } = await import("./src/parley/vc-verifier");
  const { createHash } = await import("crypto");

  console.error(`Fetching https://${domain}/.well-known/trust.txt ...`);

  const resolution = await resolveTrustTxt(domain);

  if (!resolution.trustTxt) {
    console.error(`Error: ${resolution.error}`);
    process.exit(1);
  }

  const validation = validateTrustTxt(resolution.trustTxt);
  const ct = resolution.trustTxt;

  let verificationResults: Array<{ url: string; valid: boolean; reason?: string; issuer?: string; trustTier?: string }> = [];
  if (verify && ct.cpoes.length > 0) {
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

  let catalogSummary:
    | {
        url: string;
        validation?: { valid: boolean; errors: string[] };
        entryCount?: number;
        verification?: Array<{ url: string; valid: boolean; reason?: string; issuer?: string; trustTier?: string; hashMatch?: boolean }>;
        error?: string;
      }
    | undefined;

  if (ct.catalog) {
    const catalogResolution = await resolveComplianceCatalog(ct.catalog);
    if (!catalogResolution.catalog) {
      catalogSummary = {
        url: ct.catalog,
        error: catalogResolution.error || "Catalog resolution failed",
      };
    } else {
      const catalogValidation = validateComplianceCatalog(catalogResolution.catalog);
      const entries = catalogResolution.catalog.cpoes || [];

      let catalogVerification:
        Array<{ url: string; valid: boolean; reason?: string; issuer?: string; trustTier?: string; hashMatch?: boolean }>
        = [];

      if (verify && entries.length > 0) {
        let sampleSize = catalogSample;
        if (sampleSize === undefined) {
          sampleSize = catalogAll ? entries.length : Math.min(5, entries.length);
        }
        if (catalogAll) {
          sampleSize = entries.length;
        }

        if (sampleSize > 0) {
          const sampleEntries = entries.slice(0, sampleSize);
          for (const entry of sampleEntries) {
            const url = entry.url;
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
              if (!res.ok) {
                catalogVerification.push({ url, valid: false, reason: `HTTP ${res.status}` });
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
                catalogVerification.push({ url, valid: false, reason: "No JWT found" });
                continue;
              }
              const result = await verifyVCJWTViaDID(jwt);
              let hashMatch: boolean | undefined;
              if (entry.hash && entry.hash.startsWith("sha256:")) {
                const computed = createHash("sha256").update(jwt).digest("hex");
                hashMatch = entry.hash.toLowerCase() === `sha256:${computed}`;
              }
              catalogVerification.push({
                url,
                valid: result.valid,
                reason: result.valid ? undefined : result.reason,
                issuer: result.signedBy,
                trustTier: result.issuerTier,
                ...(hashMatch === undefined ? {} : { hashMatch }),
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              catalogVerification.push({ url, valid: false, reason: message });
            }
          }
        }
      }

      catalogSummary = {
        url: ct.catalog,
        validation: catalogValidation,
        entryCount: entries.length,
        ...(catalogVerification.length > 0 ? { verification: catalogVerification } : {}),
      };
    }
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify({
      domain,
      trustTxt: ct,
      validation,
      catalog: catalogSummary,
      verification: verify ? verificationResults : undefined,
    }, null, 2));
    return;
  }

  console.log(`TRUST.TXT VALIDATION: ${domain}`);
  console.log("=".repeat(50));
  console.log("");
  console.log(`  DID:        ${resolution.trustTxt.did || "(missing)"}`);
  console.log(`  CPOEs:      ${resolution.trustTxt.cpoes.length}`);
  console.log(`  Frameworks: ${resolution.trustTxt.frameworks.join(", ") || "(none)"}`);
  console.log(`  Contact:    ${resolution.trustTxt.contact || "(none)"}`);
  console.log(`  Expires:    ${resolution.trustTxt.expires || "(none)"}`);
  console.log(`  SCITT:      ${resolution.trustTxt.scitt || "(none)"}`);
  console.log(`  CATALOG:    ${resolution.trustTxt.catalog || "(none)"}`);
  console.log(`  FLAGSHIP:   ${resolution.trustTxt.flagship || "(none)"}`);
  console.log("");

  if (catalogSummary) {
    console.log("  CATALOG SNAPSHOT:");
    console.log(`    URL:     ${catalogSummary.url}`);
    if (catalogSummary.error) {
      console.log(`    ERROR:   ${catalogSummary.error}`);
    } else {
      console.log(`    ENTRIES: ${catalogSummary.entryCount ?? 0}`);
      if (catalogSummary.validation && !catalogSummary.validation.valid) {
        console.log("    VALIDATION ERRORS:");
        for (const error of catalogSummary.validation.errors) {
          console.log(`      - ${error}`);
        }
      } else if (catalogSummary.validation) {
        console.log("    VALIDATION: OK");
      }
      if (catalogSummary.verification && catalogSummary.verification.length > 0) {
        console.log("    VERIFICATION:");
        for (const v of catalogSummary.verification) {
          const hashNote = v.hashMatch === undefined ? "" : v.hashMatch ? " (hash ok)" : " (hash mismatch)";
          if (v.valid) {
            console.log(`      ✓ ${v.url} (${v.trustTier || "unknown"})${hashNote}`);
          } else {
            console.log(`      ✗ ${v.url} — ${v.reason || "invalid"}${hashNote}`);
          }
        }
      }
    }
    console.log("");
  }

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
// TRUST-TXT DISCOVER
// ---------------------------------------------------------------------------

async function handleTrustTxtDiscover(args: string[]): Promise<void> {
  const domain = args.find(a => !a.startsWith("--"));
  const jsonOutput = args.includes("--json");
  const verify = args.includes("--verify");
  const scittLimitIndex = args.findIndex(a => a === "--scitt-limit");
  const scittLimit = scittLimitIndex >= 0 ? parseInt(args[scittLimitIndex + 1], 10) || 5 : 5;

  if (!domain) {
    console.error("Error: domain is required");
    console.error('Usage: corsair trust-txt discover <domain>');
    process.exit(2);
  }

  const { resolveTrustTxt, validateTrustTxt } = await import("./src/parley/trust-txt");

  console.error(`Discovering compliance proofs for ${domain}...`);
  console.error(`Fetching https://${domain}/.well-known/trust.txt ...`);

  const resolution = await resolveTrustTxt(domain);

  if (!resolution.trustTxt) {
    console.error(`Error: ${resolution.error}`);
    process.exit(1);
  }

  const ct = resolution.trustTxt;
  const validation = validateTrustTxt(ct);
  let verificationResults: Array<{ url: string; valid: boolean; reason?: string; issuer?: string; trustTier?: string }> = [];
  let scittSummary:
    | { url: string; entries: Array<import("./src/parley/scitt-types").SCITTListEntry>; error?: string }
    | undefined;
  let catalogSummary:
    | { url: string; entryCount?: number; error?: string }
    | undefined;

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

  if (ct.scitt) {
    const { resolveScittEntries } = await import("./src/parley/scitt-client");
    const scittUrl = appendScittQuery(ct.scitt, { limit: String(scittLimit) });
    const result = await resolveScittEntries(scittUrl);
    scittSummary = {
      url: scittUrl,
      entries: result.entries,
      ...(result.error ? { error: result.error } : {}),
    };
  }

  if (ct.catalog) {
    const { resolveComplianceCatalog } = await import("./src/parley/compliance-catalog");
    const catalogResolution = await resolveComplianceCatalog(ct.catalog);
    if (!catalogResolution.catalog) {
      catalogSummary = { url: ct.catalog, error: catalogResolution.error || "Catalog resolution failed" };
    } else {
      catalogSummary = {
        url: ct.catalog,
        entryCount: catalogResolution.catalog.cpoes.length,
      };
    }
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify({
      domain,
      trustTxt: ct,
      validation,
      cpoeCount: ct.cpoes.length,
      scitt: scittSummary,
      catalog: catalogSummary,
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

  if (ct.catalog) {
    console.log(`  CATALOG:    ${ct.catalog}`);
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

  if (scittSummary) {
    if (scittSummary.error) {
      console.log("  SCITT ENTRIES: ERROR");
      console.log(`    ${scittSummary.error}`);
    } else {
      console.log(`  SCITT ENTRIES (${scittSummary.entries.length}):`);
      for (const entry of scittSummary.entries) {
        const score = entry.summary?.overallScore ?? "?";
        console.log(`    ${entry.entryId}  ${entry.scope}  ${score}%`);
      }
    }
    console.log("");
  }

  if (catalogSummary) {
    if (catalogSummary.error) {
      console.log("  CATALOG SNAPSHOT: ERROR");
      console.log(`    ${catalogSummary.error}`);
    } else {
      console.log(`  CATALOG SNAPSHOT: ${catalogSummary.entryCount ?? 0} entries`);
    }
    console.log("");
  }

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
  log             List signed CPOEs (local/SCITT log)      like git log
  trust-txt  Discovery layer (generate/validate/discover)
  mappings        List loaded evidence mappings
  renew           Re-sign a CPOE with fresh dates          like git commit --amend
  signal          FLAGSHIP SET generation/verification     like git webhooks
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
