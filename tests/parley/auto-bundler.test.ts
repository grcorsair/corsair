/**
 * Auto-Bundler Tests
 *
 * Tests the automated CPOE generation pipeline.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync } from "fs";
import { AutoBundler } from "../../src/parley/auto-bundler";
import { Corsair } from "../../src/corsair-mvp";
import { CPOEKeyManager } from "../../src/parley/cpoe-key-manager";
import type { ParleyConfig } from "../../src/parley/parley-types";

const TEST_DIR = "/tmp/auto-bundler-test";
const KEY_DIR = `${TEST_DIR}/keys`;
const OUTPUT_DIR = `${TEST_DIR}/output`;

function makeConfig(overrides: Partial<ParleyConfig> = {}): ParleyConfig {
  return {
    localOutputDir: OUTPUT_DIR,
    providers: [
      { providerId: "aws-cognito", targetId: "test-pool", source: "fixture" as const },
    ],
    issuer: { id: "test-issuer", name: "Test Issuer" },
    ...overrides,
  };
}

describe("Auto-Bundler", () => {
  let corsair: Corsair;
  let keyManager: CPOEKeyManager;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(KEY_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });

    corsair = new Corsair();
    await corsair.initialize();

    keyManager = new CPOEKeyManager(KEY_DIR);
    await keyManager.generateKeypair();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("AutoBundler runs full pipeline for single provider", async () => {
    const config = makeConfig();
    const bundler = new AutoBundler(config, corsair, keyManager);
    const result = await bundler.bundle();

    expect(result.providersRun).toContain("aws-cognito");
    expect(result.cpoeGenerated).toBe(true);
  });

  test("AutoBundler runs all configured providers", async () => {
    const config = makeConfig({
      providers: [
        { providerId: "aws-cognito", targetId: "test-pool", source: "fixture" },
        { providerId: "aws-s3", targetId: "test-bucket", source: "fixture" },
      ],
    });
    const bundler = new AutoBundler(config, corsair, keyManager);
    const result = await bundler.bundle();

    expect(result.providersRun).toContain("aws-cognito");
    expect(result.providersRun).toContain("aws-s3");
  });

  test("AutoBundler generates CPOE from combined results", async () => {
    const config = makeConfig();
    const bundler = new AutoBundler(config, corsair, keyManager);
    const result = await bundler.bundle();

    expect(result.cpoeGenerated).toBe(true);
    expect(result.localPath).toBeDefined();

    // Verify the CPOE file exists
    expect(existsSync(result.localPath!)).toBe(true);

    // Verify it's valid JSON with CPOE structure
    const content = JSON.parse(readFileSync(result.localPath!, "utf-8"));
    expect(content.parley).toBe("1.0");
    expect(content.cpoe).toBeDefined();
    expect(content.signature).toBeDefined();
  });

  test("AutoBundler skips publish when no changes detected (diff detection)", async () => {
    const config = makeConfig();
    const bundler = new AutoBundler(config, corsair, keyManager);

    // First bundle
    const result1 = await bundler.bundle();
    expect(result1.cpoeGenerated).toBe(true);

    // Second bundle with same data — should skip
    const bundler2 = new AutoBundler(config, corsair, keyManager);
    const result2 = await bundler2.bundle();
    expect(result2.cpoeGenerated).toBe(false);
  });

  test("AutoBundler writes CPOE to local file", async () => {
    const config = makeConfig();
    const bundler = new AutoBundler(config, corsair, keyManager);
    const result = await bundler.bundle();

    expect(result.localPath).toBeDefined();
    const files = readdirSync(OUTPUT_DIR).filter((f) => f.startsWith("cpoe-"));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  test("AutoBundler config validates required fields", () => {
    const config = makeConfig();
    expect(config.providers.length).toBeGreaterThanOrEqual(1);
    expect(config.issuer.id).toBeDefined();
    expect(config.issuer.name).toBeDefined();
  });

  test("AutoBundler handles provider errors gracefully (continues with others)", async () => {
    const config = makeConfig({
      providers: [
        { providerId: "nonexistent-provider", targetId: "bad", source: "fixture" },
        { providerId: "aws-cognito", targetId: "test-pool", source: "fixture" },
      ],
    });
    const bundler = new AutoBundler(config, corsair, keyManager);
    const result = await bundler.bundle();

    // Should still have cognito results
    expect(result.providersRun).toContain("aws-cognito");
    expect(result.cpoeGenerated).toBe(true);
  });

  test("AutoBundler produces valid overallScore", async () => {
    const config = makeConfig();
    const bundler = new AutoBundler(config, corsair, keyManager);
    const result = await bundler.bundle();

    expect(typeof result.overallScore).toBe("number");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  test("AutoBundler does not publish when no endpoint configured", async () => {
    const config = makeConfig();
    // No endpoint configured
    expect(config.endpoint).toBeUndefined();

    const bundler = new AutoBundler(config, corsair, keyManager);
    const result = await bundler.bundle();

    expect(result.published).toBe(false);
  });
});
