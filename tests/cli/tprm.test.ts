import { describe, test, expect } from "bun:test";

/**
 * TPRM CLI Integration Tests
 *
 * Tests the `corsair tprm` command wiring in corsair.ts.
 * Validates subcommand routing, flag parsing, error handling, and output.
 *
 * Strategy:
 *   - CLI process spawn for: help, register, error paths
 *   - Direct engine import for operations requiring pre-existing state
 *     (vendors, assessment, dashboard) because in-memory storage
 *     doesn't persist between CLI invocations
 */

const cwd = "/Users/ayoubfandi/projects/corsair";

// =============================================================================
// HELP & DISCOVERY
// =============================================================================

describe("Corsair TPRM CLI -- Help & Discovery", () => {
  test("help command includes tprm", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("tprm");
  });

  test("tprm --help shows subcommands", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "tprm", "--help"], {
      cwd,
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("TPRM");
    expect(output).toContain("register");
    expect(output).toContain("assess");
    expect(output).toContain("vendors");
    expect(output).toContain("assessment");
    expect(output).toContain("dashboard");
  });

  test("tprm -h shows help", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "tprm", "-h"], {
      cwd,
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("TPRM");
  });

  test("tprm with no subcommand shows help", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "tprm"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("TPRM");
  });

  test("tprm unknown subcommand shows error and exits 1", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "tprm", "nonexistent"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown tprm subcommand");
  });
});

// =============================================================================
// TPRM REGISTER
// =============================================================================

describe("Corsair TPRM CLI -- Register", () => {
  test("tprm register with valid flags prints vendor ID", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "register",
        "--name", "Acme Cloud",
        "--domain", "acme.com",
        "--risk-tier", "high",
        "--tags", "cloud,saas",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output).toContain("Vendor registered");
    expect(output).toContain("vendor-");
    expect(output).toContain("Acme Cloud");
  });

  test("tprm register --json outputs structured JSON", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "register",
        "--name", "Beta Inc",
        "--domain", "beta.io",
        "--risk-tier", "medium",
        "--tags", "infra",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("id");
    expect(parsed.id).toMatch(/^vendor-/);
    expect(parsed.name).toBe("Beta Inc");
    expect(parsed.domain).toBe("beta.io");
    expect(parsed.riskTier).toBe("medium");
    expect(parsed.tags).toEqual(["infra"]);
  });

  test("tprm register requires --name", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "register",
        "--domain", "acme.com",
        "--risk-tier", "high",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--name");
  });

  test("tprm register requires --domain", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "register",
        "--name", "Acme",
        "--risk-tier", "high",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--domain");
  });

  test("tprm register defaults risk-tier to medium and tags to empty", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "register",
        "--name", "Minimal Vendor",
        "--domain", "minimal.co",
        "--json",
      ],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed.riskTier).toBe("medium");
    expect(parsed.tags).toEqual([]);
  });
});

// =============================================================================
// TPRM ASSESS
// =============================================================================

describe("Corsair TPRM CLI -- Assess", () => {
  test("tprm assess requires --vendor", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "assess",
        "--frameworks", "SOC2",
        "--cpoes", "cpoe1.jwt",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--vendor");
  });

  test("tprm assess requires --frameworks", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "assess",
        "--vendor", "vendor-123",
        "--cpoes", "cpoe1.jwt",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--frameworks");
  });

  test("tprm assess requires --cpoes", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "assess",
        "--vendor", "vendor-123",
        "--frameworks", "SOC2",
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--cpoes");
  });

  test("tprm assess with unknown vendor shows error", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "tprm", "assess",
        "--vendor", "vendor-nonexistent",
        "--frameworks", "SOC2",
        "--cpoes", "/nonexistent/cpoe.jwt",
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
// TPRM VENDORS
// =============================================================================

describe("Corsair TPRM CLI -- Vendors", () => {
  test("tprm vendors with no vendors shows empty message", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "tprm", "vendors"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output).toContain("No vendors");
  });

  test("tprm vendors --json with no vendors shows empty array", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "tprm", "vendors", "--json"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(JSON.parse(output)).toEqual([]);
  });
});

