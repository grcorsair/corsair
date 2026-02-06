/**
 * CLI --format Flag Test Contract
 *
 * Tests the --format flag for generating reports in various formats.
 */

import { describe, test, expect, afterAll } from "bun:test";
import { parseArgs } from "../../corsair";
import type { OutputFormat } from "../../corsair";
import { existsSync, rmSync } from "fs";

describe("CLI --format Flag", () => {
  // Helper to mock process.argv and call parseArgs
  function parseWithArgs(args: string[]) {
    const originalArgv = process.argv;
    process.argv = ["bun", "corsair.ts", ...args];
    const result = parseArgs();
    process.argv = originalArgv;
    return result;
  }

  test("parseArgs with --format html sets format to 'html'", () => {
    const options = parseWithArgs(["--target", "test", "--service", "cognito", "--format", "html"]);
    expect(options.format).toBe("html");
  });

  test("parseArgs with --format oscal sets format to 'oscal'", () => {
    const options = parseWithArgs(["--target", "test", "--service", "cognito", "--format", "oscal"]);
    expect(options.format).toBe("oscal");
  });

  test("parseArgs with --format jsonl sets format to 'jsonl'", () => {
    const options = parseWithArgs(["--target", "test", "--service", "cognito", "--format", "jsonl"]);
    expect(options.format).toBe("jsonl");
  });

  test("parseArgs with --format md sets format to 'md'", () => {
    const options = parseWithArgs(["--target", "test", "--service", "cognito", "--format", "md"]);
    expect(options.format).toBe("md");
  });

  test("parseArgs with --format all sets format to 'all'", () => {
    const options = parseWithArgs(["--target", "test", "--service", "cognito", "--format", "all"]);
    expect(options.format).toBe("all");
  });

  test("parseArgs without --format defaults to 'jsonl'", () => {
    const options = parseWithArgs(["--target", "test", "--service", "cognito"]);
    expect(options.format).toBe("jsonl");
  });

  test("parseArgs with -f short flag works", () => {
    const options = parseWithArgs(["--target", "test", "--service", "cognito", "-f", "html"]);
    expect(options.format).toBe("html");
  });

  test("--format can be combined with --output", () => {
    const options = parseWithArgs([
      "--target", "test",
      "--service", "cognito",
      "--format", "html",
      "--output", "./reports/test.jsonl",
    ]);
    expect(options.format).toBe("html");
    expect(options.output).toBe("./reports/test.jsonl");
  });

  test("--format html with --output sets both correctly", () => {
    const options = parseWithArgs([
      "--target", "test",
      "--service", "s3",
      "--format", "html",
      "--output", "./report.html",
    ]);
    expect(options.format).toBe("html");
    expect(options.output).toBe("./report.html");
  });

  test("Valid formats are jsonl, html, oscal, md, all", () => {
    const validFormats: OutputFormat[] = ["jsonl", "html", "oscal", "md", "all"];
    for (const fmt of validFormats) {
      const options = parseWithArgs(["--target", "t", "--service", "cognito", "--format", fmt]);
      expect(options.format).toBe(fmt);
    }
  });
});
