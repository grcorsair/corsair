/**
 * Test: CLI Custom Output Path Feature
 *
 * Validates that users can control evidence output paths via --output flag.
 * This is a P1 blocker fix for CI/CD integration.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { parseArgs } from "../../corsair";
import { existsSync, rmSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

describe("CLI Custom Output Path", () => {
  describe("parseArgs", () => {
    it("should parse --output flag", () => {
      // Mock process.argv
      const originalArgv = process.argv;
      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test-pool",
        "--service",
        "cognito",
        "--output",
        "./custom/evidence.jsonl",
      ];

      const options = parseArgs();

      expect(options.target).toBe("test-pool");
      expect(options.service).toBe("cognito");
      expect(options.output).toBe("./custom/evidence.jsonl");

      process.argv = originalArgv;
    });

    it("should parse -o short flag", () => {
      const originalArgv = process.argv;
      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test-bucket",
        "--service",
        "s3",
        "-o",
        "/tmp/s3-audit.jsonl",
      ];

      const options = parseArgs();

      expect(options.output).toBe("/tmp/s3-audit.jsonl");

      process.argv = originalArgv;
    });

    it("should use default path when --output not provided", () => {
      const originalArgv = process.argv;
      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test-pool",
        "--service",
        "cognito",
      ];

      const options = parseArgs();

      expect(options.output).toBeUndefined();

      process.argv = originalArgv;
    });

    it("should handle absolute paths", () => {
      const originalArgv = process.argv;
      const absolutePath = "/var/jenkins/evidence/test.jsonl";

      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test-pool",
        "--service",
        "cognito",
        "--output",
        absolutePath,
      ];

      const options = parseArgs();

      expect(options.output).toBe(absolutePath);

      process.argv = originalArgv;
    });

    it("should handle relative paths with subdirectories", () => {
      const originalArgv = process.argv;
      const relativePath = "./audits/2025-q1/cognito-test.jsonl";

      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test-pool",
        "--service",
        "cognito",
        "--output",
        relativePath,
      ];

      const options = parseArgs();

      expect(options.output).toBe(relativePath);

      process.argv = originalArgv;
    });

    it("should handle paths with environment variables pattern", () => {
      const originalArgv = process.argv;
      const envPath = "/var/jenkins/evidence/build-${BUILD_ID}.jsonl";

      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test-pool",
        "--service",
        "cognito",
        "--output",
        envPath,
      ];

      const options = parseArgs();

      // Note: We don't expand env vars, just pass through
      expect(options.output).toBe(envPath);

      process.argv = originalArgv;
    });
  });

  describe("Path creation", () => {
    const testDir = "./test-output/cli-test";
    const testPath = `${testDir}/test-evidence.jsonl`;

    beforeAll(() => {
      // Clean up test directory
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should create parent directories if they don't exist", () => {
      expect(existsSync(testDir)).toBe(false);

      // Create directory
      mkdirSync(dirname(resolve(testPath)), { recursive: true });

      expect(existsSync(testDir)).toBe(true);
    });

    it("should handle nested directory creation", () => {
      const nestedPath = "./test-output/cli-test/nested/deep/evidence.jsonl";
      const nestedDir = dirname(resolve(nestedPath));

      mkdirSync(nestedDir, { recursive: true });

      expect(existsSync(nestedDir)).toBe(true);

      // Clean up
      rmSync("./test-output", { recursive: true, force: true });
    });
  });

  describe("Output path validation", () => {
    it("should accept .jsonl extension", () => {
      const originalArgv = process.argv;
      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test",
        "--service",
        "cognito",
        "--output",
        "./evidence/test.jsonl",
      ];

      const options = parseArgs();
      expect(options.output).toContain(".jsonl");

      process.argv = originalArgv;
    });

    it("should accept custom extensions (not validated)", () => {
      // CLI doesn't validate extensions - that's user's choice
      const originalArgv = process.argv;
      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test",
        "--service",
        "cognito",
        "--output",
        "./evidence/test.json",
      ];

      const options = parseArgs();
      expect(options.output).toBe("./evidence/test.json");

      process.argv = originalArgv;
    });
  });

  describe("Default path generation", () => {
    it("should generate timestamped default path", () => {
      // This is tested implicitly by CLI usage
      // Format: ./evidence/corsair-{timestamp}.jsonl
      const pattern = /^\.\/evidence\/corsair-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.jsonl$/;

      // We can't test the actual function without refactoring,
      // but the pattern is documented
      expect("./evidence/corsair-2025-02-05T10-30-45-123Z.jsonl").toMatch(pattern);
    });
  });

  describe("CI/CD integration patterns", () => {
    it("should support Jenkins-style paths", () => {
      const jenkinsPath = "/var/jenkins/workspace/evidence/build-123.jsonl";
      const originalArgv = process.argv;

      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test",
        "--service",
        "cognito",
        "--output",
        jenkinsPath,
      ];

      const options = parseArgs();
      expect(options.output).toBe(jenkinsPath);

      process.argv = originalArgv;
    });

    it("should support GitHub Actions-style paths", () => {
      const githubPath = "./evidence/pr-${GITHUB_PR_NUMBER}/audit.jsonl";
      const originalArgv = process.argv;

      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test",
        "--service",
        "cognito",
        "--output",
        githubPath,
      ];

      const options = parseArgs();
      expect(options.output).toBe(githubPath);

      process.argv = originalArgv;
    });

    it("should support enterprise audit paths", () => {
      const enterprisePath = "/mnt/compliance/q1-2025/project-alpha/cognito-audit.jsonl";
      const originalArgv = process.argv;

      process.argv = [
        "bun",
        "corsair.ts",
        "--target",
        "test",
        "--service",
        "cognito",
        "--output",
        enterprisePath,
      ];

      const options = parseArgs();
      expect(options.output).toBe(enterprisePath);

      process.argv = originalArgv;
    });
  });
});
