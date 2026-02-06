/**
 * CLI Demo Mode Tests
 *
 * Tests the --target demo pipeline that runs the full CORSAIR cycle
 * on fixture data from all providers without requiring an ANTHROPIC_API_KEY.
 *
 * The demo mode: threatModel -> autoMark -> raid (dryRun) -> plunder -> chart
 * for each provider (aws-cognito, aws-s3, aws-iam, aws-lambda, aws-rds).
 */

import { describe, test, expect, afterEach } from "bun:test";
import { existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runDemo } from "../../corsair";
import type { OutputFormat } from "../../corsair";

describe("CLI Demo Mode", () => {
  const tempFiles: string[] = [];

  function tempPath(suffix: string = ""): string {
    const p = join(tmpdir(), `corsair-demo-test-${Date.now()}${suffix}.jsonl`);
    tempFiles.push(p);
    return p;
  }

  afterEach(() => {
    for (const f of tempFiles) {
      // Remove the base file and any sibling report files
      const dir = f.replace(/\.jsonl$/, "");
      for (const ext of [".jsonl", ".html", ".md", ".oscal.json"]) {
        const candidate = dir + ext;
        if (existsSync(candidate)) {
          rmSync(candidate, { force: true });
        }
      }
      if (existsSync(f)) {
        rmSync(f, { force: true });
      }
    }
    tempFiles.length = 0;
  });

  test("--target demo uses fixture source automatically (no API key needed)", async () => {
    // Ensure no ANTHROPIC_API_KEY dependency
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const outputPath = tempPath();
      const result = await runDemo({ outputPath, format: "jsonl" });

      // Should complete without error
      expect(result).toBeDefined();
      expect(result.providersRun).toBeInstanceOf(Array);
      expect(result.providersRun.length).toBeGreaterThan(0);
    } finally {
      if (savedKey) {
        process.env.ANTHROPIC_API_KEY = savedKey;
      }
    }
  });

  test("Demo generates report data with all available providers", async () => {
    const outputPath = tempPath();
    const result = await runDemo({ outputPath, format: "jsonl" });

    // Should run all 5 AWS providers
    const expectedProviders = ["aws-cognito", "aws-s3", "aws-iam", "aws-lambda", "aws-rds"];
    for (const provider of expectedProviders) {
      expect(result.providersRun).toContain(provider);
    }
    expect(result.providersRun.length).toBe(5);
  });

  test("Demo evidence file contains records from all providers", async () => {
    const outputPath = tempPath();
    const result = await runDemo({ outputPath, format: "jsonl" });

    // Evidence file should exist and contain JSONL records
    expect(existsSync(outputPath)).toBe(true);
    const content = readFileSync(outputPath, "utf-8").trim();
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    // Total evidence records should match plunder totals
    expect(result.totalEvidenceRecords).toBe(lines.length);
  });

  test("Demo completes without ANTHROPIC_API_KEY (no agent needed)", async () => {
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const outputPath = tempPath();
      // Should not throw even without API key
      const result = await runDemo({ outputPath, format: "jsonl" });
      expect(result.providersRun.length).toBeGreaterThan(0);
      expect(result.markResults.length).toBeGreaterThan(0);
      expect(result.raidResults.length).toBeGreaterThan(0);
    } finally {
      if (savedKey) {
        process.env.ANTHROPIC_API_KEY = savedKey;
      }
    }
  });

  test("Demo mode runs threat model for each provider", async () => {
    const outputPath = tempPath();
    const result = await runDemo({ outputPath, format: "jsonl" });

    // Each provider should have a threat model result
    expect(result.threatModels.length).toBe(5);
    for (const tm of result.threatModels) {
      expect(tm.provider).toBeDefined();
      expect(tm.threatCount).toBeGreaterThanOrEqual(0);
      expect(tm.methodology).toBe("STRIDE-automated");
    }
  });

  test("Demo mode produces valid mark results", async () => {
    const outputPath = tempPath();
    const result = await runDemo({ outputPath, format: "jsonl" });

    // Should have mark results from each provider
    expect(result.markResults.length).toBe(5);
    for (const mr of result.markResults) {
      expect(mr.findings).toBeInstanceOf(Array);
      // Mark results should have driftDetected flag
      expect(typeof mr.driftDetected).toBe("boolean");
    }

    // At least some providers should detect drift (fixtures are non-compliant)
    const driftCount = result.markResults.filter((mr) => mr.driftDetected).length;
    expect(driftCount).toBeGreaterThan(0);
  });
});
