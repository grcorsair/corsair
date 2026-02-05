/**
 * MappingLoader — Data-Driven Framework Mapping Resolution
 *
 * Loads CTID (ATT&CK → NIST 800-53) and SCF (800-53 → 175+ frameworks) data,
 * then provides lookup chains: MITRE technique → NIST 800-53 → any framework.
 *
 * NIST 800-53 acts as the "Rosetta Stone" hub. Adding a new framework only
 * requires adding its SCF mapping data — no code changes needed.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { Framework, ControlRef } from "../types";

// ===============================================================================
// TYPES
// ===============================================================================

interface CTIDMapping {
  name: string;
  tactic: string;
  controls: string[];
}

interface CTIDData {
  _meta: { source: string; version: string };
  mappings: Record<string, CTIDMapping>;
}

interface SCFFrameworkRef {
  controlId: string;
  controlName: string;
}

interface SCFControlEntry {
  name: string;
  frameworks: Record<string, SCFFrameworkRef[]>;
}

interface SCFData {
  _meta: { source: string; version: string };
  crosswalk: Record<string, SCFControlEntry>;
}

export interface MappingDatabase {
  /** MITRE technique → NIST 800-53 controls + metadata */
  mitreToNist: Map<string, { name: string; tactic: string; controls: string[] }>;
  /** NIST 800-53 control → all framework mappings */
  nistToFrameworks: Map<string, { name: string; frameworks: Record<string, ControlRef[]> }>;
  /** Pre-computed: MITRE technique → all frameworks (resolved through NIST 800-53 hub) */
  mitreToFrameworks: Map<string, Partial<Record<Framework, ControlRef[]>>>;
  /** List of all frameworks with at least one mapping */
  supportedFrameworks: Framework[];
}

// ===============================================================================
// LOADER
// ===============================================================================

export class MappingLoader {
  private static instance: MappingDatabase | null = null;

  /**
   * Load mapping data from JSON files. Caches on first load.
   * @param dataDir - Directory containing ctid-mappings.json and scf-crosswalk.json
   */
  static async load(dataDir?: string): Promise<MappingDatabase> {
    if (MappingLoader.instance) return MappingLoader.instance;

    const dir = dataDir || join(dirname(new URL(import.meta.url).pathname), ".");

    // Load CTID data (ATT&CK → NIST 800-53)
    const ctidPath = join(dir, "ctid-mappings.json");
    const ctid = MappingLoader.loadJSON<CTIDData>(ctidPath);

    // Load SCF data (NIST 800-53 → other frameworks)
    const scfPath = join(dir, "scf-crosswalk.json");
    const scf = MappingLoader.loadJSON<SCFData>(scfPath);

    // Build lookup maps
    const mitreToNist = new Map<string, { name: string; tactic: string; controls: string[] }>();
    if (ctid?.mappings) {
      for (const [technique, mapping] of Object.entries(ctid.mappings)) {
        mitreToNist.set(technique, mapping);
      }
    }

    const nistToFrameworks = new Map<string, { name: string; frameworks: Record<string, ControlRef[]> }>();
    if (scf?.crosswalk) {
      for (const [control, entry] of Object.entries(scf.crosswalk)) {
        nistToFrameworks.set(control, {
          name: entry.name,
          frameworks: entry.frameworks || {},
        });
      }
    }

    // Pre-compute MITRE → all frameworks (resolve through NIST 800-53)
    const mitreToFrameworks = new Map<string, Partial<Record<Framework, ControlRef[]>>>();
    const frameworkSet = new Set<string>();

    for (const [technique, { controls }] of mitreToNist) {
      const frameworkMap: Partial<Record<Framework, ControlRef[]>> = {};

      // Add NIST 800-53 controls directly
      frameworkMap["NIST-800-53"] = controls.map(c => ({
        controlId: c,
        controlName: nistToFrameworks.get(c)?.name || c,
      }));

      // Resolve each NIST 800-53 control → other frameworks via SCF
      for (const nistControl of controls) {
        const scfEntry = nistToFrameworks.get(nistControl);
        if (!scfEntry?.frameworks) continue;

        for (const [framework, refs] of Object.entries(scfEntry.frameworks)) {
          frameworkSet.add(framework);
          if (!frameworkMap[framework]) {
            frameworkMap[framework] = [];
          }
          // Deduplicate by controlId
          for (const ref of refs) {
            const existing = frameworkMap[framework]!;
            if (!existing.some(e => e.controlId === ref.controlId)) {
              existing.push(ref);
            }
          }
        }
      }

      mitreToFrameworks.set(technique, frameworkMap);
    }

    // Collect all supported frameworks
    frameworkSet.add("NIST-800-53");
    const supportedFrameworks = Array.from(frameworkSet).sort() as Framework[];

    const db: MappingDatabase = {
      mitreToNist,
      nistToFrameworks,
      mitreToFrameworks,
      supportedFrameworks,
    };

    MappingLoader.instance = db;
    return db;
  }

  /**
   * Look up all framework controls for a MITRE technique.
   * Returns empty object if technique not found.
   */
  static lookupMitre(db: MappingDatabase, technique: string): Partial<Record<Framework, ControlRef[]>> {
    return db.mitreToFrameworks.get(technique) || {};
  }

  /**
   * Look up all MITRE techniques that map to a given NIST 800-53 control.
   */
  static lookupNist80053(db: MappingDatabase, controlId: string): string[] {
    const techniques: string[] = [];
    for (const [technique, { controls }] of db.mitreToNist) {
      if (controls.includes(controlId)) {
        techniques.push(technique);
      }
    }
    return techniques;
  }

  /**
   * Get coverage stats: how many MITRE techniques have mappings for each framework.
   */
  static getCoverageStats(db: MappingDatabase): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [, frameworkMap] of db.mitreToFrameworks) {
      for (const framework of Object.keys(frameworkMap)) {
        stats[framework] = (stats[framework] || 0) + 1;
      }
    }
    return stats;
  }

  /**
   * Reset cached instance (for testing).
   */
  static reset(): void {
    MappingLoader.instance = null;
  }

  private static loadJSON<T>(path: string): T | null {
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return null;
    }
  }
}
