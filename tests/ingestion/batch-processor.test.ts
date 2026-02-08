import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { processBatch } from "../../src/ingestion/batch-processor";
import type { BatchResult } from "../../src/ingestion/batch-processor";

const TEST_DIR = "/tmp/corsair-batch-test";

describe("Batch Processor", () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(`${TEST_DIR}/output`, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("processBatch returns empty result for empty directory", async () => {
    const emptyDir = `${TEST_DIR}/empty`;
    mkdirSync(emptyDir, { recursive: true });
    const result = await processBatch(emptyDir, { outputDir: `${TEST_DIR}/output`, type: "soc2" });
    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toEqual([]);
  });

  test("processBatch skips non-PDF files", async () => {
    const mixedDir = `${TEST_DIR}/mixed`;
    mkdirSync(mixedDir, { recursive: true });
    writeFileSync(`${mixedDir}/readme.txt`, "not a PDF");
    writeFileSync(`${mixedDir}/data.json`, "{}");
    const result = await processBatch(mixedDir, { outputDir: `${TEST_DIR}/output`, type: "soc2" });
    expect(result.processed).toBe(0);
  });

  test("processBatch reports failure for invalid PDFs", async () => {
    const badDir = `${TEST_DIR}/bad-pdfs`;
    mkdirSync(badDir, { recursive: true });
    writeFileSync(`${badDir}/fake.pdf`, "this is not a real PDF");
    const result = await processBatch(badDir, { outputDir: `${TEST_DIR}/output`, type: "soc2" });
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].error).toBeDefined();
  });

  test("BatchResult shape is correct", async () => {
    const emptyDir = `${TEST_DIR}/shape-test`;
    mkdirSync(emptyDir, { recursive: true });
    const result = await processBatch(emptyDir, { outputDir: `${TEST_DIR}/output`, type: "soc2" });
    expect(typeof result.processed).toBe("number");
    expect(typeof result.succeeded).toBe("number");
    expect(typeof result.failed).toBe("number");
    expect(Array.isArray(result.results)).toBe(true);
  });
});
