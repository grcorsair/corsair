/**
 * CHART Engine - Framework Mapping
 *
 * Extracted from corsair-mvp.ts.
 * Maps security findings to compliance frameworks (MITRE -> NIST -> SOC2).
 */

import type {
  AttackVector,
  DriftFinding,
  RaidResult,
  ChartOptions,
  ChartResult,
  ComplianceMapping,
  EvidenceType,
  RegisteredPlugin,
  PluginFrameworkMappings,
  FrameworkMappingEntry,
} from "../types";

// ===============================================================================
// FRAMEWORK MAPPING DATA (LEGACY FALLBACK)
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
  private getPlugin: (providerId: string) => RegisteredPlugin | undefined;

  constructor(getPlugin: (providerId: string) => RegisteredPlugin | undefined) {
    this.getPlugin = getPlugin;
  }

  private getPluginMappings(providerId: string = "aws-cognito"): PluginFrameworkMappings | undefined {
    const plugin = this.getPlugin(providerId);
    return plugin?.manifest.frameworkMappings;
  }

  async chart(findings: DriftFinding[], options: ChartOptions & { providerId?: string } = {}): Promise<ChartResult> {
    const providerId = options.providerId || "aws-cognito";
    const pluginMappings = this.getPluginMappings(providerId);
    const driftMappings = pluginMappings?.drift || {};

    const mitreFindings: Set<string> = new Set();
    const nistControls: Set<string> = new Set();
    const soc2Controls: Set<string> = new Set();
    let primaryMitre: { technique: string; name: string; tactic: string; description: string } | null = null;
    let primaryNist: { function: string; category: string; controls: string[] } | null = null;
    let primarySoc2: { principle: string; criteria: string[]; description: string } | null = null;

    for (const finding of findings) {
      if (!finding.drift) continue;

      const mapping = driftMappings[finding.field] || DRIFT_TO_MITRE[finding.field];
      if (!mapping) continue;

      const mitreId = "mitre" in mapping ? mapping.mitre : mapping.technique;
      const mitreName = "mitreName" in mapping ? (mapping.mitreName || mapping.mitre) : mapping.name;

      mitreFindings.add(mitreId);

      if (!primaryMitre) {
        primaryMitre = {
          technique: mitreId,
          name: mitreName,
          tactic: "Credential Access",
          description: "description" in mapping && mapping.description
            ? mapping.description
            : `${mitreName} detected via ${finding.field} misconfiguration`
        };
      }

      const nistControl = "nist" in mapping ? mapping.nist : MITRE_TO_NIST[mitreId]?.control;
      const nistFunction = "nistFunction" in mapping ? mapping.nistFunction : MITRE_TO_NIST[mitreId]?.function;

      if (nistControl) {
        nistControls.add(nistControl);

        if (!primaryNist) {
          primaryNist = {
            function: nistFunction || "Protect",
            category: "Access Control",
            controls: [nistControl]
          };
        } else {
          primaryNist.controls.push(nistControl);
        }

        const soc2Control = "soc2" in mapping ? mapping.soc2 : NIST_TO_SOC2[nistControl]?.control;
        const soc2Description = "soc2Description" in mapping ? mapping.soc2Description : NIST_TO_SOC2[nistControl]?.description;

        if (soc2Control) {
          soc2Controls.add(soc2Control);

          if (!primarySoc2) {
            primarySoc2 = {
              principle: "Common Criteria",
              criteria: [soc2Control],
              description: soc2Description || "Control mapping"
            };
          } else {
            if (!primarySoc2.criteria.includes(soc2Control)) {
              primarySoc2.criteria.push(soc2Control);
            }
          }
        }
      }
    }

    return {
      mitre: primaryMitre || {
        technique: "N/A",
        name: "No drift detected",
        tactic: "N/A",
        description: "No security misconfigurations found"
      },
      nist: primaryNist || {
        function: "N/A",
        category: "N/A",
        controls: []
      },
      soc2: primarySoc2 || {
        principle: "N/A",
        criteria: [],
        description: "No applicable controls"
      }
    };
  }

  async chartRaid(raidResult: RaidResult, providerId: string = "aws-cognito"): Promise<ComplianceMapping[]> {
    const pluginMappings = this.getPluginMappings(providerId);
    const attackVectorMappings = pluginMappings?.attackVectors || {};

    const mapping = attackVectorMappings[raidResult.vector] || ATTACK_VECTOR_TO_MITRE[raidResult.vector];

    const mitreId = "mitre" in mapping ? mapping.mitre : mapping.technique;
    const mitreName = "mitreName" in mapping ? (mapping.mitreName || mapping.mitre) : mapping.name;
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
