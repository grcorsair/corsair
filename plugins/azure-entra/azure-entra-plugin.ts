/**
 * Azure Entra ID Plugin for Corsair (Skeleton)
 *
 * Demonstrates extensibility of the Corsair plugin system.
 * This is a fixture-only plugin — no live Azure API calls.
 *
 * To implement live API support, add:
 * - @azure/identity + @azure/arm-authorization dependencies
 * - Graph API calls for conditional access, MFA status, etc.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN IDENTITY
// ═══════════════════════════════════════════════════════════════════════════════

export const AZURE_ENTRA_PROVIDER_ID = "azure-entra";

// ═══════════════════════════════════════════════════════════════════════════════
// AZURE ENTRA TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConditionalAccessPolicy {
  id: string;
  displayName: string;
  state: "enabled" | "disabled" | "enabledForReportingButNotEnforced";
  conditions: {
    locations: "all" | "trusted" | "untrusted" | string[];
    platforms: string[];
  };
  grantControls: {
    requireMfa: boolean;
    requireCompliantDevice: boolean;
  };
}

export interface EntraSnapshot {
  tenantId: string;
  tenantName: string;
  conditionalAccessPolicies: ConditionalAccessPolicy[];
  passwordHashSync: {
    enabled: boolean;
    smartLockoutEnabled: boolean;
    lockoutThreshold: number;
  };
  mfaConfiguration: {
    perUserMfaState: "enabled" | "disabled" | "enforced";
    numberMatchingEnabled: boolean;
    fraudAlertEnabled: boolean;
  };
  observedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

export function isEntraSnapshot(obj: unknown): obj is EntraSnapshot {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const snapshot = obj as Record<string, unknown>;

  return (
    typeof snapshot.tenantId === "string" &&
    typeof snapshot.tenantName === "string" &&
    Array.isArray(snapshot.conditionalAccessPolicies) &&
    typeof snapshot.passwordHashSync === "object" &&
    typeof snapshot.mfaConfiguration === "object" &&
    typeof snapshot.observedAt === "string"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateEntraSnapshotOptions {
  tenantId: string;
  tenantName: string;
  conditionalAccessPolicies?: ConditionalAccessPolicy[];
  passwordHashSync?: Partial<EntraSnapshot["passwordHashSync"]>;
  mfaConfiguration?: Partial<EntraSnapshot["mfaConfiguration"]>;
}

export function createEntraSnapshot(options: CreateEntraSnapshotOptions): EntraSnapshot {
  return {
    tenantId: options.tenantId,
    tenantName: options.tenantName,
    conditionalAccessPolicies: options.conditionalAccessPolicies || [],
    passwordHashSync: {
      enabled: options.passwordHashSync?.enabled ?? true,
      smartLockoutEnabled: options.passwordHashSync?.smartLockoutEnabled ?? false,
      lockoutThreshold: options.passwordHashSync?.lockoutThreshold ?? 10,
    },
    mfaConfiguration: {
      perUserMfaState: options.mfaConfiguration?.perUserMfaState ?? "disabled",
      numberMatchingEnabled: options.mfaConfiguration?.numberMatchingEnabled ?? false,
      fraudAlertEnabled: options.mfaConfiguration?.fraudAlertEnabled ?? false,
    },
    observedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURE SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Compliant Azure Entra tenant */
export const compliantEntraSnapshot: EntraSnapshot = createEntraSnapshot({
  tenantId: "tenant-001-compliant",
  tenantName: "Compliant Corp",
  conditionalAccessPolicies: [
    {
      id: "policy-001",
      displayName: "Require MFA for all users",
      state: "enabled",
      conditions: { locations: "all", platforms: ["all"] },
      grantControls: { requireMfa: true, requireCompliantDevice: false },
    },
    {
      id: "policy-002",
      displayName: "Block untrusted locations",
      state: "enabled",
      conditions: { locations: "untrusted", platforms: ["all"] },
      grantControls: { requireMfa: true, requireCompliantDevice: true },
    },
  ],
  passwordHashSync: {
    enabled: true,
    smartLockoutEnabled: true,
    lockoutThreshold: 5,
  },
  mfaConfiguration: {
    perUserMfaState: "enforced",
    numberMatchingEnabled: true,
    fraudAlertEnabled: true,
  },
});

/** Non-compliant Azure Entra tenant */
export const nonCompliantEntraSnapshot: EntraSnapshot = createEntraSnapshot({
  tenantId: "tenant-002-noncompliant",
  tenantName: "Legacy Corp",
  conditionalAccessPolicies: [],
  passwordHashSync: {
    enabled: true,
    smartLockoutEnabled: false,
    lockoutThreshold: 50,
  },
  mfaConfiguration: {
    perUserMfaState: "disabled",
    numberMatchingEnabled: false,
    fraudAlertEnabled: false,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const pluginMetadata = {
  id: AZURE_ENTRA_PROVIDER_ID,
  name: "Azure Entra ID",
  version: "0.1.0",
  description: "Corsair plugin for Azure Entra ID (skeleton)",
  supportedVectors: [
    "conditional-access-bypass",
    "password-sync-exploit",
    "mfa-fatigue",
  ] as const,
};
