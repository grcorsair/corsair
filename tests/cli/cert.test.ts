import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Certification CLI Integration Tests
 *
 * Tests the `corsair cert` command wiring in corsair.ts.
 * Validates subcommand routing, flag parsing, error handling, and output.
 *
 * Strategy:
 *   - CLI process spawn for: help, create, error paths
 *   - Direct engine import for operations requiring pre-existing certifications
 *     (check, list, renew, suspend, revoke, history, expiring) because
 *     in-memory storage doesn't persist between CLI invocations
 */

const cwd = "/Users/ayoubfandi/projects/corsair";
const evidencePath = `${cwd}/examples/generic-evidence.json`;

// Temp directory for test evidence files
let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "corsair-cert-test-"));
  // Create a minimal evidence file for tests
  const minimalEvidence = {
    metadata: {
      title: "Test Evidence",
      issuer: "Test Org",
      date: "2026-01-01",
      scope: "Test Scope",
    },
    controls: [
      {
        id: "TEST-001",
        description: "Test control",
        status: "pass",
        severity: "HIGH",
        evidence: "Automated scan confirms control is effective.",
        framework: "SOC2",
        controlId: "CC6.1",
        controlName: "Test Control",
      },
      {
        id: "TEST-002",
        description: "Another test control",
        status: "pass",
        severity: "MEDIUM",
        evidence: "Config export shows control is enabled.",
        framework: "NIST-800-53",
        controlId: "AC-2",
        controlName: "Account Management",
      },
    ],
  };
  writeFileSync(
    join(tmpDir, "test-evidence.json"),
    JSON.stringify(minimalEvidence, null, 2),
  );
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// =============================================================================
// HELP & DISCOVERY
// =============================================================================

describe("Corsair Cert CLI — Help & Discovery", () => {
  test("help command includes cert", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("cert");
  });

  test("cert --help shows subcommands", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "cert", "--help"], {
      cwd,
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("CERT");
    expect(output).toContain("create");
    expect(output).toContain("check");
    expect(output).toContain("list");
    expect(output).toContain("renew");
    expect(output).toContain("suspend");
    expect(output).toContain("revoke");
    expect(output).toContain("history");
    expect(output).toContain("expiring");
  });

  test("cert -h shows help", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "cert", "-h"], {
      cwd,
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("CERT");
  });

  test("cert with no subcommand shows help", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "cert"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("CERT");
  });

  test("cert unknown subcommand shows help and exits with error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "nonexistent"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown cert subcommand");
  });
});

// =============================================================================
// CERT CREATE
// =============================================================================

describe("Corsair Cert CLI — Create", () => {
  test("cert create with valid flags produces JSON output", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "create",
        "--scope", "AWS Production",
        "--frameworks", "SOC2,NIST-800-53",
        "--files", evidencePath,
        "--min-score", "70",
        "--audit-interval", "90",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("id");
    expect(parsed.id).toMatch(/^cert-/);
    expect(parsed).toHaveProperty("status");
    expect(parsed).toHaveProperty("currentScore");
    expect(parsed).toHaveProperty("currentGrade");
  });

  test("cert create requires --scope", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "create",
        "--files", evidencePath,
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--scope");
  });

  test("cert create requires --files", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "create",
        "--scope", "Test Scope",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--files");
  });

  test("cert create with nonexistent file shows error", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "create",
        "--scope", "Test",
        "--files", "/nonexistent/file.json",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("not found");
  });

  test("cert create produces human-readable output without --json", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "create",
        "--scope", "AWS Production",
        "--files", evidencePath,
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output).toContain("Certification created");
    expect(output).toContain("cert-");
  });

  test("cert create parses --frameworks as comma-separated list", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "create",
        "--scope", "Cloud",
        "--files", evidencePath,
        "--frameworks", "SOC2,NIST-800-53,ISO27001",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.id).toMatch(/^cert-/);
  });

  test("cert create with --min-score and --audit-interval sets policy", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "create",
        "--scope", "Strict Policy",
        "--files", evidencePath,
        "--min-score", "90",
        "--audit-interval", "30",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.id).toMatch(/^cert-/);
  });
});

// =============================================================================
// CERT CHECK
// =============================================================================

describe("Corsair Cert CLI — Check", () => {
  test("cert check with invalid ID shows not found", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "check", "cert-nonexistent-id"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("not found");
  });

  test("cert check without cert ID shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "check"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("certification ID");
  });
});

// =============================================================================
// CERT LIST
// =============================================================================

describe("Corsair Cert CLI — List", () => {
  test("cert list with no certifications shows empty message", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "list"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output).toContain("No certifications found");
  });

  test("cert list --status with no results shows filtered message", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "list", "--status", "suspended"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output).toContain("No certifications found");
  });
});

// =============================================================================
// CERT RENEW
// =============================================================================

describe("Corsair Cert CLI — Renew", () => {
  test("cert renew with invalid ID shows not found", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "renew", "cert-nonexistent",
        "--files", evidencePath,
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("not found");
  });

  test("cert renew without cert ID shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "renew"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("certification ID");
  });

  test("cert renew without --files shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "renew", "cert-some-id"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--files");
  });
});

// =============================================================================
// CERT SUSPEND
// =============================================================================

