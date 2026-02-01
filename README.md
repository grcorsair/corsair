# CORSAIR

```
   ██████╗ ██████╗ ██████╗ ███████╗ █████╗ ██╗██████╗
  ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██║██╔══██╗
  ██║     ██║   ██║██████╔╝███████╗███████║██║██████╔╝
  ██║     ██║   ██║██╔══██╗╚════██║██╔══██║██║██╔══██╗
  ╚██████╗╚██████╔╝██║  ██║███████║██║  ██║██║██║  ██║
   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
```

**Chaos Operations for Resilience, Security Assessment & Incident Response**

> Attack first. Discover reality. Evidence emerges.

## What is CORSAIR?

CORSAIR is an offensive chaos engineering tool for authentication systems. It discovers the *actual* state of your security controls by attacking them—not by reading documentation.

Compliance evidence is generated as a **byproduct** of attacks, not as a goal.

## The Exception Drift Attack Pattern

Traditional security testing asks: "Does MFA work?"

Exception Drift asks: "What happens when MFA encounters temporal anomalies, geographic impossibilities, behavioral deviations, or protocol downgrades?"

We inject controlled chaos into authentication flows to discover:
- **Temporal Drift**: Token replay windows, clock skew tolerance
- **Geographic Drift**: Impossible travel detection, geofencing weaknesses
- **Behavioral Drift**: Anomaly detection gaps, step-up auth failures
- **Protocol Drift**: Fallback vulnerabilities, backup code abuse

## Quick Start

```bash
# Clone and enter
cd corsair-mvp

# Launch your first attack (no framework selection required)
bun run corsair strike mfa

# That's it. Evidence is generated automatically.
```

## The First Command

When you run `corsair strike mfa`, you're not configuring a compliance framework. You're launching an attack.

```bash
$ bun run corsair strike mfa

   ██████╗ ██████╗ ██████╗ ███████╗ █████╗ ██╗██████╗
  ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██║██╔══██╗
  ...

[TARGET] mfa
[VECTOR] Exception Drift (temporal)
[INTENSITY] 5/10

[DONE] Initializing attack vectors...
[DONE] Mapping authentication surface...

>>> INJECTING EXCEPTION DRIFT
────────────────────────────────────────────────────────────

>>> ATTACK COMPLETE
────────────────────────────────────────────────────────────

FINDINGS:
   CRITICAL  MFA token replay possible within 30s window
     └─ Exception: Time-based OTP accepts codes from previous period
   WARNING  Excessive clock skew tolerance (>5 minutes)
     └─ Exception: Authentication accepts tokens from future periods

────────────────────────────────────────────────────────────
>>> EVIDENCE GENERATED (background)

Mapped to controls:
  + SOC2 CC6.1: Logical access security
  + SOC2 CC6.6: System boundary protection
  + ISO27001 A.9.4.2: Secure log-on procedures
  + NIST-CSF PR.AC-7: Authentication mechanisms

Evidence saved: ./corsair-evidence-1706731200000.json
Report saved: ./corsair-evidence-1706731200000.md
```

## API (Plugin-First)

CORSAIR uses a plugin-first architecture. Provider-specific logic lives in plugins, keeping the core generic.

### Primary API (Recommended)

```typescript
import { Corsair } from "./src/corsair-mvp";

const corsair = new Corsair();

// Auto-discover plugins from plugins/ directory
await corsair.initialize();  // Discovers aws-cognito, future plugins...

// Or: await corsair.initialize("./custom-plugins");

// Access discovered plugins
const cognitoPlugin = corsair.getPlugin("aws-cognito");
console.log(`Loaded: ${cognitoPlugin?.manifest.providerName} v${cognitoPlugin?.manifest.version}`);

// List all attack vectors from plugin manifest
for (const vector of cognitoPlugin?.manifest.attackVectors || []) {
  console.log(`  - ${vector.id}: ${vector.name} (${vector.severity})`);
}

// Recon via plugin (provider-agnostic)
const reconResult = await corsair.reconWithPlugin("aws-cognito", "us-west-2_ABC123");

// Raid via plugin (attack vectors defined by plugin)
const raidResult = await corsair.raidWithPlugin(
  "aws-cognito",
  reconResult.snapshot,
  "mfa-bypass",
  5  // intensity
);

// Or raid with approval gate for production safety
const approvalGate = {
  requiredSeverity: "CRITICAL",
  approvers: ["security-lead@example.com"],
  timeoutMs: 30000,
  channel: "webhook"
};

const secureRaidResult = await corsair.raid(snapshot, {
  vector: "mfa-bypass",
  intensity: 9,
  dryRun: true,
  approvalGate,
  requestApproval: async (req) => ({
    approved: true,
    approver: "security-lead@example.com",
    timestamp: new Date().toISOString()
  })
});

// Plunder (evidence extraction - universal)
const evidence = await corsair.plunder(raidResult, "./evidence.jsonl");

// Chart (framework mapping - universal)
const mapping = await corsair.chartRaid(raidResult);
```

### Event Subscriptions (OpenClaw Pattern 2)

CORSAIR supports pub/sub event subscriptions for real-time monitoring:

