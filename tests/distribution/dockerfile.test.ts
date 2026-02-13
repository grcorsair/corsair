import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..", "..");
const DOCKERFILE_PATH = join(ROOT, "docker", "Dockerfile");

describe("CLI Dockerfile", () => {
  test("Dockerfile exists at docker/Dockerfile", () => {
    expect(existsSync(DOCKERFILE_PATH)).toBe(true);
  });

  describe("structure", () => {
    let content: string;

    test("can be read as text", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      expect(content.length).toBeGreaterThan(0);
    });

    test("uses oven/bun:1 as base image", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      expect(content).toContain("FROM oven/bun:1");
    });

    test("is multi-stage build (has multiple FROM statements)", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      const fromCount = (content.match(/^FROM /gm) || []).length;
      expect(fromCount).toBeGreaterThanOrEqual(2);
    });

    test("does NOT use node as runtime (bun-only)", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      // Should not have a FROM node:* line
      const nodeFromLines = (content.match(/^FROM node:/gm) || []);
      expect(nodeFromLines.length).toBe(0);
    });

    test("copies corsair.ts entry point", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      expect(content).toContain("corsair.ts");
    });

    test("copies src/ directory", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      expect(content).toMatch(/COPY.*src\//);
    });

    test("copies package.json", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      expect(content).toMatch(/COPY.*package\.json/);
    });

    test("runs bun install for dependencies", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      expect(content).toContain("bun install");
    });

    test("sets entrypoint or cmd to run corsair.ts via bun", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      const hasEntrypoint = content.includes("ENTRYPOINT") || content.includes("CMD");
      expect(hasEntrypoint).toBe(true);
      // Should reference bun and corsair.ts in the entry
      expect(content).toMatch(/(ENTRYPOINT|CMD).*bun.*corsair\.ts/);
    });

    test("has OCI labels", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      expect(content).toContain("org.opencontainers.image");
    });

    test("sets NODE_ENV=production or BUN_ENV=production", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      const hasProductionEnv =
        content.includes("NODE_ENV=production") ||
        content.includes("BUN_ENV=production");
      expect(hasProductionEnv).toBe(true);
    });

    test("does NOT copy tests/ or apps/ directories in final stage", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      // Split by FROM to get the final stage
      const stages = content.split(/^FROM /m);
      const finalStage = stages[stages.length - 1];
      // Final stage should not copy tests or apps
      expect(finalStage).not.toMatch(/COPY.*tests\//);
      expect(finalStage).not.toMatch(/COPY.*apps\//);
    });

    test("does NOT copy .env or keys/ in final stage", () => {
      content = readFileSync(DOCKERFILE_PATH, "utf-8");
      const stages = content.split(/^FROM /m);
      const finalStage = stages[stages.length - 1];
      expect(finalStage).not.toMatch(/COPY.*\.env/);
      expect(finalStage).not.toMatch(/COPY.*keys\//);
    });
  });
});
