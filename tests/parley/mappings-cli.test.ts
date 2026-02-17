/**
 * mappings CLI Integration Tests
 *
 * Tests the CLI subcommands: mappings add.
 */

import { describe, test, expect } from "bun:test";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
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

describe("mappings CLI", () => {
  test("mappings add copies a local mapping file into target directory", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "corsair-map-"));
    const sourcePath = join(tmpDir, "source.json");
    const destDir = join(tmpDir, "dest");

    try {
      const mapping = {
        id: "local-mapping",
        match: { allOf: ["$.test"] },
        passthrough: { paths: { note: "$.test" } },
      };
      writeFileSync(sourcePath, JSON.stringify(mapping, null, 2));

      const result = run([
        "mappings", "add",
        "--file", sourcePath,
        "--dir", destDir,
      ]);

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(destDir, "source.json"))).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
