/**
 * SD-JWT CLI Tests
 *
 * End-to-end CLI tests for the --sd-jwt flag.
 * Uses Bun.spawn to invoke the actual corsair.ts CLI binary.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

// =============================================================================
// SETUP
// =============================================================================

const projectRoot = join(import.meta.dir, "../..");
const corsairCli = join(projectRoot, "corsair.ts");
const tmpDir = join(import.meta.dir, ".tmp-sd-jwt-cli");
const keyDir = join(tmpDir, "keys");

/** Inline evidence for tests (generic format) */
const testEvidence = {
  metadata: {
    title: "CLI SD-JWT Test",
    issuer: "Test Org",
    date: "2026-01-01",
    scope: "CLI Test Scope",
  },
  controls: [
    {
      id: "C-1",
      description: "Test control alpha",
      status: "pass",
      evidence: "Verified via automated check",
    },
    {
      id: "C-2",
      description: "Test control beta",
      status: "pass",
      evidence: "Manual verification complete",
    },
    {
      id: "C-3",
      description: "Test control gamma",
      status: "fail",
      evidence: "Missing configuration",
    },
  ],
};

const evidenceFilePath = join(tmpDir, "test-evidence.json");

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(keyDir, { recursive: true });

  // Write test evidence file
  writeFileSync(evidenceFilePath, JSON.stringify(testEvidence, null, 2));

  // Generate keys using the CLI keygen command
  const keygen = Bun.spawn(["bun", "run", corsairCli, "keygen", "--output", keyDir], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  await keygen.exited;
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Run the corsair CLI with given arguments and return parsed output.
 */
async function runCorsair(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", corsairCli, ...args], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

// =============================================================================
// TESTS
// =============================================================================

describe("SD-JWT CLI", () => {
  test("corsair sign --sd-jwt --file produces SD-JWT", async () => {
    const { stdout, exitCode } = await runCorsair([
      "sign",
      "--file",
      evidenceFilePath,
      "--sd-jwt",
      "--json",
      "--key-dir",
      keyDir,
      "--quiet",
    ]);

    expect(exitCode).toBe(0);

    // Parse JSON output
    const output = JSON.parse(stdout);

    // The cpoe field should contain ~ (SD-JWT format)
    expect(output.cpoe).toBeDefined();
    expect(typeof output.cpoe).toBe("string");
    expect(output.cpoe).toContain("~");

    // Should have a disclosures array
    expect(output.disclosures).toBeDefined();
    expect(Array.isArray(output.disclosures)).toBe(true);
    expect(output.disclosures.length).toBeGreaterThan(0);

    // Each disclosure should have claim, disclosure, and digest
    for (const d of output.disclosures) {
      expect(d.claim).toBeTruthy();
      expect(d.disclosure).toBeTruthy();
      expect(d.digest).toBeTruthy();
    }

    // Standard fields should still be present
    expect(output.marqueId).toMatch(/^marque-/);
    expect(output.summary).toBeDefined();
    expect(output.summary.controlsTested).toBe(3);
    expect(output.provenance).toBeDefined();
  }, 30_000);

  test("corsair sign without --sd-jwt produces plain JWT", async () => {
    const { stdout, exitCode } = await runCorsair([
      "sign",
      "--file",
      evidenceFilePath,
      "--json",
      "--key-dir",
      keyDir,
      "--quiet",
    ]);

    expect(exitCode).toBe(0);

    // Parse JSON output
    const output = JSON.parse(stdout);

    // The cpoe field should NOT contain ~ (plain JWT)
    expect(output.cpoe).toBeDefined();
    expect(typeof output.cpoe).toBe("string");
    expect(output.cpoe).not.toContain("~");

    // Plain JWT has exactly 2 dots (header.payload.signature)
    const dotCount = (output.cpoe.match(/\./g) || []).length;
    expect(dotCount).toBe(2);

    // Should NOT have a disclosures field
    expect(output.disclosures).toBeUndefined();

    // Standard fields should still be present
    expect(output.marqueId).toMatch(/^marque-/);
    expect(output.summary).toBeDefined();
    expect(output.summary.controlsTested).toBe(3);
  }, 30_000);
});
