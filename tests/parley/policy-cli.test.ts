/**
 * policy CLI Integration Tests
 *
 * Tests the policy validate subcommand.
 */

import { describe, test, expect } from "bun:test";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
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

describe("policy CLI", () => {
  test("validates a policy artifact", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "corsair-policy-"));
    const policyPath = join(tmpDir, "policy.json");
    writeFileSync(policyPath, JSON.stringify({ version: "1.0", requireIssuer: "did:web:acme.com" }));

    try {
      const result = run(["policy", "validate", "--file", policyPath]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("POLICY VALID");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid policy artifacts", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "corsair-policy-"));
    const policyPath = join(tmpDir, "policy.json");
    writeFileSync(policyPath, JSON.stringify({ requireIssuer: 123 }));

    try {
      const result = run(["policy", "validate", "--file", policyPath]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("POLICY INVALID");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

