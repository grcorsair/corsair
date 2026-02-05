/**
 * PLUGIN Engine - Plugin Discovery & Registry
 *
 * Extracted from corsair-mvp.ts.
 * Discovers, validates, and manages Corsair plugins via manifest scanning.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type {
  PluginManifest,
  RegisteredPlugin,
  InitializeResult,
} from "../types";

export class PluginEngine {
  private plugins: Map<string, RegisteredPlugin> = new Map();

  async discover(pluginDir: string): Promise<InitializeResult> {
    const discovered: string[] = [];
    const invalid: string[] = [];

    if (!existsSync(pluginDir)) {
      return {
        discoveredCount: 0,
        plugins: [],
        invalidManifests: [],
      };
    }

    try {
      const entries = readdirSync(pluginDir);

      for (const entry of entries) {
        const entryPath = join(pluginDir, entry);
        const stat = statSync(entryPath);

        if (stat.isDirectory()) {
          const subEntries = readdirSync(entryPath);
          for (const subEntry of subEntries) {
            if (subEntry.endsWith(".plugin.json")) {
              const manifestPath = join(entryPath, subEntry);
              const result = await this.loadManifest(manifestPath);

              if (result.valid && result.manifest) {
                if (!this.plugins.has(result.manifest.providerId)) {
                  this.register(result.manifest);
                  discovered.push(result.manifest.providerId);
                }
              } else {
                invalid.push(manifestPath);
              }
            }
          }
        }
      }
    } catch (error) {
      return {
        discoveredCount: 0,
        plugins: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    return {
      discoveredCount: discovered.length,
      plugins: discovered,
      invalidManifests: invalid.length > 0 ? invalid : undefined,
    };
  }

  private async loadManifest(
    manifestPath: string
  ): Promise<{ valid: boolean; manifest?: PluginManifest; error?: string }> {
    try {
      const content = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      if (!manifest.providerId || typeof manifest.providerId !== "string") {
        return { valid: false, error: "Missing or invalid providerId" };
      }

      if (!manifest.providerName || typeof manifest.providerName !== "string") {
        return { valid: false, error: "Missing or invalid providerName" };
      }

      if (!manifest.version || typeof manifest.version !== "string") {
        return { valid: false, error: "Missing or invalid version" };
      }

      if (!Array.isArray(manifest.attackVectors)) {
        return { valid: false, error: "Missing or invalid attackVectors" };
      }

      for (const vector of manifest.attackVectors) {
        if (!vector.id || !vector.name || !vector.severity) {
          return { valid: false, error: "Invalid attack vector structure" };
        }

        if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(vector.severity)) {
          return { valid: false, error: `Invalid severity: ${vector.severity}` };
        }
      }

      return { valid: true, manifest: manifest as PluginManifest };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Parse error",
      };
    }
  }

  register(manifest: PluginManifest): void {
    const plugin: RegisteredPlugin = {
      manifest,
      loadedAt: new Date().toISOString(),
    };

    this.plugins.set(manifest.providerId, plugin);
    console.log(`  Registered plugin: ${manifest.providerId} (${manifest.providerName} v${manifest.version})`);
  }

  get(providerId: string): RegisteredPlugin | undefined {
    return this.plugins.get(providerId);
  }

  getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  has(providerId: string): boolean {
    return this.plugins.has(providerId);
  }

  getManifests(): PluginManifest[] {
    return this.getAll().map((p) => p.manifest);
  }
}

// Backwards-compat alias
export { PluginEngine as PluginRegistry };
