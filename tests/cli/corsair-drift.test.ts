/**
 * Corsair Drift CLI Tests — TDD
 *
 * Tests for the `corsair drift` subcommand.
 * Compares two CPOEs and detects compliance regressions.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const cwd = join(import.meta.dir, "../..");
const tmpDir = join(cwd, "tests", "cli", ".tmp-drift-test");

// =============================================================================
// SETUP — Generate two CPOEs with different evidence
// =============================================================================

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  // Generate keypair
  const keygen = Bun.spawn(["bun", "run", "corsair.ts", "keygen", "--output", join(tmpDir, "keys")], { cwd });
  await keygen.exited;

  // Evidence v1: 2 controls passing, 1 failing (with framework refs so they appear in CPOE)
  const evidenceV1 = {
    metadata: { title: "Scan v1", issuer: "Scanner", date: "2026-02-01", scope: "AWS Prod" },
    controls: [
      { id: "MFA-001", description: "MFA enabled", status: "pass", evidence: "Okta config verified", framework: "SOC2", controlId: "CC6.1" },
      { id: "ENC-001", description: "Encryption at rest", status: "pass", evidence: "S3 AES-256 active", framework: "SOC2", controlId: "CC6.7" },
      { id: "LOG-001", description: "Audit logging", status: "fail", severity: "HIGH", evidence: "CloudTrail disabled", framework: "SOC2", controlId: "CC7.2" },
    ],
  };
  writeFileSync(join(tmpDir, "evidence-v1.json"), JSON.stringify(evidenceV1));

  // Evidence v2: LOG-001 now fixed (improvement), but new failure NET-001 (regression)
  const evidenceV2 = {
    metadata: { title: "Scan v2", issuer: "Scanner", date: "2026-02-12", scope: "AWS Prod" },
    controls: [
      { id: "MFA-001", description: "MFA enabled", status: "pass", evidence: "Okta config verified", framework: "SOC2", controlId: "CC6.1" },
      { id: "ENC-001", description: "Encryption at rest", status: "pass", evidence: "S3 AES-256 active", framework: "SOC2", controlId: "CC6.7" },
      { id: "LOG-001", description: "Audit logging", status: "pass", evidence: "CloudTrail enabled all regions", framework: "SOC2", controlId: "CC7.2" },
      { id: "NET-001", description: "Network segmentation", status: "fail", severity: "CRITICAL", evidence: "Default VPC in use", framework: "SOC2", controlId: "CC6.6" },
    ],
  };
  writeFileSync(join(tmpDir, "evidence-v2.json"), JSON.stringify(evidenceV2));

  // Evidence v3: identical to v1 (no change)
  writeFileSync(join(tmpDir, "evidence-v3.json"), JSON.stringify(evidenceV1));

  // Sign all three
  const keyDir = join(tmpDir, "keys");
  for (const [name, file] of [["v1", "evidence-v1.json"], ["v2", "evidence-v2.json"], ["v3", "evidence-v3.json"]]) {
    const sign = Bun.spawn([
      "bun", "run", "corsair.ts", "sign",
      "--file", join(tmpDir, file),
      "--key-dir", keyDir,
      "--output", join(tmpDir, `cpoe-${name}.jwt`),
    ], { cwd });
    await sign.exited;
  }
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// HELP
// =============================================================================

describe("corsair drift — help (backwards-compatible alias)", () => {
  test("drift --help shows diff usage (drift is alias)", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "drift", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("DIFF");
    expect(output).toContain("--current");
    expect(output).toContain("--previous");
  });

  test("main help includes drift as alias", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("drift");
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

describe("corsair drift — error handling", () => {
  test("drift without --current shows error", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "drift"], { cwd, stderr: "pipe" });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--current");
  });

  test("drift without --previous shows error", async () => {
    const proc = Bun.spawn([
      "bun", "run", "corsair.ts", "drift",
      "--current", join(tmpDir, "cpoe-v1.jwt"),
    ], { cwd, stderr: "pipe" });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--previous");
  });
});

// =============================================================================
// DRIFT DETECTION
// =============================================================================

describe("corsair drift — regression detection (via drift alias)", () => {
  test("detects regression when new failures appear", async () => {
    const proc = Bun.spawn([
      "bun", "run", "corsair.ts", "drift",
      "--current", join(tmpDir, "cpoe-v2.jwt"),
      "--previous", join(tmpDir, "cpoe-v1.jwt"),
    ], { cwd, stdout: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    // Should detect CC6.6 (NET-001) as a new failure (regression)
    expect(stdout).toContain("CC6.6");
    // Should note CC7.2 (LOG-001) improvement
    expect(stdout).toContain("CC7.2");
    // Exit code 1 = drift detected (regression)
    expect(code).toBe(1);
  });

  test("exits 0 when no regression (same evidence)", async () => {
    const proc = Bun.spawn([
      "bun", "run", "corsair.ts", "drift",
      "--current", join(tmpDir, "cpoe-v3.jwt"),
      "--previous", join(tmpDir, "cpoe-v1.jwt"),
    ], { cwd, stdout: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    // No regression — same controls, same statuses
    expect(code).toBe(0);
    expect(stdout).toContain("No regression");
  });
});

// =============================================================================
// DIFF COMMAND (primary name)
// =============================================================================

describe("corsair diff — primary command", () => {
  test("diff --help shows diff usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "diff", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("DIFF");
    expect(output).toContain("--current");
    expect(output).toContain("--previous");
  });

  test("diff detects regression (same as drift)", async () => {
    const proc = Bun.spawn([
      "bun", "run", "corsair.ts", "diff",
      "--current", join(tmpDir, "cpoe-v2.jwt"),
      "--previous", join(tmpDir, "cpoe-v1.jwt"),
    ], { cwd, stdout: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    expect(stdout).toContain("CC6.6");
    expect(code).toBe(1);
  });

  test("diff --json outputs structured report", async () => {
    const proc = Bun.spawn([
      "bun", "run", "corsair.ts", "diff",
      "--current", join(tmpDir, "cpoe-v2.jwt"),
      "--previous", join(tmpDir, "cpoe-v1.jwt"),
      "--json",
    ], { cwd, stdout: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    const report = JSON.parse(stdout);
    expect(report.result).toBe("regression");
    expect(report.regressions).toContain("CC6.6");
    expect(code).toBe(1);
  });

  test("diff exits 0 when no regression", async () => {
    const proc = Bun.spawn([
      "bun", "run", "corsair.ts", "diff",
      "--current", join(tmpDir, "cpoe-v3.jwt"),
      "--previous", join(tmpDir, "cpoe-v1.jwt"),
    ], { cwd, stdout: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(stdout).toContain("No regression");
  });
});

// =============================================================================
// LOG COMMAND (stub)
// =============================================================================

describe("corsair log — stub command", () => {
  test("log --help shows planned usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "log", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("LOG");
    expect(output).toContain("SCITT");
  });
});
