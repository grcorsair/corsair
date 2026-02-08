/**
 * CHART Engine - Framework Mapping
 *
 * Maps security findings to compliance frameworks using 3-tier resolution:
 * 1. Plugin manifest mappings (highest priority — plugin knows its own controls)
 * 2. CTID/SCF data-driven mappings (broad coverage via MappingLoader)
 * 3. Legacy hardcoded fallback (safety net)
 *
 * The ChartResult retains legacy mitre/nist/soc2 fields for backwards compat
 * while adding an extensible `frameworks` field for 12+ framework support.
 */

import type {
  AttackVector,
  DriftFinding,
  RaidResult,
  ChartOptions,
  ChartResult,
  ComplianceMapping,
  EvidenceType,
  Framework,
  FrameworkMappingEntry,
  ControlRef,
} from "../types";
import { MappingLoader } from "../data/mapping-loader";
import type { MappingDatabase } from "../data/mapping-loader";

// Framework mappings that can be passed directly to ChartEngine
export interface PluginFrameworkMappings {
  drift?: Record<string, FrameworkMappingEntry>;
  attackVectors?: Record<string, FrameworkMappingEntry>;
}

// ===============================================================================
// FRAMEWORK MAPPING DATA (LEGACY FALLBACK - Tier 3)
// ===============================================================================

const DRIFT_TO_MITRE: Record<string, { technique: string; name: string }> = {
  mfaConfiguration: { technique: "T1556", name: "Modify Authentication Process" },
  "passwordPolicy.minimumLength": { technique: "T1110", name: "Brute Force" },
  "passwordPolicy.requireSymbols": { technique: "T1110.001", name: "Password Guessing" },
  riskConfiguration: { technique: "T1078", name: "Valid Accounts" },
  softwareTokenMfaEnabled: { technique: "T1556.006", name: "Multi-Factor Authentication Interception" },
};

const MITRE_TO_NIST: Record<string, { control: string; function: string }> = {
  T1556: { control: "PR.AC-7", function: "Protect - Access Control" },
  "T1556.006": { control: "PR.AC-7", function: "Protect - Access Control" },
  T1110: { control: "PR.AC-1", function: "Protect - Access Control" },
  "T1110.001": { control: "PR.AC-1", function: "Protect - Access Control" },
  T1078: { control: "PR.AC-4", function: "Protect - Access Control" },
};

const NIST_TO_SOC2: Record<string, { control: string; description: string }> = {
  "PR.AC-7": { control: "CC6.1", description: "Logical access security" },
  "PR.AC-1": { control: "CC6.1", description: "Logical access security" },
  "PR.AC-4": { control: "CC6.2", description: "Registration and authorization" },
  "PR.DS-2": { control: "CC6.6", description: "System boundary protection" },
  "PR.IP-1": { control: "CC6.3", description: "Role-based access control" },
};

const ATTACK_VECTOR_TO_MITRE: Record<string, { technique: string; name: string }> = {
  "mfa-bypass": { technique: "T1556.006", name: "Multi-Factor Authentication Interception" },
  "password-spray": { technique: "T1110.003", name: "Password Spraying" },
  "token-replay": { technique: "T1550.001", name: "Application Access Token" },
  "session-hijack": { technique: "T1563", name: "Remote Service Session Hijacking" },
};

// ===============================================================================
// CHART ENGINE
// ===============================================================================

export class ChartEngine {
  private customMappings?: PluginFrameworkMappings;
  private mappingDb: MappingDatabase | null = null;

  constructor(customMappings?: PluginFrameworkMappings) {
    this.customMappings = customMappings;
  }

  /**
   * Initialize data-driven mappings (CTID + SCF). Call once on startup.
   * Gracefully degrades to legacy fallback if data files are missing.
   */
  async initialize(dataDir?: string): Promise<void> {
    try {
      this.mappingDb = await MappingLoader.load(dataDir);
    } catch {
      // Graceful degradation: use legacy hardcoded mappings
      this.mappingDb = null;
    }
  }

  private getPluginMappings(): PluginFrameworkMappings | undefined {
    return this.customMappings;
  }

  /**
   * Resolve MITRE technique from a drift field using 3-tier priority:
   * 1. Plugin manifest drift mappings
   * 2. Legacy DRIFT_TO_MITRE hardcoded map
   */
  private resolveDriftToMitre(
    field: string,
    driftMappings: Record<string, FrameworkMappingEntry>
  ): { mitreId: string; mitreName: string; mapping: FrameworkMappingEntry | { technique: string; name: string } } | null {
    // Tier 1: Plugin manifest
    const pluginMapping = driftMappings[field];
    if (pluginMapping) {
      return {
        mitreId: pluginMapping.mitre,
        mitreName: pluginMapping.mitreName || pluginMapping.mitre,
        mapping: pluginMapping,
      };
    }

    // Tier 3: Legacy hardcoded
    const legacyMapping = DRIFT_TO_MITRE[field];
    if (legacyMapping) {
      return {
        mitreId: legacyMapping.technique,
        mitreName: legacyMapping.name,
        mapping: legacyMapping,
      };
    }

    return null;
  }

