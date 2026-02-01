/**
 * Plugin Registry
 *
 * Discovers and validates provider plugins via manifest-based scanning.
 * Plugins are declared via *.plugin.json files.
 *
 * Key Operations:
 * - discover: Scan directory for *.plugin.json manifests
 * - validate: Ensure manifest schema compliance
 * - query: Find available attack vectors by provider or globally
 */

import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import type {
  PluginManifest,
  AttackVectorDeclaration
} from "../types/provider-plugin";

export class PluginRegistry {
  private manifests: Map<string, PluginManifest> = new Map();

  /**
   * Discover plugins in directory
   *
   * Scans for *.plugin.json files, validates them, and registers
   * valid manifests. Invalid manifests are skipped silently.
   *
   * @param directory - Path to scan for plugin manifests
   */
  async discover(directory: string): Promise<void> {
    // Handle non-existent directory gracefully
    if (!existsSync(directory)) {
      return;
    }

    // Check if it's actually a directory
    const stat = statSync(directory);
    if (!stat.isDirectory()) {
      return;
    }

    const files = readdirSync(directory);

    for (const file of files) {
      // Only process *.plugin.json files
      if (!file.endsWith(".plugin.json")) {
        continue;
      }

      const manifestPath = join(directory, file);

      try {
        // Read and parse manifest
        const content = readFileSync(manifestPath, "utf-8");
        const manifest = JSON.parse(content);

        // Validate manifest schema
        if (this.isValidManifest(manifest)) {
          // Register by provider ID
          this.manifests.set(manifest.providerId, manifest);
        }
      } catch (error) {
        // Skip malformed JSON or invalid manifests silently
        // In production, you'd log these errors
        continue;
      }
    }
  }

  /**
   * Validate manifest schema
   *
   * Checks that manifest has all required fields with correct types.
   * This ensures plugins conform to the contract.
   *
   * @param manifest - Parsed JSON object to validate
   * @returns true if valid, false otherwise
   */
  private isValidManifest(manifest: any): manifest is PluginManifest {
    // Check required top-level fields
    if (
      typeof manifest.providerId !== "string" ||
      typeof manifest.version !== "string" ||
      typeof manifest.entryPoint !== "string" ||
      !Array.isArray(manifest.attackVectors)
    ) {
      return false;
    }

    // Validate each attack vector declaration
    for (const vector of manifest.attackVectors) {
      if (!this.isValidAttackVector(vector)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate attack vector declaration
   *
   * Ensures attack vector has all required fields for framework mapping
   * and intensity calibration.
   *
   * @param vector - Attack vector object to validate
   * @returns true if valid, false otherwise
   */
  private isValidAttackVector(vector: any): vector is AttackVectorDeclaration {
    return (
      typeof vector.vector === "string" &&
      typeof vector.description === "string" &&
      typeof vector.mitreMapping === "string" &&
      Array.isArray(vector.requiredPermissions) &&
      typeof vector.intensity === "object" &&
      typeof vector.intensity.min === "number" &&
      typeof vector.intensity.max === "number" &&
      typeof vector.intensity.default === "number"
    );
  }

  /**
   * Get all registered manifests
   *
   * @returns Array of all valid plugin manifests
   */
  getManifests(): PluginManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Get manifest by provider ID
   *
   * @param providerId - Provider identifier
   * @returns Manifest if found, null otherwise
   */
  getManifest(providerId: string): PluginManifest | null {
    return this.manifests.get(providerId) || null;
  }

  /**
   * Get all available attack vectors across all providers
   *
   * Aggregates attack vectors from all registered plugins.
   * Useful for discovering what attacks are available.
   *
   * @returns Array of all attack vector declarations
   */
  getAllAttackVectors(): AttackVectorDeclaration[] {
    const vectors: AttackVectorDeclaration[] = [];

    for (const manifest of this.manifests.values()) {
      vectors.push(...manifest.attackVectors);
    }

    return vectors;
  }

  /**
   * Get attack vectors for specific provider
   *
   * Returns only the vectors supported by the given provider.
   * Useful for provider-specific raid planning.
   *
   * @param providerId - Provider identifier
   * @returns Array of attack vectors for that provider
   */
  getAttackVectorsByProvider(providerId: string): AttackVectorDeclaration[] {
    const manifest = this.manifests.get(providerId);
    return manifest ? manifest.attackVectors : [];
  }

  /**
   * Check if provider is registered
   *
   * @param providerId - Provider identifier
   * @returns true if provider has valid manifest
   */
  hasProvider(providerId: string): boolean {
    return this.manifests.has(providerId);
  }

  /**
   * Get count of registered providers
   *
   * @returns Number of valid plugins
   */
  getProviderCount(): number {
    return this.manifests.size;
  }

  /**
   * Clear all registered manifests
   *
   * Useful for testing or re-discovery scenarios.
   */
  clear(): void {
    this.manifests.clear();
  }
}
