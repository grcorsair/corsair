/**
 * Batch Sign Tests
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { signBatch } from "../../src/sign/batch-sign";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";

const tmpDir = join(import.meta.dir, ".tmp-batch-sign");
const inputDir = join(tmpDir, "input");
const outputDir = join(tmpDir, "output");
let keyManager: MarqueKeyManager;

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(inputDir, { recursive: true });
  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();

  // Write sample evidence files
  const generic = {
    metadata: { title: "Test", issuer: "Test" },
    controls: [
      { id: "c1", description: "MFA", status: "pass", evidence: "OK" },
      { id: "c2", description: "Encryption", status: "fail", evidence: "Not enabled" },
    ],
  };

  const prowler = [
    { StatusCode: "PASS", FindingInfo: { Uid: "p-1", Title: "Root MFA" } },
    { StatusCode: "FAIL", FindingInfo: { Uid: "p-2", Title: "S3 public" } },
    { StatusCode: "PASS", FindingInfo: { Uid: "p-3", Title: "CloudTrail" } },
  ];

  await Bun.write(join(inputDir, "generic.json"), JSON.stringify(generic));
  await Bun.write(join(inputDir, "prowler.json"), JSON.stringify(prowler));
  await Bun.write(join(inputDir, "invalid.json"), "not valid json {{{");
  await Bun.write(join(inputDir, "readme.txt"), "This should be skipped");
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

describe("signBatch", () => {
  test("signs all .json files in a directory", async () => {
    const results = await signBatch({ inputDir, outputDir }, keyManager);

    // Should process 3 .json files (generic, prowler, invalid)
    expect(results).toHaveLength(3);

    // generic.json should succeed
    const generic = results.find((r) => r.file === "generic.json");
    expect(generic?.success).toBe(true);
    expect(generic?.output?.detectedFormat).toBe("generic");
    expect(generic?.outputPath).toContain("generic.jwt");

    // prowler.json should succeed
    const prowler = results.find((r) => r.file === "prowler.json");
    expect(prowler?.success).toBe(true);
    expect(prowler?.output?.detectedFormat).toBe("prowler");

    // invalid.json should fail gracefully
    const invalid = results.find((r) => r.file === "invalid.json");
    expect(invalid?.success).toBe(false);
    expect(invalid?.error).toBeTruthy();
  });

  test("creates output directory if it does not exist", async () => {
    const newOut = join(tmpDir, "new-output");
    expect(existsSync(newOut)).toBe(false);

    await signBatch({ inputDir, outputDir: newOut }, keyManager);
    expect(existsSync(newOut)).toBe(true);
  });

  test("writes .jwt files to output directory", async () => {
    const results = await signBatch({ inputDir, outputDir }, keyManager);
    const successResults = results.filter((r) => r.success);

    for (const r of successResults) {
      expect(existsSync(r.outputPath!)).toBe(true);
      const content = await Bun.file(r.outputPath!).text();
      expect(content).toMatch(/^eyJ/); // JWT starts with eyJ
    }
  });

  test("defaults output to inputDir/signed", async () => {
    const results = await signBatch({ inputDir }, keyManager);
    const signedDir = join(inputDir, "signed");
    expect(existsSync(signedDir)).toBe(true);

    const jwtFiles = readdirSync(signedDir).filter((f) => f.endsWith(".jwt"));
    expect(jwtFiles.length).toBeGreaterThan(0);
  });

  test("passes format override to all files", async () => {
    // Create a dir with only prowler files
    const prowlerDir = join(tmpDir, "prowler-only");
    mkdirSync(prowlerDir, { recursive: true });
    await Bun.write(
      join(prowlerDir, "scan1.json"),
      JSON.stringify([
        { StatusCode: "PASS", FindingInfo: { Uid: "p-1", Title: "Test" } },
      ]),
    );

    const results = await signBatch(
      { inputDir: prowlerDir, format: "prowler" },
      keyManager,
    );

    expect(results[0].success).toBe(true);
    expect(results[0].output?.detectedFormat).toBe("prowler");
  });

  test("throws if input directory does not exist", async () => {
    await expect(
      signBatch({ inputDir: "/nonexistent/dir" }, keyManager),
    ).rejects.toThrow("Input directory does not exist");
  });

  test("throws if no .json files found", async () => {
    const emptyDir = join(tmpDir, "empty");
    mkdirSync(emptyDir, { recursive: true });

    await expect(
      signBatch({ inputDir: emptyDir }, keyManager),
    ).rejects.toThrow("No .json files found");
  });
});