  /**
   * Resolve framework controls for a MITRE technique using 3-tier priority:
   * 1. Plugin manifest controls field
   * 2. CTID/SCF data-driven mappings
   * 3. Legacy hardcoded MITRE→NIST→SOC2
   */
  private resolveFrameworks(
    mitreId: string,
    mapping: FrameworkMappingEntry | { technique: string; name: string },
    requestedFrameworks?: Framework[]
  ): Record<Framework, { controls: { controlId: string; controlName: string; status: string }[] }> {
    const result: Record<string, { controls: { controlId: string; controlName: string; status: string }[] }> = {};

    // Tier 1: Plugin manifest controls field
    if ("controls" in mapping && mapping.controls) {
      for (const [framework, controls] of Object.entries(mapping.controls)) {
        if (requestedFrameworks && !requestedFrameworks.includes(framework as Framework)) continue;
        result[framework] = {
          controls: (controls as ControlRef[]).map(c => ({
            controlId: c.controlId,
            controlName: c.controlName || c.controlId,
            status: "mapped",
          })),
        };
      }
    }

    // Tier 2: CTID/SCF data-driven mappings (fill in gaps)
    if (this.mappingDb) {
      const dataFrameworks = MappingLoader.lookupMitre(this.mappingDb, mitreId);
      for (const [framework, controls] of Object.entries(dataFrameworks)) {
        if (requestedFrameworks && !requestedFrameworks.includes(framework as Framework)) continue;
        if (result[framework]) continue; // Plugin mapping takes precedence
        result[framework] = {
          controls: controls!.map(c => ({
            controlId: c.controlId,
            controlName: c.controlName || c.controlId,
            status: "mapped",
          })),
        };
      }
    }

    return result;
  }

  async chart(findings: DriftFinding[], options: ChartOptions & { providerId?: string; frameworks?: Framework[] } = {}): Promise<ChartResult> {
    const pluginMappings = this.getPluginMappings();
    const driftMappings = pluginMappings?.drift || {};
    const requestedFrameworks = options.frameworks;

    const nistControls: Set<string> = new Set();
    const soc2Controls: Set<string> = new Set();
    let primaryMitre: { technique: string; name: string; tactic: string; description: string } | null = null;
    let primaryNist: { function: string; category: string; controls: string[] } | null = null;
    let primarySoc2: { principle: string; criteria: string[]; description: string } | null = null;
    const allFrameworks: Record<string, { controls: { controlId: string; controlName: string; status: string }[] }> = {};

    for (const finding of findings) {
      if (!finding.drift) continue;

      const resolved = this.resolveDriftToMitre(finding.field, driftMappings);
      if (!resolved) continue;

      const { mitreId, mitreName, mapping } = resolved;

      if (!primaryMitre) {
        primaryMitre = {
          technique: mitreId,
          name: mitreName,
          tactic: "description" in mapping && (mapping as FrameworkMappingEntry).mitreTactic
            ? (mapping as FrameworkMappingEntry).mitreTactic!
            : "Credential Access",
          description: "description" in mapping && mapping.description
            ? mapping.description
            : `${mitreName} detected via ${finding.field} misconfiguration`,
        };
      }

      // Resolve legacy NIST-CSF and SOC2 fields (backwards compat)
      const nistControl = "nist" in mapping ? (mapping as FrameworkMappingEntry).nist : MITRE_TO_NIST[mitreId]?.control;
      const nistFunction = "nistFunction" in mapping ? (mapping as FrameworkMappingEntry).nistFunction : MITRE_TO_NIST[mitreId]?.function;

      if (nistControl) {
        nistControls.add(nistControl);
        if (!primaryNist) {
          primaryNist = {
            function: nistFunction || "Protect",
            category: "Access Control",
            controls: [nistControl],
          };
        } else {
          primaryNist.controls.push(nistControl);
        }

        const soc2Control = "soc2" in mapping ? (mapping as FrameworkMappingEntry).soc2 : NIST_TO_SOC2[nistControl]?.control;
        const soc2Description = "soc2Description" in mapping ? (mapping as FrameworkMappingEntry).soc2Description : NIST_TO_SOC2[nistControl]?.description;

        if (soc2Control) {
          soc2Controls.add(soc2Control);
          if (!primarySoc2) {
            primarySoc2 = {
              principle: "Common Criteria",
              criteria: [soc2Control],
              description: soc2Description || "Control mapping",
            };
          } else {
            if (!primarySoc2.criteria.includes(soc2Control)) {
              primarySoc2.criteria.push(soc2Control);
            }
          }
        }
      }

      // Resolve extensible frameworks (Tier 1 + Tier 2)
      const frameworkMappings = this.resolveFrameworks(mitreId, mapping, requestedFrameworks);
      for (const [fw, data] of Object.entries(frameworkMappings)) {
        if (!allFrameworks[fw]) {
          allFrameworks[fw] = { controls: [] };
        }
        for (const ctrl of data.controls) {
          if (!allFrameworks[fw].controls.some(c => c.controlId === ctrl.controlId)) {
            allFrameworks[fw].controls.push(ctrl);
          }
        }
      }
    }

    const result: ChartResult = {
      mitre: primaryMitre || {
        technique: "N/A",
        name: "No drift detected",
        tactic: "N/A",
        description: "No security misconfigurations found",
      },
      nist: primaryNist || {
        function: "N/A",
        category: "N/A",
        controls: [],
      },
      soc2: primarySoc2 || {
        principle: "N/A",
        criteria: [],
        description: "No applicable controls",
      },
    };

    // Only add frameworks field if we have data
    if (Object.keys(allFrameworks).length > 0) {
      result.frameworks = allFrameworks as Record<Framework, { controls: { controlId: string; controlName: string; status: string }[] }>;
    }

    return result;
  }

