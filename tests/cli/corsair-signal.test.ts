import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { FLAGSHIP_EVENTS } from "../../src/flagship/flagship-types";

const cwd = process.cwd();
const tmpDir = join(import.meta.dir, ".tmp-signal");
const keyDir = join(tmpDir, "keys");
const eventPath = join(tmpDir, "event.json");
const setPath = join(tmpDir, "set.jwt");

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  const km = new MarqueKeyManager(keyDir);
  await km.generateKeypair();

  const event = {
    type: FLAGSHIP_EVENTS.PAPERS_CHANGED,
    data: {
      subject: { format: "complex", corsair: { marqueId: "marque-test-123" } },
      event_timestamp: Math.floor(Date.now() / 1000),
      credential_type: "CorsairCPOE",
      change_type: "issued",
    },
  };

  writeFileSync(eventPath, JSON.stringify(event, null, 2));
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

describe("corsair signal", () => {
  test("signal --help shows generate and verify usage", async () => {
    const proc = Bun.spawn(["bun", "run", "corsair.ts", "signal", "--help"], { cwd, stdout: "pipe" });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("generate");
    expect(output).toContain("verify");
  });

  test("signal generate creates a SET and verify validates it", async () => {
    const genProc = Bun.spawn([
      "bun", "run", "corsair.ts", "signal", "generate",
      "--event", eventPath,
      "--issuer", "did:web:acme.com",
      "--audience", "did:web:buyer.com",
      "--key-dir", keyDir,
    ], { cwd, stdout: "pipe" });

    const token = (await new Response(genProc.stdout).text()).trim();
    const genCode = await genProc.exited;
    expect(genCode).toBe(0);
    expect(token.split(".").length).toBe(3);

    writeFileSync(setPath, token);

    const verifyProc = Bun.spawn([
      "bun", "run", "corsair.ts", "signal", "verify",
      "--file", setPath,
      "--key-dir", keyDir,
      "--json",
    ], { cwd, stdout: "pipe" });

    const verifyOutput = await new Response(verifyProc.stdout).text();
    const verifyCode = await verifyProc.exited;
    expect(verifyCode).toBe(0);

    const parsed = JSON.parse(verifyOutput);
    expect(parsed.valid).toBe(true);
    expect(parsed.payload).toBeTruthy();
  });
});

