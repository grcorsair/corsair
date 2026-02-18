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
import { generateKeyPairSync, verify } from "crypto";

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

  test("mappings pack outputs a pack JSON with mappings", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "corsair-map-"));
    const mappingPath = join(tmpDir, "mapping.json");

    try {
      const mapping = {
        id: "pack-mapping",
        match: { allOf: ["$.signal"] },
        passthrough: { paths: { note: "$.signal" } },
      };
      writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

      const result = run([
        "mappings", "pack",
        "--id", "pack-1",
        "--version", "1.0.0",
        "--mapping", mappingPath,
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.pack.id).toBe("pack-1");
      expect(parsed.pack.version).toBe("1.0.0");
      expect(parsed.mappings).toHaveLength(1);
      expect(parsed.mappings[0].id).toBe("pack-mapping");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("mappings sign adds a valid signature", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "corsair-map-"));
    const packPath = join(tmpDir, "pack.json");
    const keyPath = join(tmpDir, "pack.key");

    try {
      const mapping = {
        id: "signed-mapping",
        match: { allOf: ["$.signed"] },
        passthrough: { paths: { note: "$.signed" } },
      };
      const pack = {
        pack: { id: "signed-pack", version: "1.2.3" },
        mappings: [mapping],
      };
      writeFileSync(packPath, JSON.stringify(pack, null, 2));

      const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      writeFileSync(keyPath, privateKey);

      const result = run([
        "mappings", "sign",
        "--file", packPath,
        "--key", keyPath,
      ]);

      expect(result.exitCode).toBe(0);
      const signedPack = JSON.parse(result.stdout);
      expect(typeof signedPack.signature).toBe("string");

      const canonical = JSON.stringify(sortKeysDeep({
        pack: signedPack.pack,
        mappings: signedPack.mappings,
      }));
      const ok = verify(
        null,
        Buffer.from(canonical),
        { key: publicKey, format: "pem", type: "spki" },
        Buffer.from(signedPack.signature, "base64"),
      );
      expect(ok).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
