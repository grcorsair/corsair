/**
 * Plugin Discovery Tests - Phase 1.3
 *
 * Contract: PluginRegistry must auto-discover plugins from filesystem
 *
 * TDD Approach:
 * 1. RED: Write these tests FIRST - they WILL fail initially
 * 2. GREEN: Implement discover() and initialize() to make tests pass
 * 3. REFACTOR: Clean up and optimize
 *
 * Requirements:
 * - Corsair.initialize() discovers plugins from directory
 * - PluginRegistry.discover() scans for *.plugin.json manifests
 * - Manifest validation rejects malformed files
 * - Discovered plugins are auto-registered and accessible
 * - Discovery does NOT break manual plugin registration
 *
 * Phase: 1.3 (Plugin-First Architecture)
 * Pattern: Convention-over-configuration plugin loading
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Corsair } from "../../src/corsair-mvp";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

describe("Plugin Discovery - Phase 1.3", () => {
  const pluginDir = "./plugins";
  const testPluginDir = "./tests/fixtures/plugins-test";
  let corsair: Corsair;

  beforeEach(() => {
    corsair = new Corsair();

    // Create test plugin directory if needed
    if (!existsSync(testPluginDir)) {
      mkdirSync(testPluginDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test plugin directory
    if (existsSync(testPluginDir)) {
      rmSync(testPluginDir, { recursive: true, force: true });
    }
  });

  /**
   * Contract: initialize() must discover plugins from specified directory
   *
   * Rationale: Plugin discovery enables extensibility without code changes.
   * Users should be able to drop a plugin folder and have it auto-load.
   */
  describe("Corsair.initialize() - Plugin Auto-Discovery", () => {

    test("initialize() discovers aws-cognito plugin from plugins/ directory", async () => {
      // Ensure the aws-cognito manifest exists
      const manifestPath = join(pluginDir, "aws-cognito", "aws-cognito.plugin.json");
      expect(existsSync(manifestPath)).toBe(true);

      // Initialize Corsair with plugin discovery
      await corsair.initialize(pluginDir);

      // Verify aws-cognito plugin was discovered
      const plugin = corsair.getPlugin("aws-cognito");
      expect(plugin).toBeDefined();
    });

    test("initialize() returns discovered plugin count", async () => {
      const result = await corsair.initialize(pluginDir);

      expect(result).toBeDefined();
      expect(result.discoveredCount).toBeGreaterThanOrEqual(1);
      expect(result.plugins).toContain("aws-cognito");
    });

    test("initialize() logs discovery progress", async () => {
      // Just verify initialize completes without error
      // In implementation, console.log will show discovery progress
      await expect(corsair.initialize(pluginDir)).resolves.toBeDefined();
    });

    test("initialize() works with default plugins/ path", async () => {
      // When no path specified, should default to plugins/
      await corsair.initialize();

      const plugin = corsair.getPlugin("aws-cognito");
      expect(plugin).toBeDefined();
    });
  });

  /**
   * Contract: Manifest validation must reject invalid schemas
   *
   * Rationale: Invalid plugins should not crash the system.
   * Validation ensures plugin contracts are met.
   */
  describe("Manifest Schema Validation", () => {

    test("discovery validates manifest has required providerId field", async () => {
      // Create a malformed manifest missing providerId
      const badPluginDir = join(testPluginDir, "bad-plugin");
      mkdirSync(badPluginDir, { recursive: true });
      writeFileSync(
        join(badPluginDir, "bad-plugin.plugin.json"),
        JSON.stringify({
          // Missing providerId - should be rejected
          providerName: "Bad Plugin",
          version: "1.0.0",
          attackVectors: []
        })
      );

      // Initialize should skip invalid manifest
      const result = await corsair.initialize(testPluginDir);

      // Bad plugin should NOT be registered
      expect(corsair.getPlugin("bad-plugin")).toBeUndefined();
      expect(result.invalidManifests?.length).toBeGreaterThanOrEqual(1);
    });

    test("discovery validates manifest has required providerName field", async () => {
      const badPluginDir = join(testPluginDir, "no-name-plugin");
      mkdirSync(badPluginDir, { recursive: true });
      writeFileSync(
        join(badPluginDir, "no-name-plugin.plugin.json"),
        JSON.stringify({
          providerId: "no-name-plugin",
          // Missing providerName
          version: "1.0.0",
          attackVectors: []
        })
      );

      const result = await corsair.initialize(testPluginDir);

      expect(corsair.getPlugin("no-name-plugin")).toBeUndefined();
      expect(result.invalidManifests?.length).toBeGreaterThanOrEqual(1);
    });

    test("discovery validates manifest has required version field", async () => {
      const badPluginDir = join(testPluginDir, "no-version-plugin");
      mkdirSync(badPluginDir, { recursive: true });
      writeFileSync(
        join(badPluginDir, "no-version-plugin.plugin.json"),
        JSON.stringify({
          providerId: "no-version-plugin",
          providerName: "No Version Plugin",
          // Missing version
          attackVectors: []
        })
      );

      const result = await corsair.initialize(testPluginDir);

      expect(corsair.getPlugin("no-version-plugin")).toBeUndefined();
    });

    test("discovery validates manifest has attackVectors array", async () => {
      const badPluginDir = join(testPluginDir, "no-vectors-plugin");
      mkdirSync(badPluginDir, { recursive: true });
      writeFileSync(
        join(badPluginDir, "no-vectors-plugin.plugin.json"),
        JSON.stringify({
          providerId: "no-vectors-plugin",
          providerName: "No Vectors Plugin",
          version: "1.0.0"
          // Missing attackVectors
        })
      );

      const result = await corsair.initialize(testPluginDir);

      expect(corsair.getPlugin("no-vectors-plugin")).toBeUndefined();
    });

    test("discovery rejects malformed JSON gracefully", async () => {
      const badPluginDir = join(testPluginDir, "malformed-plugin");
      mkdirSync(badPluginDir, { recursive: true });
      writeFileSync(
        join(badPluginDir, "malformed-plugin.plugin.json"),
        "{ this is not valid JSON }"
      );

      // Should not throw, just skip the invalid manifest
      await expect(corsair.initialize(testPluginDir)).resolves.toBeDefined();
      expect(corsair.getPlugin("malformed-plugin")).toBeUndefined();
    });
  });

  /**
   * Contract: Discovered plugins must be auto-registered and accessible
   *
   * Rationale: After discovery, plugins should work exactly like
   * manually registered plugins.
   */
  describe("Auto-Registration of Discovered Plugins", () => {

    test("discovered plugins are accessible via getPlugin()", async () => {
      await corsair.initialize(pluginDir);

      const plugin = corsair.getPlugin("aws-cognito");
      expect(plugin).toBeDefined();
      expect(plugin?.manifest.providerId).toBe("aws-cognito");
    });

    test("discovered plugin manifest contains expected fields", async () => {
      await corsair.initialize(pluginDir);

      const plugin = corsair.getPlugin("aws-cognito");
      expect(plugin).toBeDefined();
      expect(plugin?.manifest.providerId).toBe("aws-cognito");
      expect(plugin?.manifest.providerName).toBe("AWS Cognito");
      expect(plugin?.manifest.version).toBeDefined();
      expect(Array.isArray(plugin?.manifest.attackVectors)).toBe(true);
    });

    test("discovered plugin attackVectors have required structure", async () => {
      await corsair.initialize(pluginDir);

      const plugin = corsair.getPlugin("aws-cognito");
      expect(plugin).toBeDefined();

      // Each attack vector should have id, name, severity
      for (const vector of plugin?.manifest.attackVectors || []) {
        expect(vector.id).toBeDefined();
        expect(vector.name).toBeDefined();
        expect(vector.severity).toBeDefined();
        expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(vector.severity);
      }
    });

    test("getPlugins() returns all discovered plugins", async () => {
      await corsair.initialize(pluginDir);

      const plugins = corsair.getPlugins();
      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThanOrEqual(1);

      const pluginIds = plugins.map(p => p.manifest.providerId);
      expect(pluginIds).toContain("aws-cognito");
    });
  });

  /**
   * Contract: Discovery finds all *.plugin.json files
   *
   * Rationale: Plugin naming convention enables automatic discovery
   * without hardcoded plugin lists.
   */
  describe("Plugin File Discovery", () => {

    test("discovery finds *.plugin.json files in subdirectories", async () => {
      // Create a valid test plugin
      const goodPluginDir = join(testPluginDir, "test-provider");
      mkdirSync(goodPluginDir, { recursive: true });
      writeFileSync(
        join(goodPluginDir, "test-provider.plugin.json"),
        JSON.stringify({
          providerId: "test-provider",
          providerName: "Test Provider",
          version: "1.0.0",
          attackVectors: [
            {
              id: "test-vector",
              name: "Test Vector",
              description: "A test attack vector",
              severity: "LOW",
              mitreMapping: ["T1000"]
            }
          ]
        })
      );

      await corsair.initialize(testPluginDir);

      const plugin = corsair.getPlugin("test-provider");
      expect(plugin).toBeDefined();
      expect(plugin?.manifest.providerId).toBe("test-provider");
    });

    test("discovery ignores non-plugin.json files", async () => {
      const goodPluginDir = join(testPluginDir, "misc-plugin");
      mkdirSync(goodPluginDir, { recursive: true });

      // Create a regular JSON file (not a plugin manifest)
      writeFileSync(
        join(goodPluginDir, "config.json"),
        JSON.stringify({ notAPlugin: true })
      );

      // Create a valid plugin manifest
      writeFileSync(
        join(goodPluginDir, "misc-plugin.plugin.json"),
        JSON.stringify({
          providerId: "misc-plugin",
          providerName: "Misc Plugin",
          version: "1.0.0",
          attackVectors: []
        })
      );

      await corsair.initialize(testPluginDir);

      // Only the proper manifest should be loaded
      const plugin = corsair.getPlugin("misc-plugin");
      expect(plugin).toBeDefined();
    });

    test("discovery handles empty plugin directories gracefully", async () => {
      // Create empty plugin directory
      const emptyDir = join(testPluginDir, "empty-dir");
      mkdirSync(emptyDir, { recursive: true });

      const result = await corsair.initialize(testPluginDir);
      expect(result).toBeDefined();
      expect(result.discoveredCount).toBe(0);
    });

    test("discovery handles non-existent directory gracefully", async () => {
      const result = await corsair.initialize("./non-existent-plugins-dir-12345");

      expect(result).toBeDefined();
      expect(result.discoveredCount).toBe(0);
      expect(result.error).toBeUndefined(); // Should not error, just find nothing
    });
  });

  /**
   * Contract: Discovery must not break manual plugin registration
   *
   * Rationale: Existing code using manual registration should
   * continue to work alongside auto-discovery.
   */
  describe("Compatibility with Manual Registration", () => {

    test("manual registration still works after initialize()", async () => {
      await corsair.initialize(pluginDir);

      // Manually register a plugin
      const manualManifest = {
        providerId: "manual-plugin",
        providerName: "Manual Plugin",
        version: "1.0.0",
        attackVectors: []
      };

      corsair.registerPlugin(manualManifest);

      // Both discovered and manual plugins should be accessible
      expect(corsair.getPlugin("aws-cognito")).toBeDefined();
      expect(corsair.getPlugin("manual-plugin")).toBeDefined();
    });

    test("initialize() does not duplicate already-registered plugins", async () => {
      // Pre-register a plugin with same ID as discovered
      const preManifest = {
        providerId: "aws-cognito",
        providerName: "Pre-registered Cognito",
        version: "0.0.1",
        attackVectors: []
      };

      corsair.registerPlugin(preManifest);

      // Initialize should detect duplicate and not overwrite (or update)
      await corsair.initialize(pluginDir);

      // Plugin should still exist
      expect(corsair.getPlugin("aws-cognito")).toBeDefined();
    });

    test("initialize() can be called multiple times safely", async () => {
      await corsair.initialize(pluginDir);
      await corsair.initialize(pluginDir);

      // Should not duplicate plugins
      const plugins = corsair.getPlugins();
      const cognitoPlugins = plugins.filter(p => p.manifest.providerId === "aws-cognito");
      expect(cognitoPlugins.length).toBe(1);
    });
  });

  /**
   * Contract: getPlugin and getPlugins methods must exist and work
   *
   * These are the accessor methods for retrieved plugins.
   */
  describe("Plugin Accessor Methods", () => {

    test("getPlugin() returns undefined for unknown plugin", () => {
      expect(corsair.getPlugin("unknown-plugin")).toBeUndefined();
    });

    test("getPlugins() returns empty array before initialize()", () => {
      const plugins = corsair.getPlugins();
      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBe(0);
    });

    test("hasPlugin() returns true for registered plugin", async () => {
      await corsair.initialize(pluginDir);

      expect(corsair.hasPlugin("aws-cognito")).toBe(true);
      expect(corsair.hasPlugin("unknown-plugin")).toBe(false);
    });
  });
});

