/**
 * compliance.txt CLI Integration Tests
 *
 * Tests the CLI subcommands: generate, validate, discover.
 * Uses subprocess spawning to test actual CLI behavior.
 */

import { describe, test, expect } from "bun:test";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const CLI = join(import.meta.dir, "../../corsair.ts");

function run(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI, ...args], {
    encoding: "utf-8",
    timeout: 10000,
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: result.status ?? 1,
  };
}

describe("compliance-txt CLI", () => {
  describe("help", () => {
    test("shows help with --help flag", () => {
      const result = run(["compliance-txt", "--help"]);
      expect(result.stdout).toContain("CORSAIR COMPLIANCE-TXT");
      expect(result.stdout).toContain("generate");
      expect(result.stdout).toContain("validate");
      expect(result.stdout).toContain("discover");
      expect(result.exitCode).toBe(0);
    });

    test("shows help with no subcommand", () => {
      const result = run(["compliance-txt"]);
      expect(result.stdout).toContain("CORSAIR COMPLIANCE-TXT");
      expect(result.exitCode).toBe(0);
    });

    test("errors on unknown subcommand", () => {
      const result = run(["compliance-txt", "bogus"]);
      expect(result.stderr).toContain("Unknown compliance-txt subcommand");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("generate", () => {
    test("generates compliance.txt to stdout", () => {
      const result = run([
        "compliance-txt", "generate",
        "--did", "did:web:acme.com",
        "--cpoe-url", "https://acme.com/soc2.jwt",
        "--catalog", "https://acme.com/compliance/catalog.json",
        "--frameworks", "SOC2,ISO27001",
        "--contact", "compliance@acme.com",
      ]);
      expect(result.stdout).toContain("DID: did:web:acme.com");
      expect(result.stdout).toContain("CPOE: https://acme.com/soc2.jwt");
      expect(result.stdout).toContain("CATALOG: https://acme.com/compliance/catalog.json");
      expect(result.stdout).toContain("Frameworks: SOC2, ISO27001");
      expect(result.stdout).toContain("Contact: compliance@acme.com");
      expect(result.exitCode).toBe(0);
    });

    test("generates compliance.txt with base URL for scanned CPOEs", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "corsair-ct-"));
      const cpoeDir = join(tmpDir, "cpoes");
      const cpoePath = join(cpoeDir, "soc2-2026-q1.jwt");

      try {
        mkdirSync(cpoeDir, { recursive: true });
        writeFileSync(cpoePath, "eyJ.fake.jwt");

        const result = run([
          "compliance-txt", "generate",
          "--did", "did:web:acme.com",
          "--cpoes", cpoeDir,
          "--base-url", "https://acme.com/compliance/",
        ]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("CPOE: https://acme.com/compliance/soc2-2026-q1.jwt");
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("generates compliance.txt to file", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "corsair-ct-"));
      const outputPath = join(tmpDir, "compliance.txt");

      try {
        const result = run([
          "compliance-txt", "generate",
          "--did", "did:web:test.com",
          "--output", outputPath,
        ]);
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toContain("compliance.txt generated successfully");

        const content = readFileSync(outputPath, "utf-8");
        expect(content).toContain("DID: did:web:test.com");
        expect(content).toContain("# Corsair Compliance Discovery");
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("errors without --did", () => {
      const result = run(["compliance-txt", "generate"]);
      expect(result.stderr).toContain("--did is required");
      expect(result.exitCode).toBe(2);
    });

    test("shows generate help", () => {
      const result = run(["compliance-txt", "generate", "--help"]);
      expect(result.stdout).toContain("CORSAIR COMPLIANCE-TXT GENERATE");
      expect(result.exitCode).toBe(0);
    });
  });
});
