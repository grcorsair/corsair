# Corsair Plugin Architecture

**Last Updated:** 2026-02-01

Corsair uses a plugin-first architecture where provider-specific logic lives in plugins, keeping the core generic and extensible.

## Overview

```
corsair-mvp/
  src/
    corsair-mvp.ts      # Core primitives (generic)
    types.ts            # Type definitions
    evidence.ts         # Evidence engine
    compaction.ts       # Compaction engine
  plugins/
    aws-cognito/        # AWS Cognito provider plugin
      aws-cognito-plugin.ts     # Plugin implementation
      aws-cognito.plugin.json   # Plugin manifest (auto-discovered)
      index.ts                  # Module exports
    # Future: azure-ad/, okta/, auth0/
```

## Plugin Discovery

Plugins are auto-discovered when you call `corsair.initialize()`:

```typescript
const corsair = new Corsair();
await corsair.initialize();  // Scans plugins/ for *.plugin.json

// Check what was discovered
console.log(corsair.getPlugins().map(p => p.manifest.providerId));
// Output: ["aws-cognito"]
```

## Plugin Manifest Schema

Every plugin must provide a `*.plugin.json` manifest with this structure:

```json
{
  "providerId": "aws-cognito",
  "providerName": "AWS Cognito",
  "version": "1.0.0",
  "description": "Plugin description",
  "attackVectors": [
    {
      "id": "mfa-bypass",
      "name": "MFA Bypass",
      "description": "Tests MFA bypass scenarios",
      "severity": "CRITICAL",
      "mitreMapping": ["T1556.006"],
      "preconditions": ["MFA is OFF or OPTIONAL"],
      "remediations": ["Enable enforced MFA"]
    }
  ],
  "capabilities": {
    "recon": true,
    "raid": true,
    "escape": true,
    "realTimeAPI": false
  },
  "requiredPermissions": [
    "cognito-idp:DescribeUserPool"
  ],
  "frameworkMappings": {
    "drift": { ... },
    "attackVectors": { ... }
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `providerId` | string | Unique identifier (e.g., "aws-cognito") |
| `providerName` | string | Human-readable name |
| `version` | string | Semantic version |
| `attackVectors` | array | List of attack vector definitions |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Plugin description |
| `capabilities` | object | Feature flags |
| `requiredPermissions` | array | Required cloud permissions |
| `documentation` | object | Documentation links |
| `frameworkMappings` | object | Compliance framework mappings |

## Framework Mappings

Plugins can provide their own compliance framework mappings, enabling extensible MITRE -> NIST -> SOC2 chains.

### Structure

```json
{
  "frameworkMappings": {
    "drift": {
      "mfaConfiguration": {
        "mitre": "T1556",
        "mitreName": "Modify Authentication Process",
        "nist": "PR.AC-7",
        "nistFunction": "Protect - Access Control",
        "soc2": "CC6.1",
        "soc2Description": "Logical access security",
        "description": "MFA configuration drift"
      }
    },
    "attackVectors": {
      "mfa-bypass": {
        "mitre": "T1556.006",
        "mitreName": "Multi-Factor Authentication Interception",
        "nist": "PR.AC-7",
        "nistFunction": "Protect - Access Control",
        "soc2": "CC6.1",
        "soc2Description": "Logical access security",
        "description": "MFA bypass attack"
      }
    }
  }
}
```

### Mapping Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mitre` | string | Yes | MITRE ATT&CK technique ID |
| `mitreName` | string | No | Technique name |
| `nist` | string | No | NIST CSF control ID |
| `nistFunction` | string | No | NIST function description |
| `soc2` | string | No | SOC2 control ID |
| `soc2Description` | string | No | SOC2 control description |
| `description` | string | No | Human-readable description |

### Usage in Code

When you call `chart()` or `chartRaid()`, Corsair uses plugin-provided mappings:

```typescript
const corsair = new Corsair();
await corsair.initialize();

// MARK with drift detection
const markResult = await corsair.mark(snapshot, [
  { field: "mfaConfiguration", operator: "eq", value: "ON" }
]);

// CHART uses plugin framework mappings
const chartResult = await corsair.chart(markResult.findings);
console.log(chartResult.mitre.technique);  // "T1556" (from plugin manifest)
console.log(chartResult.nist.controls);     // ["PR.AC-7"] (from plugin manifest)

// CHART raid result
const raidResult = await corsair.raid(snapshot, { vector: "mfa-bypass", intensity: 5, dryRun: true });
const mappings = await corsair.chartRaid(raidResult);
// Returns ComplianceMapping[] with MITRE, NIST, SOC2 entries from plugin
```

## Creating a New Plugin

1. **Create directory**: `plugins/my-provider/`

2. **Create manifest**: `my-provider.plugin.json`
   - Include required fields: providerId, providerName, version, attackVectors
   - Add frameworkMappings for compliance mapping

3. **Implement plugin** (optional TypeScript):
   - Implement `ProviderPlugin<T>` interface
   - Export types and factory functions

4. **Test discovery**:
   ```typescript
   const corsair = new Corsair();
   await corsair.initialize();
   console.log(corsair.hasPlugin("my-provider"));  // true
   ```

## Example: AWS Cognito Plugin

See `plugins/aws-cognito/` for a complete reference implementation:

- **aws-cognito.plugin.json**: Full manifest with all attack vectors and framework mappings
- **aws-cognito-plugin.ts**: Type definitions and helper functions
- **index.ts**: Module exports

## Plugin API

### Corsair Methods

| Method | Description |
|--------|-------------|
| `initialize(pluginDir?)` | Discover and register plugins |
| `getPlugin(providerId)` | Get a specific plugin |
| `getPlugins()` | Get all registered plugins |
| `hasPlugin(providerId)` | Check if plugin exists |
| `registerPlugin(manifest)` | Manually register a plugin |

### Plugin Manifest TypeScript Types

```typescript
interface PluginManifest {
  providerId: string;
  providerName: string;
  version: string;
  description?: string;
  attackVectors: PluginAttackVector[];
  capabilities?: { ... };
  requiredPermissions?: string[];
  documentation?: { ... };
  frameworkMappings?: PluginFrameworkMappings;
}

interface PluginFrameworkMappings {
  drift?: Record<string, FrameworkMappingEntry>;
  attackVectors?: Record<string, FrameworkMappingEntry>;
}

interface FrameworkMappingEntry {
  mitre: string;
  mitreName?: string;
  nist?: string;
  nistFunction?: string;
  soc2?: string;
  soc2Description?: string;
  description?: string;
}
```
