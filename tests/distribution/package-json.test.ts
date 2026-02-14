import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..", "..");
const PKG_PATH = join(ROOT, "package.json");

describe("package.json npm publish readiness", () => {
  let pkg: Record<string, unknown>;

  test("can be parsed as valid JSON", () => {
    const raw = readFileSync(PKG_PATH, "utf-8");
    pkg = JSON.parse(raw);
    expect(pkg).toBeDefined();
  });

  describe("required fields", () => {
    function getPkg(): Record<string, unknown> {
      return JSON.parse(readFileSync(PKG_PATH, "utf-8"));
    }

    test("has name field", () => {
      const p = getPkg();
      expect(p.name).toBe("@grcorsair/cli");
    });

    test("has version field", () => {
      const p = getPkg();
      expect(typeof p.version).toBe("string");
      // Semver format
      expect(p.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    test("has description field", () => {
      const p = getPkg();
      expect(typeof p.description).toBe("string");
      expect((p.description as string).length).toBeGreaterThan(0);
    });

    test("has license field (Apache-2.0)", () => {
      const p = getPkg();
      expect(p.license).toBe("Apache-2.0");
    });

    test("has author field", () => {
      const p = getPkg();
      expect(p.author).toBeDefined();
    });
  });

  describe("bin entry", () => {
    function getPkg(): Record<string, unknown> {
      return JSON.parse(readFileSync(PKG_PATH, "utf-8"));
    }

    test("has bin.corsair pointing to corsair.ts", () => {
      const p = getPkg();
      const bin = p.bin as Record<string, string>;
      expect(bin).toBeDefined();
      expect(bin.corsair).toBe("./corsair.ts");
    });
  });

  describe("files array (npm whitelist)", () => {
    function getPkg(): Record<string, unknown> {
      return JSON.parse(readFileSync(PKG_PATH, "utf-8"));
    }

    test("has files array", () => {
      const p = getPkg();
      expect(Array.isArray(p.files)).toBe(true);
    });

    test("includes corsair.ts", () => {
      const p = getPkg();
      const files = p.files as string[];
      expect(files).toContain("corsair.ts");
    });

    test("includes src/", () => {
      const p = getPkg();
      const files = p.files as string[];
      expect(files.some((f: string) => f === "src" || f === "src/")).toBe(true);
    });

    test("includes bin/", () => {
      const p = getPkg();
      const files = p.files as string[];
      expect(files.some((f: string) => f === "bin" || f === "bin/")).toBe(true);
    });

    test("does NOT include tests/", () => {
      const p = getPkg();
      const files = p.files as string[];
      expect(files.some((f: string) => f.startsWith("tests"))).toBe(false);
    });

    test("does NOT include apps/", () => {
      const p = getPkg();
      const files = p.files as string[];
      expect(files.some((f: string) => f.startsWith("apps"))).toBe(false);
    });
  });

  describe("engines field", () => {
    function getPkg(): Record<string, unknown> {
      return JSON.parse(readFileSync(PKG_PATH, "utf-8"));
    }

    test("has engines field", () => {
      const p = getPkg();
      expect(p.engines).toBeDefined();
    });

    test("specifies bun >= 1.0", () => {
      const p = getPkg();
      const engines = p.engines as Record<string, string>;
      expect(engines.bun).toBeDefined();
      expect(engines.bun).toMatch(/>=\s*1/);
    });
  });

  describe("repository metadata", () => {
    function getPkg(): Record<string, unknown> {
      return JSON.parse(readFileSync(PKG_PATH, "utf-8"));
    }

    test("has repository field", () => {
      const p = getPkg();
      expect(p.repository).toBeDefined();
    });

    test("repository points to GitHub", () => {
      const p = getPkg();
      const repo = p.repository as Record<string, string>;
      expect(repo.type).toBe("git");
      expect(repo.url).toContain("github.com");
      expect(repo.url).toContain("corsair");
    });

    test("has homepage field", () => {
      const p = getPkg();
      expect(typeof p.homepage).toBe("string");
      expect(p.homepage).toContain("grcorsair.com");
    });

    test("has bugs field", () => {
      const p = getPkg();
      const bugs = p.bugs as Record<string, string>;
      expect(bugs).toBeDefined();
      expect(bugs.url).toContain("github.com");
      expect(bugs.url).toContain("issues");
    });
  });
});
