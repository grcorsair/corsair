/**
 * Corsair Renew CLI Tests — TDD
 *
 * Tests for the `corsair renew` subcommand.
 * Covers: help, error handling, basic renewal, renewal with new evidence.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const cwd = join(import.meta.dir, "../..");
const tmpDir = join(cwd, "tests", "cli", ".tmp-renew-test");

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

let originalCpoePath: string;
let evidencePath: string;

beforeAll(async () => {
  // Create temp dir
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  // Generate a test keypair
  const keygenProc = Bun.spawn(["bun", "run", "corsair.ts", "keygen", "--output", join(tmpDir, "keys")], { cwd });
  await keygenProc.exited;

  // Write sample evidence
  const sampleEvidence = {
    metadata: {
      title: "Q1 2026 Security Assessment",
      issuer: "Acme Corp",
      date: "2026-01-15",
      scope: "AWS Production Environment",
    },
    controls: [
      { id: "MFA-001", description: "MFA enabled", status: "pass", evidence: "Config verified" },
      { id: "ENC-001", description: "Encryption on", status: "pass", evidence: "AES-256 confirmed" },
      { id: "LOG-001", description: "Audit logging", status: "fail", severity: "HIGH", evidence: "CloudTrail disabled" },
    ],
  };
  evidencePath = join(tmpDir, "evidence.json");
  writeFileSync(evidencePath, JSON.stringify(sampleEvidence, null, 2));

  // Sign the evidence to create an original CPOE for renewal
  originalCpoePath = join(tmpDir, "original.jwt");
  const signProc = Bun.spawn(
    [
      "bun", "run", "corsair.ts", "sign",
      "--file", evidencePath,
      "--key-dir", join(tmpDir, "keys"),
      "--output", originalCpoePath,
      "--did", "did:web:acme.com",
      "--scope", "AWS Production Environment",
    ],
    { cwd },
  );
  await signProc.exited;

  // Verify original CPOE was created
  if (!existsSync(originalCpoePath)) {
    throw new Error("Failed to create original CPOE for test setup");
  }
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// HELP
// =============================================================================

describe("corsair renew — help", () => {
  test("renew --help shows renew usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "renew", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("RENEW");
    expect(output).toContain("--file");
    expect(output).toContain("--evidence");
    expect(output).toContain("--output");
  });

  test("main help includes renew command", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("renew");
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

describe("corsair renew — error handling", () => {
  test("renew without --file shows error and exits 2", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "renew"], {
      cwd,
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--file is required");
  });

  test("renew with nonexistent CPOE file shows error", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "renew", "--file", "/tmp/nonexistent.jwt"],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("not found");
  });

  test("renew with invalid CPOE file shows error", async () => {
    const invalidPath = join(tmpDir, "invalid.jwt");
    writeFileSync(invalidPath, "this-is-not-a-jwt");

    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "renew",
        "--file", invalidPath,
        "--key-dir", join(tmpDir, "keys"),
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("Invalid CPOE");
  });
});

// =============================================================================
// BASIC RENEWAL (fresh dates on existing CPOE)
// =============================================================================

describe("corsair renew — basic renewal", () => {
  test("renews an existing CPOE with fresh dates", async () => {
    const renewedPath = join(tmpDir, "renewed.jwt");

    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "renew",
        "--file", originalCpoePath,
        "--key-dir", join(tmpDir, "keys"),
        "--output", renewedPath,
      ],
      { cwd, stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(existsSync(renewedPath)).toBe(true);

    // Decode both JWTs and compare
    const originalJwt = readFileSync(originalCpoePath, "utf-8").trim();
    const renewedJwt = readFileSync(renewedPath, "utf-8").trim();

    const originalParts = originalJwt.split(".");
    const renewedParts = renewedJwt.split(".");

    const originalPayload = JSON.parse(Buffer.from(originalParts[1], "base64url").toString());
    const renewedPayload = JSON.parse(Buffer.from(renewedParts[1], "base64url").toString());

    // Scope should be preserved
    expect(renewedPayload.vc.credentialSubject.scope).toBe(
      originalPayload.vc.credentialSubject.scope
    );

    // Issuer DID should be preserved
    expect(renewedPayload.iss).toBe(originalPayload.iss);

    // iat should be newer (or at least not older)
    expect(renewedPayload.iat).toBeGreaterThanOrEqual(originalPayload.iat);

    // New JWT should be different from original
    expect(renewedJwt).not.toBe(originalJwt);
  });

  test("renewed CPOE is verifiable", async () => {
    const renewedPath = join(tmpDir, "renewed-verifiable.jwt");

    const renewProc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "renew",
        "--file", originalCpoePath,
        "--key-dir", join(tmpDir, "keys"),
        "--output", renewedPath,
      ],
      { cwd },
    );
    await renewProc.exited;

    const verifyProc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "verify",
        "--file", renewedPath,
        "--pubkey", join(tmpDir, "keys", "corsair-signing.pub"),
      ],
      { cwd, stdout: "pipe" },
    );
    const verifyOutput = await new Response(verifyProc.stdout).text();
    const code = await verifyProc.exited;

    expect(code).toBe(0);
    expect(verifyOutput).toContain("VERIFIED");
  });

  test("renew to stdout when no --output", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "renew",
        "--file", originalCpoePath,
        "--key-dir", join(tmpDir, "keys"),
      ],
      { cwd, stdout: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

// =============================================================================
// RENEWAL WITH NEW EVIDENCE
// =============================================================================

describe("corsair renew — with new evidence", () => {
  test("renews with new evidence file", async () => {
    // Write updated evidence with better results
    const newEvidencePath = join(tmpDir, "new-evidence.json");
    const newEvidence = {
      metadata: {
        title: "Q2 2026 Security Assessment",
        issuer: "Acme Corp",
        date: "2026-04-15",
        scope: "AWS Production Environment",
      },
      controls: [
        { id: "MFA-001", description: "MFA enabled", status: "pass", evidence: "Verified" },
        { id: "ENC-001", description: "Encryption on", status: "pass", evidence: "Confirmed" },
        { id: "LOG-001", description: "Audit logging", status: "pass", evidence: "CloudTrail now enabled" },
      ],
    };
    writeFileSync(newEvidencePath, JSON.stringify(newEvidence, null, 2));

    const renewedPath = join(tmpDir, "renewed-with-evidence.jwt");
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "renew",
        "--file", originalCpoePath,
        "--evidence", newEvidencePath,
        "--key-dir", join(tmpDir, "keys"),
        "--output", renewedPath,
      ],
      { cwd, stderr: "pipe" },
    );
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(existsSync(renewedPath)).toBe(true);

    // Decode and verify the renewed CPOE has valid structure
    const renewedJwt = readFileSync(renewedPath, "utf-8").trim();
    const parts = renewedJwt.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    // Should be a valid CPOE
    expect(payload.vc.credentialSubject.type).toBe("CorsairCPOE");

    // Issuer DID should be preserved from original CPOE
    expect(payload.iss).toBe("did:web:acme.com");

    // Should have fresh dates (iat should be recent)
    const originalJwt = readFileSync(originalCpoePath, "utf-8").trim();
    const originalPayload = JSON.parse(Buffer.from(originalJwt.split(".")[1], "base64url").toString());
    expect(payload.iat).toBeGreaterThanOrEqual(originalPayload.iat);

    // Should be a different JWT (new signature, new dates)
    expect(renewedJwt).not.toBe(originalJwt);
  });
});

// =============================================================================
// JSON OUTPUT
// =============================================================================

describe("corsair renew — json output", () => {
  test("--json outputs structured JSON", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "corsair.ts", "renew",
        "--file", originalCpoePath,
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
    expect(parsed.renewedFrom).toBeDefined();
    expect(parsed.scope).toBeDefined();
    expect(parsed.issuer).toBeDefined();
  });
});
