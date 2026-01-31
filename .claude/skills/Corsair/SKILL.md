---
name: Corsair
description: Agentic GRC chaos engineering platform - validates compliance through adversarial testing
---

# Corsair Skill

Agentic interface to Corsair - the authorized raiders of compliance validation.

## When to Use

Invoke this skill when user mentions:
- "corsair", "raid", "chaos engineering"
- "validate compliance", "test controls"
- "adversarial testing", "red team GRC"
- "drift detection", "compliance automation"

## What Corsair Does

Corsair validates that compliance controls actually work by attacking them:

1. **RECON** - Observe infrastructure without modification
2. **MARK** - Identify drift (reality vs expectations)
3. **RAID** - Execute controlled chaos with authorization
4. **PLUNDER** - Extract tamper-evident evidence (JSONL + SHA-256)
5. **CHART** - Map findings to compliance frameworks (MITRE→NIST→SOC2)
6. **ESCAPE** - Clean rollback with scope guards

## CLI Usage

```bash
# Run reconnaissance on AWS Cognito
corsair recon aws-cognito-pool.json

# Mark drift against expectations
corsair mark --expect mfaConfiguration=ON --expect passwordPolicy.minimumLength>=12

# Execute raid with controlled chaos
corsair raid --vector mfa-bypass --intensity 0.8 --dry-run

# Extract evidence with cryptographic chain
corsair plunder --output evidence.jsonl

# Map findings to compliance frameworks
corsair chart --findings drift.json

# Rollback to pre-raid state
corsair escape --cleanup
```

## Workflow Routing

| User Request | Workflow |
|--------------|----------|
| "run corsair raid" | `Workflows/ExecuteRaid.md` |
| "validate compliance with corsair" | `Workflows/ValidateCompliance.md` |
| "detect drift" | `Workflows/DetectDrift.md` |
| "extract evidence" | `Workflows/ExtractEvidence.md` |

## Integration

Corsair integrates with:
- **AWS** - Cognito, IAM, S3, Lambda
- **Compliance Frameworks** - SOC2, ISO27001, NIST CSF, MITRE ATT&CK
- **Evidence Systems** - JSONL with SHA-256 hash chains
- **PAI** - Agentic automation of raid orchestration

## Architecture

See `docs/architecture/` for:
- `primitives/FUNDAMENTAL_PRIMITIVES.md` - Core operations
- `patterns/OPENCLAW_MAPPING.md` - OpenClaw pattern implementation
- `patterns/CREATIVE_PATTERNS.md` - Advanced usage patterns

## Repository

This skill is **embedded in the Corsair product repository** at:
`~/projects/corsair/.claude/skills/Corsair/`

The skill ships with the product, ensuring version lock between CLI and PAI integration.
