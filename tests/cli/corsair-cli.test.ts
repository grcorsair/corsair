import { describe, test, expect } from "bun:test";

describe("Corsair CLI v0.6.0", () => {
  const cwd = "/Users/ayoubfandi/projects/corsair";

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

  test("version is 0.6.0", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("0.6.0");
  });

  test("help shows diff command", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "help"], { cwd });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("diff");
    expect(output).toContain("log");
  });
});
