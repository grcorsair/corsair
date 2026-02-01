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

## Commands

| Command | Description |
|---------|-------------|
| `corsair strike <target>` | Launch exception drift attack |
| `corsair recon <target>` | Reconnaissance on target |
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

- **Runtime**: Bun (single-file TypeScript)
- **Architecture**: Offensive-first, evidence as side-effect
- **Output**: JSON evidence + Markdown reports
- **Framework Mapping**: Automatic, background, invisible to attacker

## License

MIT
