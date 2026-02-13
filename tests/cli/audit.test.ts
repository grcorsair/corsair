import { describe, test, expect } from "bun:test";
import { existsSync } from "fs";

/**
 * Audit CLI Integration Tests
 *
 * Tests the `corsair audit` command wiring in corsair.ts.
 * Validates flag parsing, error handling, and output modes.
 */

const cwd = "/Users/ayoubfandi/projects/corsair";
const evidencePath = `${cwd}/examples/generic-evidence.json`;

describe("Corsair Audit CLI", () => {
  // =========================================================================
  // HELP & DISCOVERY
  // =========================================================================

  test("help command includes audit", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("audit");
  });

  test("audit --help shows audit usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "audit", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("AUDIT");
    expect(output).toContain("--files");
    expect(output).toContain("--scope");
  });

  test("audit -h shows audit usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "audit", "-h"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("AUDIT");
  });

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  test("audit without --files shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "audit", "--scope", "Test"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--files");
  });

  test("audit without --scope shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "audit", "--files", evidencePath],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--scope");
  });

  test("audit with nonexistent file shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "audit", "--files", "/nonexistent/file.json", "--scope", "Test"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("not found");
  });

  // =========================================================================
  // BASIC EXECUTION
  // =========================================================================

  test("audit with valid file and scope produces summary output", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "audit", "--files", evidencePath, "--scope", "AWS Production"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output).toContain("CORSAIR AUDIT REPORT");
    expect(output).toContain("AWS Production");
  });

  test("audit --json produces valid JSON output", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "audit", "--files", evidencePath, "--scope", "Cloud", "--json"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("scope");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.scope.name).toBe("Cloud");
  });

  // =========================================================================
  // FLAG PARSING
  // =========================================================================

  test("audit parses --frameworks as comma-separated list", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "SOC 2",
        "--frameworks", "SOC2,NIST-800-53",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed.scope.frameworks).toEqual(["SOC2", "NIST-800-53"]);
  });

  test("audit parses --exclude as comma-separated control IDs", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "Cloud",
        "--exclude", "ACME-IAM-003,ACME-BCP-001",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed.scope.excludeControls).toEqual(["ACME-IAM-003", "ACME-BCP-001"]);
  });

  test("audit --score includes score in JSON output", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "Cloud",
        "--score",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed.score).toBeDefined();
    expect(parsed.score.composite).toBeGreaterThanOrEqual(0);
  });

  test("audit default config has score=true and governance=false", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "Cloud",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    // Score should be present by default
    expect(parsed.score).toBeDefined();
    // Governance should not be present by default
    expect(parsed.governance).toBeUndefined();
  });

  test("audit --governance includes governance in JSON output", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "Cloud",
        "--governance",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed.governance).toBeDefined();
    expect(parsed.governance.model).toBe("deterministic");
  });

  test("audit --format forces evidence format", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "Cloud",
        "--format", "generic",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed.scope).toBeDefined();
  });

  test("audit supports multiple --files", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath, evidencePath,
        "--scope", "Multi-file Test",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed.scope.name).toBe("Multi-file Test");
    // With two copies of the same file, we should have more evidence
    expect(parsed.evidence.length).toBe(2);
  });

  // =========================================================================
  // SUMMARY OUTPUT MODE
  // =========================================================================

  test("audit without --json outputs human-readable summary", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "SOC 2 Type II",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    expect(output).toContain("CORSAIR AUDIT REPORT");
    expect(output).toContain("SOC 2 Type II");
    expect(output).toContain("Controls:");
    expect(output).toContain("SCORE:");
  });

  test("audit summary includes findings section when findings exist", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "Cloud",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    // The generic evidence file has some failed controls, so there should be findings
    expect(output).toContain("Findings:");
  });

  // =========================================================================
  // JSON OUTPUT STRUCTURE
  // =========================================================================

  test("audit JSON output has required fields", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "Validation Test",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const result = JSON.parse(output);
    expect(result.id).toMatch(/^audit-/);
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.evidence).toBeInstanceOf(Array);
    expect(result.findings).toBeInstanceOf(Array);
    expect(result.summary.totalControls).toBeGreaterThan(0);
    expect(result.summary.grade).toMatch(/^[A-F]$/);
  });

  test("audit JSON summary has correct control counts", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "audit",
        "--files", evidencePath,
        "--scope", "Control Count Test",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const result = JSON.parse(output);
    const { totalControls, passed, failed, skipped } = result.summary;
    expect(totalControls).toBe(passed + failed + skipped);
    expect(totalControls).toBe(10); // generic-evidence.json has 10 controls
  });
});
