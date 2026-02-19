import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..", "..");
const PKG_PATH = join(ROOT, "package.json");

function getPkg(): Record<string, unknown> {
  return JSON.parse(readFileSync(PKG_PATH, "utf-8"));
}

describe("npm package publish readiness (bin/corsair entry point)", () => {
  describe("bin entry point (package.json)", () => {
    test("bin field exists in package.json", () => {
      const pkg = getPkg();
      expect(pkg.bin).toBeDefined();
    });

    test("bin.corsair points to a file that exists on disk", () => {
      const pkg = getPkg();
      const bin = pkg.bin as Record<string, string>;
      expect(bin.corsair).toBeDefined();
      const binPath = join(ROOT, bin.corsair);
      expect(existsSync(binPath)).toBe(true);
    });

    test("bin target starts with bun shebang", () => {
      const pkg = getPkg();
      const bin = pkg.bin as Record<string, string>;
      const binPath = join(ROOT, bin.corsair);
      const content = readFileSync(binPath, "utf-8");
      expect(content.startsWith("#!/usr/bin/env bun")).toBe(true);
    });
  });

  describe("bin/corsair convenience entry point", () => {
    test("bin/corsair file exists on disk", () => {
      const binPath = join(ROOT, "bin", "corsair");
      expect(existsSync(binPath)).toBe(true);
    });

    test("bin/corsair starts with bun shebang", () => {
      const binPath = join(ROOT, "bin", "corsair");
      const content = readFileSync(binPath, "utf-8");
      expect(content.startsWith("#!/usr/bin/env bun")).toBe(true);
    });

    test("bin/corsair is executable", () => {
      const binPath = join(ROOT, "bin", "corsair");
      const stat = statSync(binPath);
      const isExecutable = (stat.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });

    test("bin/corsair imports from corsair.ts", () => {
      const binPath = join(ROOT, "bin", "corsair");
      const content = readFileSync(binPath, "utf-8");
      expect(content).toContain("corsair.ts");
    });
  });

  describe("files whitelist", () => {
    test("files array includes corsair.ts", () => {
      const pkg = getPkg();
      const files = pkg.files as string[];
      expect(files).toContain("corsair.ts");
    });

    test("files array includes src/", () => {
      const pkg = getPkg();
      const files = pkg.files as string[];
      expect(files.some((f: string) => f === "src" || f === "src/")).toBe(true);
    });

    test("files array includes bin/", () => {
      const pkg = getPkg();
      const files = pkg.files as string[];
      expect(files.some((f: string) => f === "bin" || f === "bin/")).toBe(true);
    });

    test("files array includes examples/", () => {
      const pkg = getPkg();
      const files = pkg.files as string[];
      expect(files.some((f: string) => f === "examples" || f === "examples/")).toBe(true);
    });

  });

  describe("engines field", () => {
    test("engines field exists", () => {
      const pkg = getPkg();
      expect(pkg.engines).toBeDefined();
    });

    test("engines specifies bun", () => {
      const pkg = getPkg();
      const engines = pkg.engines as Record<string, string>;
      expect(engines.bun).toBeDefined();
    });
  });

  describe("dependencies hygiene", () => {
    test("only jose is in dependencies (runtime)", () => {
      const pkg = getPkg();
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps).toBeDefined();
      const depKeys = Object.keys(deps);
      expect(depKeys).toContain("jose");
      // No devDependencies should leak into dependencies
      expect(depKeys).not.toContain("@anthropic-ai/sdk");
      expect(depKeys).not.toContain("bun-types");
    });

    test("@anthropic-ai/sdk is in devDependencies (not dependencies)", () => {
      const pkg = getPkg();
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps).toBeDefined();
      expect(devDeps["@anthropic-ai/sdk"]).toBeDefined();
      // Confirm it is NOT in dependencies
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps["@anthropic-ai/sdk"]).toBeUndefined();
    });
  });

  describe("metadata", () => {
    test("has repository pointing to GitHub", () => {
      const pkg = getPkg();
      const repo = pkg.repository as Record<string, string>;
      expect(repo).toBeDefined();
      expect(repo.url).toContain("github.com");
    });

    test("has keywords array", () => {
      const pkg = getPkg();
      expect(Array.isArray(pkg.keywords)).toBe(true);
      expect((pkg.keywords as string[]).length).toBeGreaterThan(0);
    });

    test("type is module (ESM)", () => {
      const pkg = getPkg();
      expect(pkg.type).toBe("module");
    });
  });
});