  async chartRaid(raidResult: RaidResult): Promise<ComplianceMapping[]> {
    const pluginMappings = this.getPluginMappings();
    const attackVectorMappings = pluginMappings?.attackVectors || {};

    const mapping = attackVectorMappings[raidResult.vector] || ATTACK_VECTOR_TO_MITRE[raidResult.vector];
    if (!mapping) return [];

    const mitreId = "mitre" in mapping ? mapping.mitre : (mapping as { technique: string }).technique;
    const mitreName = "mitreName" in mapping ? (mapping.mitreName || mapping.mitre) : (mapping as { name: string }).name;
    const nistControl = "nist" in mapping ? mapping.nist : undefined;
    const nistFunction = "nistFunction" in mapping ? mapping.nistFunction : undefined;
    const soc2Control = "soc2" in mapping ? mapping.soc2 : undefined;
    const soc2Description = "soc2Description" in mapping ? mapping.soc2Description : undefined;

    const mappings: ComplianceMapping[] = [];
    const evidenceType: EvidenceType = raidResult.success ? "negative" : "positive";

    const chain: string[] = [];
    chain.push(`MITRE:${mitreId}`);

    if (nistControl) {
      chain.push(`NIST:${nistControl}`);
    }

    if (soc2Control) {
      chain.push(`SOC2:${soc2Control}`);
    }

    mappings.push({
      id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
      findingId: raidResult.raidId,
      framework: "MITRE",
      technique: mitreId,
      description: mitreName,
      mappingChain: chain,
      evidenceType,
      evidenceRef: raidResult.raidId,
    });

    if (nistControl) {
      mappings.push({
        id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
        findingId: raidResult.raidId,
        framework: "NIST-CSF",
        control: nistControl,
        description: nistFunction || "Protect",
        mappingChain: chain,
        evidenceType,
        evidenceRef: raidResult.raidId,
      });
    }

    if (soc2Control) {
      mappings.push({
        id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
        findingId: raidResult.raidId,
        framework: "SOC2",
        control: soc2Control,
        description: soc2Description || "Control mapping",
        mappingChain: chain,
        evidenceType,
        evidenceRef: raidResult.raidId,
      });
    }

    // Add mappings for additional frameworks from CTID/SCF data
    if (this.mappingDb) {
      const dataFrameworks = MappingLoader.lookupMitre(this.mappingDb, mitreId);
      for (const [framework, controls] of Object.entries(dataFrameworks)) {
        if (framework === "NIST-CSF" || framework === "SOC2" || framework === "NIST-800-53") continue;
        for (const ctrl of controls!) {
          chain.push(`${framework}:${ctrl.controlId}`);
        }
        mappings.push({
          id: `MAP-${crypto.randomUUID().slice(0, 8)}`,
          findingId: raidResult.raidId,
          framework: framework as Framework,
          control: controls!.map(c => c.controlId).join(", "),
          description: controls!.map(c => c.controlName || c.controlId).join(", "),
          mappingChain: [...chain],
          evidenceType,
          evidenceRef: raidResult.raidId,
        });
      }
    }

    return mappings;
  }
}

// Re-export constants for any direct consumers
export {
  DRIFT_TO_MITRE,
  MITRE_TO_NIST,
  NIST_TO_SOC2,
  ATTACK_VECTOR_TO_MITRE,
};
