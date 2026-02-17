import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { VERSION } from "../../src/version";

describe("Corsair CLI", () => {
  const cwd = "/Users/ayoubfandi/projects/corsair";
  const tmpDir = join(import.meta.dir, ".tmp-mappings");

  beforeAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });
    const mapping = {
      id: "cli-test-mapping",
      match: { allOf: ["$.evidenceOnly"] },
      metadata: { title: "CLI Test", issuer: "Test", scope: "Test", date: "2026-02-17" },
      passthrough: { paths: { summary: "$.summary" } },
    };
    writeFileSync(join(tmpDir, "cli-test.json"), JSON.stringify(mapping, null, 2));
  });

  afterAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  test("help command shows usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("CORSAIR");
    expect(output).toContain("verify");
    expect(output).toContain("keygen");
  });

  test("--help flag shows usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("CORSAIR");
  });

  test("no args shows help", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("CORSAIR");
  });

  test("unknown command exits with error", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "nonexistent"], { cwd, stderr: "pipe" });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown command");
  });

  test("verify --help shows verify usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "verify", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("VERIFY");
    expect(output).toContain("--file");
    expect(output).toContain("--json");
  });

  test("keygen --help shows keygen usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "keygen", "--help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("KEYGEN");
    expect(output).toContain("--output");
  });

  test("verify without --file shows error", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "verify"], { cwd, stderr: "pipe" });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(2);
    expect(stderr).toContain("--file is required");
  });

  test("version matches package.json", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain(VERSION);
  });

  test("help shows diff command", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("diff");
    expect(output).toContain("log");
    expect(output).toContain("mappings");
  });

  test("mappings list returns JSON with loaded mappings", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "mappings", "list", "--json"],
      { cwd, env: { ...process.env, CORSAIR_MAPPING_DIR: tmpDir } },
    );
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((m: { id?: string }) => m.id === "cli-test-mapping")).toBe(true);
  });

  test("mappings validate reports ok in json mode", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "corsair.ts", "mappings", "validate", "--json"],
      { cwd, env: { ...process.env, CORSAIR_MAPPING_DIR: tmpDir } },
    );
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.mappings)).toBe(true);
  });
});