describe("Corsair Cert CLI — Suspend", () => {
  test("cert suspend requires --reason", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "suspend", "cert-some-id"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--reason");
  });

  test("cert suspend without cert ID shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "suspend"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("certification ID");
  });

  test("cert suspend with invalid ID shows not found", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "suspend", "cert-nonexistent",
        "--reason", "Compliance drift",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("not found");
  });
});

// =============================================================================
// CERT REVOKE
// =============================================================================

describe("Corsair Cert CLI — Revoke", () => {
  test("cert revoke requires --reason", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "revoke", "cert-some-id"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--reason");
  });

  test("cert revoke without cert ID shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "revoke"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("certification ID");
  });

  test("cert revoke with invalid ID shows not found", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "cert", "revoke", "cert-nonexistent",
        "--reason", "Critical vulnerability",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("not found");
  });
});

// =============================================================================
// CERT HISTORY
// =============================================================================

describe("Corsair Cert CLI — History", () => {
  test("cert history with invalid ID shows not found", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "history", "cert-nonexistent"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("not found");
  });

  test("cert history without cert ID shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "history"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("certification ID");
  });
});

// =============================================================================
// CERT EXPIRING
// =============================================================================

describe("Corsair Cert CLI — Expiring", () => {
  test("cert expiring default 30 days shows no results on empty engine", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "expiring"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output).toContain("No expiring certifications");
  });

  test("cert expiring --within custom days", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "cert", "expiring", "--within", "60"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    // Empty engine, but should indicate the timeframe
    expect(output).toContain("No expiring certifications");
  });
});

// =============================================================================
// UNIT TESTS — Direct Engine Import for Positive Paths
// These test the full integration through the cert engine with state
// =============================================================================

describe("Corsair Cert CLI — Engine Integration (positive paths)", () => {
  test("CertificationEngine create + check roundtrip", async () => {
    const { CertificationEngine } = await import(
      "../../src/certification/certification-engine"
    );
    const { runAudit } = await import("../../src/audit/audit-engine");

    const engine = new CertificationEngine();

    const auditResult = await runAudit({
      name: "Unit Test Scope",
      frameworks: ["SOC2"],
      evidencePaths: [evidencePath],
    });

    const policy = {
      id: "policy-test",
      name: "Test Policy",
      scope: {
        name: "Unit Test Scope",
        frameworks: ["SOC2"],
        evidencePaths: [evidencePath],
      },
      minimumScore: 60,
      warningThreshold: 80,
      auditIntervalDays: 90,
      freshnessMaxDays: 7,
      gracePeriodDays: 14,
      autoRenew: false,
      autoSuspend: false,
      notifyOnChange: false,
    };

    const cert = engine.createCertification("org-test", policy, auditResult);
    expect(cert.id).toMatch(/^cert-/);
    expect(cert.status).toBeDefined();
    expect(cert.currentScore).toBeGreaterThanOrEqual(0);

    const check = engine.checkCertification(cert.id);
    expect(check).toBeDefined();
    expect(check!.status).toBe(cert.status);
    expect(check!.currentScore).toBe(cert.currentScore);
  });

  test("CertificationEngine list returns created certifications", async () => {
    const { CertificationEngine } = await import(
      "../../src/certification/certification-engine"
    );
    const { runAudit } = await import("../../src/audit/audit-engine");

    const engine = new CertificationEngine();

    const auditResult = await runAudit({
      name: "List Test",
      frameworks: [],
      evidencePaths: [evidencePath],
    });

    const policy = {
      id: "policy-list-test",
      name: "List Policy",
      scope: { name: "List Test", frameworks: [] as string[], evidencePaths: [evidencePath] },
      minimumScore: 50,
      warningThreshold: 80,
      auditIntervalDays: 90,
      freshnessMaxDays: 7,
      gracePeriodDays: 14,
      autoRenew: false,
      autoSuspend: false,
      notifyOnChange: false,
    };

    engine.createCertification("org-1", policy, auditResult);
    engine.createCertification("org-2", policy, auditResult);

    const all = engine.listCertifications();
    expect(all.length).toBe(2);

    const filtered = engine.listCertifications("org-1");
    expect(filtered.length).toBe(1);
    expect(filtered[0].orgId).toBe("org-1");
  });

  test("CertificationEngine history shows status timeline", async () => {
    const { CertificationEngine } = await import(
      "../../src/certification/certification-engine"
    );
    const { runAudit } = await import("../../src/audit/audit-engine");

    const engine = new CertificationEngine();

    const auditResult = await runAudit({
      name: "History Test",
      frameworks: [],
      evidencePaths: [evidencePath],
    });

    const policy = {
      id: "policy-history",
      name: "History Policy",
      scope: { name: "History Test", frameworks: [] as string[], evidencePaths: [evidencePath] },
      minimumScore: 50,
      warningThreshold: 80,
      auditIntervalDays: 90,
      freshnessMaxDays: 7,
      gracePeriodDays: 14,
      autoRenew: false,
      autoSuspend: false,
      notifyOnChange: false,
    };

    const cert = engine.createCertification("org-hist", policy, auditResult);
    expect(cert.statusHistory.length).toBeGreaterThanOrEqual(1);
    expect(cert.statusHistory[0].reason).toBe("Initial certification");
  });
});
