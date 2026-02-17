/**
 * Corsair Sign CLI Tests — TDD
 *
 * Tests for the `corsair sign` subcommand.
 * Covers: help, error handling, e2e signing pipeline.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const cwd = "/Users/ayoubfandi/projects/corsair";
const tmpDir = join(cwd, "tests", "cli", ".tmp-sign-test");

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeAll(async () => {
  // Create temp dir for test artifacts
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  // Generate a test keypair
  const proc = Bun.spawn(["bun", "run", "corsair.ts", "keygen", "--output", join(tmpDir, "keys")], { cwd });
  await proc.exited;

  // Write a sample generic JSON evidence file
  const sampleEvidence = {
    metadata: {
      title: "Q1 2026 Security Assessment",
      issuer: "Acme Corp",
      date: "2026-01-15",
      scope: "AWS Production Environment",
    },
    controls: [
      {
        id: "MFA-001",
        description: "Multi-factor authentication enabled for all users",
        status: "pass",
        evidence: "Okta MFA policy enforced for all user groups. Configuration export shows TOTP required.",
        framework: "NIST-800-53",
        controlId: "IA-2",
      },
      {
        id: "ENC-001",
        description: "Data at rest encrypted with AES-256",
        status: "pass",
        evidence: "S3 default encryption verified via AWS Config rule s3-default-encryption-kms.",
      },
      {
        id: "LOG-001",
        description: "Audit logging enabled for all services",
        status: "fail",
        severity: "HIGH",
        evidence: "CloudTrail disabled in us-west-2 region",
      },
    ],
  };
  writeFileSync(join(tmpDir, "evidence.json"), JSON.stringify(sampleEvidence, null, 2));

  // Write a sample InSpec JSON report
  const inspecReport = {
    platform: { name: "aws", release: "aws-sdk-v3" },
    profiles: [
      {
        name: "aws-cis-level1",
        title: "CIS AWS Foundations Benchmark Level 1",
        controls: [
          {
            id: "cis-aws-1.1",
            title: "Avoid the use of the root account",
            desc: "The root account has unrestricted access to all resources.",
            impact: 1.0,
            tags: { nist: ["IA-2"], cis_controls: [{ id: "1.1" }] },
            results: [{ status: "passed", code_desc: "Root account has no access keys", run_time: 0.5 }],
          },
          {
            id: "cis-aws-1.4",
            title: "Ensure MFA is enabled for the root account",
            desc: "Enable MFA on the root account.",
            impact: 1.0,
            tags: { nist: ["IA-2(1)"] },
            results: [{ status: "passed", code_desc: "Root MFA is active", run_time: 0.3 }],
          },
          {
            id: "cis-aws-2.1",
            title: "Ensure CloudTrail is enabled in all regions",
            desc: "CloudTrail should be enabled in all regions.",
            impact: 0.7,
            tags: { nist: ["AU-2"] },
            results: [{ status: "failed", code_desc: "CloudTrail not enabled in eu-west-1", run_time: 0.4 }],
          },
        ],
      },
    ],
    statistics: { duration: 12.5 },
    version: "5.22.36",
  };
  writeFileSync(join(tmpDir, "inspec-report.json"), JSON.stringify(inspecReport, null, 2));

  // Write a sample Trivy JSON report
  const trivyReport = {
    SchemaVersion: 2,
    ArtifactName: "myapp:latest",
    Results: [
      {
        Target: "Dockerfile",
        Class: "config",
        Misconfigurations: [
          {
            Type: "dockerfile",
            ID: "DS001",
            AVDID: "AVD-DS-0001",
            Title: "Running as root user",
            Description: "Running containers as root increases attack surface.",
            Severity: "HIGH",
            Status: "FAIL",
            Resolution: "Use USER instruction to set non-root user",
          },
          {
            Type: "dockerfile",
            ID: "DS002",
            AVDID: "AVD-DS-0002",
            Title: "Image uses latest tag",
            Description: "Using latest tag can lead to unpredictable builds.",
            Severity: "MEDIUM",
            Status: "FAIL",
            Resolution: "Pin image to specific version",
          },
          {
            Type: "dockerfile",
            ID: "DS005",
            AVDID: "AVD-DS-0005",
            Title: "COPY uses ADD instead",
            Description: "ADD has extra functionality that can be exploited.",
            Severity: "LOW",
            Status: "PASS",
            Resolution: "Use COPY instead of ADD",
          },
        ],
      },
    ],
  };
  writeFileSync(join(tmpDir, "trivy-report.json"), JSON.stringify(trivyReport, null, 2));
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// HELP
// =============================================================================

describe("corsair sign — help", () => {
  test("sign --help shows sign usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "sign", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("SIGN");
    expect(output).toContain("--file");
    expect(output).toContain("--did");
    expect(output).toContain("--output");
    expect(output).toContain("--baseline");
    expect(output).toContain("--gate");
    expect(output).toContain("FORMATS");
    expect(output).toContain("inspec");
    expect(output).toContain("trivy");
    expect(output).toContain("prowler");
  });

  test("main help includes sign command", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("sign");
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

describe("corsair sign — error handling", () => {
  test("sign without --file shows error and exits 2", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "sign"], {
      cwd,
      stderr: "pipe",
      stdin: "ignore",
    });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("No evidence provided");
  });

  test("sign with nonexistent file shows error", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "sign", "--file", "/tmp/nonexistent.json"], {
      cwd,
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("not found");
  });

  test("sign without keypair auto-generates keys", async () => {
    const noKeyDir = join(tmpDir, "auto-keys");
    mkdirSync(noKeyDir, { recursive: true });
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "sign", "--file", join(tmpDir, "evidence.json"), "--key-dir", noKeyDir],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(stderr).toContain("Generating Ed25519 keypair");
    // Should produce a valid JWT
    expect(stdout.trim()).toMatch(/^eyJ/);
    // Keys should now exist on disk
    expect(existsSync(join(noKeyDir, "corsair-signing.key"))).toBe(true);
    expect(existsSync(join(noKeyDir, "corsair-signing.pub"))).toBe(true);
  });
});

// =============================================================================
// E2E SIGNING — GENERIC JSON
// =============================================================================

describe("corsair sign — generic JSON e2e", () => {
  test("signs generic JSON evidence file to stdout", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    // JWT-VC starts with eyJ (base64url encoded JSON header)
    expect(stdout.trim()).toMatch(/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  test("signs and writes to --output file", async () => {
    const outputPath = join(tmpDir, "output.jwt");
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--output", outputPath,
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(existsSync(outputPath)).toBe(true);

    const jwt = readFileSync(outputPath, "utf-8").trim();
    expect(jwt).toMatch(/^eyJ/);
  });

  test("signed CPOE is verifiable with corsair verify", async () => {
    const outputPath = join(tmpDir, "verifiable.jwt");

    // Sign
    const signProc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--output", outputPath,
      ],
      { cwd },
    );
    await signProc.exited;

    // Verify
    const verifyProc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "verify",
        "--file", outputPath,
        "--pubkey", join(tmpDir, "keys", "corsair-signing.pub"),
      ],
      { cwd, stdout: "pipe" },
    );
    const verifyOutput = await new Response(verifyProc.stdout).text();
    const code = await verifyProc.exited;

    expect(code).toBe(0);
    expect(verifyOutput).toContain("VERIFIED");
    expect(verifyOutput).toContain("Summary:");
    expect(verifyOutput).toContain("Provenance:");
    expect(verifyOutput).toContain("Scope:");
  });

  test("verify --json outputs structured result", async () => {
    const outputPath = join(tmpDir, "verifiable-json.jwt");

    // Sign
    const signProc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--output", outputPath,
      ],
      { cwd },
    );
    await signProc.exited;

    // Verify (JSON)
    const verifyProc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "verify",
        "--file", outputPath,
        "--pubkey", join(tmpDir, "keys", "corsair-signing.pub"),
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const verifyOutput = await new Response(verifyProc.stdout).text();
    const code = await verifyProc.exited;

    expect(code).toBe(0);
    const parsed = JSON.parse(verifyOutput);
    expect(parsed.valid).toBe(true);
    expect(parsed.summary).toBeDefined();
    expect(parsed.provenance).toBeDefined();
    expect(parsed.timestamps).toBeDefined();
  });

  test("accepts --did flag for custom issuer DID", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--did", "did:web:acme.com",
      ],
      { cwd, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    // Decode JWT payload and check issuer
    const parts = stdout.trim().split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.iss).toBe("did:web:acme.com");
  });

  test("accepts --scope flag to override scope", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--scope", "Custom Scope Override",
      ],
      { cwd, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    const parts = stdout.trim().split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.vc.credentialSubject.scope).toBe("Custom Scope Override");
  });
});

// =============================================================================
// NEW CLI FLAGS
// =============================================================================

describe("corsair sign — new flags", () => {
  test("--version prints version", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "sign", "--version"], { cwd, stdout: "pipe" });
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output.trim()).toMatch(/^corsair \d+\.\d+\.\d+$/);
  });

  test("--dry-run outputs JSON without signing", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--dry-run",
      ],
      { cwd, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(stdout);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.detectedFormat).toBe("generic");
    expect(parsed.summary.controlsTested).toBe(3);
    expect(parsed.controlCount).toBe(3);
  });

  test("--json outputs structured JSON with jwt + metadata", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(stdout);
    expect(parsed.cpoe).toMatch(/^eyJ/);
    expect(parsed.marqueId).toMatch(/^marque-/);
    expect(parsed.detectedFormat).toBe("generic");
    expect(parsed.summary).toBeDefined();
    expect(parsed.provenance).toBeDefined();
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  test("--baseline with --gate exits 1 on regression", async () => {
    const baselineEvidence = {
      metadata: {
        title: "Baseline Assessment",
        issuer: "Acme Corp",
        date: "2026-01-01",
        scope: "AWS Production Environment",
      },
      controls: [
        { id: "BASE-1", description: "All good", status: "pass" },
        { id: "BASE-2", description: "All good", status: "pass" },
      ],
    };

    const baselineJsonPath = join(tmpDir, "baseline-evidence.json");
    const baselineJwtPath = join(tmpDir, "baseline.jwt");
    writeFileSync(baselineJsonPath, JSON.stringify(baselineEvidence, null, 2));

    const baselineSign = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", baselineJsonPath,
        "--key-dir", join(tmpDir, "keys"),
        "--output", baselineJwtPath,
      ],
      { cwd },
    );
    await baselineSign.exited;

    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--baseline", baselineJwtPath,
        "--gate",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    const code = await proc.exited;
    expect(code).toBe(1);
  });

  test("--format forces parser format", async () => {
    // Write a prowler-style file
    const prowlerData = [
      {
        StatusCode: "PASS",
        Severity: "HIGH",
        FindingInfo: { Uid: "test-001", Title: "Test finding" },
      },
    ];
    writeFileSync(join(tmpDir, "prowler-test.json"), JSON.stringify(prowlerData));

    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "prowler-test.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--format", "prowler",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(stdout);
    expect(parsed.detectedFormat).toBe("prowler");
  });

  test("--verbose prints progress to stderr", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--verbose",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(stderr).toContain("Parsing evidence...");
    expect(stderr).toContain("Format:");
    expect(stderr).toContain("Controls:");
  });

  test("--quiet suppresses stderr output", async () => {
    const outputPath = join(tmpDir, "quiet-output.jwt");
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
        "--output", outputPath,
        "--quiet",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(stderr.trim()).toBe("");
  });

  test("--file - reads from stdin", async () => {
    const evidence = readFileSync(join(tmpDir, "evidence.json"), "utf-8");
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", "-",
        "--key-dir", join(tmpDir, "keys"),
      ],
      {
        cwd,
        stdout: "pipe",
        stdin: new Blob([evidence]),
      },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^eyJ/);
  });
});

// =============================================================================
// INVISIBLE UX — NEW BEHAVIORS
// =============================================================================

describe("corsair sign — invisible UX", () => {
  test("always shows compact summary to stderr (without --verbose)", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "evidence.json"),
        "--key-dir", join(tmpDir, "keys"),
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(stderr).toContain("Format:");
    expect(stderr).toContain("Controls:");
    expect(stderr).toContain("Provenance:");
  });

  test("shows actionable error for nonexistent file", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "sign", "--file", "/tmp/nope.json"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("not found");
    expect(stderr).toContain("corsair sign --file");
  });

  test("corsair init creates keys and example file", async () => {
    const initDir = join(tmpDir, "init-test");
    mkdirSync(initDir, { recursive: true });

    const proc = Bun.spawn(
      ["bun", "run", join(cwd, "corsair.ts"), "init", "--key-dir", join(initDir, "keys")],
      { cwd: initDir, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(stdout).toContain("Initializing Corsair");
    expect(stdout).toContain("generated");
    expect(existsSync(join(initDir, "keys", "corsair-signing.key"))).toBe(true);
    expect(existsSync(join(initDir, "keys", "corsair-signing.pub"))).toBe(true);
  });
});

// =============================================================================
// E2E SIGNING — INSPEC FORMAT
// =============================================================================

describe("corsair sign — InSpec format e2e", () => {
  test("auto-detects and signs InSpec JSON report", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "inspec-report.json"),
        "--key-dir", join(tmpDir, "keys"),
      ],
      { cwd, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^eyJ/);

    // Decode and check it has the right number of controls
    const parts = stdout.trim().split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.vc.credentialSubject.type).toBe("CorsairCPOE");
  });
});

// =============================================================================
// E2E SIGNING — TRIVY FORMAT
// =============================================================================

describe("corsair sign — Trivy format e2e", () => {
  test("auto-detects and signs Trivy JSON report", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "sign",
        "--file", join(tmpDir, "trivy-report.json"),
        "--key-dir", join(tmpDir, "keys"),
      ],
      { cwd, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^eyJ/);

    // Decode and check
    const parts = stdout.trim().split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.vc.credentialSubject.type).toBe("CorsairCPOE");
  });
});