```typescript
import { Corsair, type CorsairEvent } from "./src/corsair-mvp";

const corsair = new Corsair();

// Subscribe to raid completion events
corsair.on("raid:complete", (event: CorsairEvent) => {
  console.log(`Raid: ${event.vector} on ${event.targetId}`);
  console.log(`Success: ${event.success}, Severity: ${event.severity}`);
  console.log(`Findings: ${event.findings?.join(", ")}`);
});

// Subscribe to drift detection events
corsair.on("drift:detected", (event: CorsairEvent) => {
  console.log(`Drift detected on ${event.targetId}`);
  console.log(`Severity: ${event.severity}`);
  console.log(`Drifts: ${event.findings?.join(", ")}`);
});

// Create event aggregator for summary statistics
const aggregator = corsair.createEventAggregator();

// Execute operations (events fire automatically)
await corsair.raid(snapshot, { vector: "mfa-bypass", intensity: 5, dryRun: true });
await corsair.mark(snapshot, [{ field: "mfaConfiguration", operator: "eq", value: "ON" }]);

// Get aggregated summary
const summary = aggregator.getSummary();
console.log(`Total events: ${summary.totalEvents}`);
console.log(`By type: ${JSON.stringify(summary.byType)}`);
console.log(`By severity: ${JSON.stringify(summary.bySeverity)}`);

// Query historical events with filters
const criticalEvents = await corsair.queryEvents({
  severity: "CRITICAL",
  timeRange: {
    start: new Date(Date.now() - 3600000).toISOString(),
    end: new Date().toISOString()
  }
});
```

## Commands

| Command | Description |
|---------|-------------|
| `corsair strike <target>` | Launch exception drift attack |
| `corsair recon <target>` | Reconnaissance on target (uses plugin internally) |
| `corsair evidence` | Generate compliance evidence |
| `corsair help` | Show help |

## Attack Targets

| Target | What It Attacks |
|--------|-----------------|
| `mfa` | Multi-factor authentication flows |
| `session-hijack` | Session management controls |
| `privilege-escalation` | Authorization boundaries |
| `token-replay` | Token handling mechanisms |

## Drift Types

| Drift | Chaos Injected |
|-------|----------------|
| `--drift=temporal` | Time-based anomalies (token replay, clock skew) |
| `--drift=geographic` | Location-based anomalies (impossible travel, VPN egress) |
| `--drift=behavioral` | Pattern-based anomalies (rate bursts, access patterns) |
| `--drift=protocol` | Protocol-level anomalies (downgrades, fallbacks) |

## Evidence Auto-Generation

Every attack automatically maps findings to compliance frameworks:

- **SOC2**: CC6.1, CC6.2, CC6.3, CC6.6, CC7.2
- **ISO27001**: A.9.2.3, A.9.4.2, A.12.4.1
- **NIST-CSF**: PR.AC-7, PR.DS-2

You don't select a framework. You attack. The framework mappings happen in the background.

## Philosophy

**Old approach**: Configure framework → Define controls → Test against checklist → Generate evidence

**CORSAIR approach**: Launch attack → Discover reality → Evidence emerges

The difference is existential. Compliance tools ask "are you compliant?" CORSAIR asks "what actually happens when things go wrong?"

## Technical Details

- **Runtime**: Bun (TypeScript)
- **Architecture**: Plugin-first, offensive chaos engineering, evidence as side-effect
- **Plugin System**: Provider-agnostic core with aws-cognito reference implementation
- **Output**: JSONL evidence (hash-chain integrity) + Markdown reports
- **Framework Mapping**: Plugin-provided MITRE -> NIST-CSF -> SOC2 mappings
- **Event System**: Pub/sub events with aggregation and query support
- **Tests**: 205 tests across 15 files (primitives, patterns, plugin-system)

## Project Structure

```
src/
  corsair-mvp.ts       # Main Corsair class and primitives (1416 lines)
  types.ts             # Type definitions (536 lines)
  evidence.ts          # JSONL evidence engine with hash chain (270 lines)
  compaction.ts        # Evidence compaction (OpenClaw Pattern 1) (208 lines)

plugins/
  aws-cognito/
    aws-cognito.plugin.json   # Plugin manifest with framework mappings
    aws-cognito-plugin.ts     # Plugin implementation
    index.ts                  # Module exports

tests/
  primitives/          # Core primitive tests (RECON, MARK, RAID, etc.)
  patterns/            # OpenClaw pattern tests (Events, Compaction, etc.)
  plugin-system/       # Plugin discovery and type abstraction tests
```

## Plugin Architecture

CORSAIR follows a plugin-first architecture with auto-discovery:

```
corsair-mvp/
  src/
    corsair-mvp.ts      # Core primitives (generic)
  plugins/
    aws-cognito/        # AWS Cognito provider plugin
      aws-cognito-plugin.ts     # Plugin implementation
      aws-cognito.plugin.json   # Plugin manifest (auto-discovered)
      index.ts                  # Module exports
    # Future: azure-ad/, okta/, auth0/
```

### Plugin Discovery

Plugins are auto-discovered when you call `corsair.initialize()`:

```typescript
const corsair = new Corsair();
await corsair.initialize();  // Scans plugins/ for *.plugin.json

// Check what was discovered
console.log(corsair.getPlugins().map(p => p.manifest.providerId));
// Output: ["aws-cognito"]
```

### Plugin Manifest Schema

Each plugin must provide a `*.plugin.json` manifest:

```json
{
  "providerId": "aws-cognito",
  "providerName": "AWS Cognito",
  "version": "1.0.0",
  "attackVectors": [
    {
      "id": "mfa-bypass",
      "name": "MFA Bypass",
      "description": "Tests MFA bypass scenarios",
      "severity": "CRITICAL",
      "mitreMapping": ["T1556.006"]
    }
  ]
}
```

### Creating a New Provider Plugin

1. Create directory: `plugins/my-provider/`
2. Create manifest: `my-provider.plugin.json` with required fields
3. Implement `ProviderPlugin<T>` interface in TypeScript
4. Export plugin types and factory functions
5. Test: `await corsair.initialize()` should discover your plugin

See `plugins/aws-cognito/` for reference implementation.

## License

MIT