// =============================================================================
// TPRM ASSESSMENT
// =============================================================================

describe("Corsair TPRM CLI -- Assessment", () => {
  test("tprm assessment with invalid ID shows not found", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "tprm", "assessment", "assessment-nonexistent"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("not found");
  });

  test("tprm assessment without ID shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "tprm", "assessment"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("assessment ID");
  });
});

// =============================================================================
// TPRM DASHBOARD
// =============================================================================

describe("Corsair TPRM CLI -- Dashboard", () => {
  test("tprm dashboard with no data shows zeroed summary", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "tprm", "dashboard"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(output).toContain("TPRM DASHBOARD");
    expect(output).toContain("Total Vendors");
    expect(output).toContain("0");
  });

  test("tprm dashboard --json with no data shows structured JSON", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "tprm", "dashboard", "--json"],
      { cwd, stdout: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed.totalVendors).toBe(0);
    expect(parsed.averageScore).toBe(0);
    expect(parsed).toHaveProperty("byRiskTier");
    expect(parsed).toHaveProperty("byDecision");
  });
});

// =============================================================================
// ENGINE INTEGRATION TESTS (positive paths with state)
// =============================================================================

describe("Corsair TPRM CLI -- Engine Integration (positive paths)", () => {
  test("TPRMEngine register + listVendors roundtrip", async () => {
    const { TPRMEngine } = await import("../../src/tprm/tprm-engine");
    const engine = new TPRMEngine();

    const vendor = engine.registerVendor({
      name: "Acme Cloud",
      domain: "acme.com",
      did: "did:web:acme.com",
      riskTier: "high",
      tags: ["cloud", "saas"],
    });

    expect(vendor.id).toMatch(/^vendor-/);
    expect(vendor.name).toBe("Acme Cloud");

    const vendors = engine.listVendors();
    expect(vendors.length).toBe(1);
    expect(vendors[0].id).toBe(vendor.id);
  });

  test("TPRMEngine register + listVendors with filters", async () => {
    const { TPRMEngine } = await import("../../src/tprm/tprm-engine");
    const engine = new TPRMEngine();

    engine.registerVendor({
      name: "High Risk",
      domain: "high.com",
      did: "did:web:high.com",
      riskTier: "high",
      tags: ["cloud"],
    });
    engine.registerVendor({
      name: "Low Risk",
      domain: "low.com",
      did: "did:web:low.com",
      riskTier: "low",
      tags: ["on-prem"],
    });

    const highOnly = engine.listVendors({ riskTier: "high" });
    expect(highOnly.length).toBe(1);
    expect(highOnly[0].name).toBe("High Risk");

    const cloudOnly = engine.listVendors({ tag: "cloud" });
    expect(cloudOnly.length).toBe(1);
    expect(cloudOnly[0].name).toBe("High Risk");
  });

  test("TPRMEngine dashboard with no data returns zeroed summary", async () => {
    const { TPRMEngine } = await import("../../src/tprm/tprm-engine");
    const engine = new TPRMEngine();
    const dashboard = engine.getDashboard();

    expect(dashboard.totalVendors).toBe(0);
    expect(dashboard.averageScore).toBe(0);
    expect(dashboard.vendorsNeedingReview).toBe(0);
  });

  test("TPRMEngine dashboard with vendors shows counts", async () => {
    const { TPRMEngine } = await import("../../src/tprm/tprm-engine");
    const engine = new TPRMEngine();

    engine.registerVendor({
      name: "A",
      domain: "a.com",
      did: "did:web:a.com",
      riskTier: "high",
      tags: [],
    });
    engine.registerVendor({
      name: "B",
      domain: "b.com",
      did: "did:web:b.com",
      riskTier: "critical",
      tags: [],
    });

    const dashboard = engine.getDashboard();
    expect(dashboard.totalVendors).toBe(2);
    expect(dashboard.byRiskTier.high).toBe(1);
    expect(dashboard.byRiskTier.critical).toBe(1);
  });
});
