/**
 * Tests for Plugin Registry
 *
 * Verifies manifest-based plugin discovery and registration.
 * Plugins are discovered via *.plugin.json manifests.
 *
 * TDD Approach: Writing tests FIRST to define the contract
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

// Will be implemented in next step
import { PluginRegistry } from "../../src/core/plugin-registry";
import type { PluginManifest } from "../../src/types/provider-plugin";

const TEST_PLUGINS_DIR = "/tmp/corsair-test-plugins";

beforeEach(() => {
  // Clean up and create test directory
  if (existsSync(TEST_PLUGINS_DIR)) {
    rmSync(TEST_PLUGINS_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_PLUGINS_DIR, { recursive: true });
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PLUGINS_DIR)) {
    rmSync(TEST_PLUGINS_DIR, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 1: Plugin registry discovers *.plugin.json manifests
// ═══════════════════════════════════════════════════════════════════════════════

describe("PluginRegistry - Discovery", () => {
  it("should discover plugin manifest in directory", async () => {
    // Create a valid plugin manifest
    const manifest: PluginManifest = {
      providerId: "test-provider",
      version: "1.0.0",
      entryPoint: "./test-plugin.ts",
      attackVectors: [
        {
          vector: "test-attack",
          description: "Test attack vector",
          mitreMapping: "T1234",
          requiredPermissions: ["test:read"],
          intensity: { min: 1, max: 10, default: 5 }
        }
      ]
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "test-provider.plugin.json"),
      JSON.stringify(manifest, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(1);
    expect(manifests[0].providerId).toBe("test-provider");
  });

  it("should discover multiple plugin manifests", async () => {
    // Create two plugin manifests
    const manifest1: PluginManifest = {
      providerId: "provider-one",
      version: "1.0.0",
      entryPoint: "./plugin-one.ts",
      attackVectors: []
    };

    const manifest2: PluginManifest = {
      providerId: "provider-two",
      version: "2.0.0",
      entryPoint: "./plugin-two.ts",
      attackVectors: []
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "provider-one.plugin.json"),
      JSON.stringify(manifest1, null, 2)
    );

    writeFileSync(
      join(TEST_PLUGINS_DIR, "provider-two.plugin.json"),
      JSON.stringify(manifest2, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(2);

    const ids = manifests.map(m => m.providerId).sort();
    expect(ids).toEqual(["provider-one", "provider-two"]);
  });

  it("should ignore non-plugin JSON files", async () => {
    // Create a plugin manifest
    const manifest: PluginManifest = {
      providerId: "test-provider",
      version: "1.0.0",
      entryPoint: "./test.ts",
      attackVectors: []
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "test-provider.plugin.json"),
      JSON.stringify(manifest, null, 2)
    );

    // Create a non-plugin JSON file
    writeFileSync(
      join(TEST_PLUGINS_DIR, "config.json"),
      JSON.stringify({ some: "config" }, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(1); // Only the .plugin.json file
    expect(manifests[0].providerId).toBe("test-provider");
  });

  it("should handle empty directory", async () => {
    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 2: Plugin registry validates manifest schemas
// ═══════════════════════════════════════════════════════════════════════════════

describe("PluginRegistry - Validation", () => {
  it("should validate required manifest fields", async () => {
    // Invalid manifest missing required fields
    const invalidManifest = {
      providerId: "incomplete-provider"
      // Missing version, entryPoint, attackVectors
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "invalid.plugin.json"),
      JSON.stringify(invalidManifest, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(0); // Invalid manifest should be skipped
  });

  it("should validate attack vector declarations", async () => {
    // Manifest with invalid attack vector (missing required fields)
    const manifest: Partial<PluginManifest> = {
      providerId: "test-provider",
      version: "1.0.0",
      entryPoint: "./test.ts",
      attackVectors: [
        {
          vector: "test",
          description: "Test",
          mitreMapping: "T1234"
          // Missing requiredPermissions and intensity
        } as any
      ]
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "invalid-vector.plugin.json"),
      JSON.stringify(manifest, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(0); // Invalid manifest should be skipped
  });

  it("should accept valid manifests with all fields", async () => {
    const validManifest: PluginManifest = {
      providerId: "valid-provider",
      version: "1.2.3",
      entryPoint: "./valid-plugin.ts",
      attackVectors: [
        {
          vector: "test-attack",
          description: "Test attack description",
          mitreMapping: "T1234.567",
          requiredPermissions: ["read:config", "test:execute"],
          intensity: {
            min: 1,
            max: 10,
            default: 5
          }
        }
      ]
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "valid.plugin.json"),
      JSON.stringify(validManifest, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(1);
    expect(manifests[0].providerId).toBe("valid-provider");
    expect(manifests[0].attackVectors).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 3: Plugin registry queries available attack vectors
// ═══════════════════════════════════════════════════════════════════════════════

describe("PluginRegistry - Querying", () => {
  it("should query all available attack vectors", async () => {
    const manifest1: PluginManifest = {
      providerId: "provider-one",
      version: "1.0.0",
      entryPoint: "./one.ts",
      attackVectors: [
        {
          vector: "attack-a",
          description: "Attack A",
          mitreMapping: "T1111",
          requiredPermissions: [],
          intensity: { min: 1, max: 10, default: 5 }
        },
        {
          vector: "attack-b",
          description: "Attack B",
          mitreMapping: "T2222",
          requiredPermissions: [],
          intensity: { min: 1, max: 10, default: 5 }
        }
      ]
    };

    const manifest2: PluginManifest = {
      providerId: "provider-two",
      version: "1.0.0",
      entryPoint: "./two.ts",
      attackVectors: [
        {
          vector: "attack-c",
          description: "Attack C",
          mitreMapping: "T3333",
          requiredPermissions: [],
          intensity: { min: 1, max: 10, default: 5 }
        }
      ]
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "one.plugin.json"),
      JSON.stringify(manifest1, null, 2)
    );

    writeFileSync(
      join(TEST_PLUGINS_DIR, "two.plugin.json"),
      JSON.stringify(manifest2, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const vectors = registry.getAllAttackVectors();
    expect(vectors).toHaveLength(3);

    const vectorNames = vectors.map(v => v.vector).sort();
    expect(vectorNames).toEqual(["attack-a", "attack-b", "attack-c"]);
  });

  it("should query attack vectors by provider", async () => {
    const manifest: PluginManifest = {
      providerId: "specific-provider",
      version: "1.0.0",
      entryPoint: "./plugin.ts",
      attackVectors: [
        {
          vector: "mfa-bypass",
          description: "Test MFA bypass",
          mitreMapping: "T1556.006",
          requiredPermissions: ["cognito:DescribeUserPool"],
          intensity: { min: 1, max: 10, default: 5 }
        }
      ]
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "specific.plugin.json"),
      JSON.stringify(manifest, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const vectors = registry.getAttackVectorsByProvider("specific-provider");
    expect(vectors).toHaveLength(1);
    expect(vectors[0].vector).toBe("mfa-bypass");
  });

  it("should return empty array for unknown provider", async () => {
    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const vectors = registry.getAttackVectorsByProvider("unknown-provider");
    expect(vectors).toHaveLength(0);
  });

  it("should get manifest by provider ID", async () => {
    const manifest: PluginManifest = {
      providerId: "target-provider",
      version: "2.0.0",
      entryPoint: "./target.ts",
      attackVectors: []
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "target.plugin.json"),
      JSON.stringify(manifest, null, 2)
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const found = registry.getManifest("target-provider");
    expect(found).not.toBeNull();
    expect(found?.version).toBe("2.0.0");
  });

  it("should return null for unknown provider manifest", async () => {
    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const found = registry.getManifest("unknown-provider");
    expect(found).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 4: Plugin registry handles malformed JSON gracefully
// ═══════════════════════════════════════════════════════════════════════════════

describe("PluginRegistry - Error Handling", () => {
  it("should skip malformed JSON files", async () => {
    // Create a valid plugin
    const validManifest: PluginManifest = {
      providerId: "valid-provider",
      version: "1.0.0",
      entryPoint: "./valid.ts",
      attackVectors: []
    };

    writeFileSync(
      join(TEST_PLUGINS_DIR, "valid.plugin.json"),
      JSON.stringify(validManifest, null, 2)
    );

    // Create malformed JSON
    writeFileSync(
      join(TEST_PLUGINS_DIR, "malformed.plugin.json"),
      "{ invalid json here"
    );

    const registry = new PluginRegistry();
    await registry.discover(TEST_PLUGINS_DIR);

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(1); // Only valid manifest loaded
    expect(manifests[0].providerId).toBe("valid-provider");
  });

  it("should handle non-existent directory", async () => {
    const registry = new PluginRegistry();
    await registry.discover("/nonexistent/path");

    const manifests = registry.getManifests();
    expect(manifests).toHaveLength(0);
  });
});