/**
 * Integration Tests - Full Discovery Flow
 */
describe("Plugin Discovery - Integration", () => {

  test("full discovery flow: initialize -> getPlugin -> use manifest", async () => {
    const corsair = new Corsair();

    // Step 1: Initialize with discovery
    const result = await corsair.initialize("./plugins");
    expect(result.discoveredCount).toBeGreaterThanOrEqual(1);

    // Step 2: Get plugin
    const plugin = corsair.getPlugin("aws-cognito");
    expect(plugin).toBeDefined();

    // Step 3: Use manifest data
    expect(plugin?.manifest.providerId).toBe("aws-cognito");
    expect(plugin?.manifest.providerName).toBe("AWS Cognito");
    expect(plugin?.manifest.attackVectors.length).toBeGreaterThan(0);

    // Step 4: Verify attack vector structure
    const mfaBypass = plugin?.manifest.attackVectors.find(v => v.id === "mfa-bypass");
    expect(mfaBypass).toBeDefined();
    expect(mfaBypass?.severity).toBe("CRITICAL");
  });

  test("aws-cognito manifest contains all expected attack vectors", async () => {
    const corsair = new Corsair();
    await corsair.initialize("./plugins");

    const plugin = corsair.getPlugin("aws-cognito");
    const vectorIds = plugin?.manifest.attackVectors.map(v => v.id) || [];

    // Cognito plugin should have these core vectors
    expect(vectorIds).toContain("mfa-bypass");
    expect(vectorIds).toContain("password-spray");
    expect(vectorIds).toContain("token-replay");
    expect(vectorIds).toContain("session-hijack");
  });
});
