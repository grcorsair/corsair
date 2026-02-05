# CORSAIR Agentic Layer

Autonomous security testing powered by Anthropic's Claude models.

## Overview

The CORSAIR Agent uses Claude to autonomously hunt for security vulnerabilities by:
- Planning strategic attack sequences
- Executing the 6 Corsair primitives (RECON, MARK, RAID, PLUNDER, CHART, ESCAPE)
- Adapting strategy based on findings
- Generating compliance-ready evidence

## Models Used

- **claude-sonnet-4-5-20250929**: Complex reasoning, mission planning, adaptive strategy
- **claude-haiku-4-5-20251001**: Fast validation, simple tool calls, quick checks

## Quick Start

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY=your_key_here

# Run the example mission
bun run src/agents/example.ts
```

## Architecture

### Files

- **tool-definitions.ts**: Anthropic tool schemas for all 6 Corsair primitives
- **system-prompts.ts**: Pirate-themed strategic guidance and reasoning instructions
- **corsair-agent.ts**: Main CorsairAgent class with autonomous execution loop
- **example.ts**: Working example demonstrating MFA security testing

### How It Works

1. **Mission Input**: User provides high-level security objective
2. **Strategic Planning**: Agent (Sonnet) breaks down mission into primitive operations
3. **Tool Execution**: Agent calls Corsair primitives via Anthropic tool use
4. **Adaptive Loop**: Agent observes results and adjusts strategy
5. **Evidence Output**: Cryptographic evidence with compliance mappings

## Usage

```typescript
import { CorsairAgent } from "./src/agents/corsair-agent";

const agent = new CorsairAgent({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  maxTurns: 15,
  model: "sonnet", // or "haiku" or "auto"
  verbose: true
});

const mission = `
Test MFA security of AWS Cognito pool 'us-west-2_ABC123'.
Identify vulnerabilities and generate compliance evidence.
`;

const result = await agent.executeMission(mission);
console.log(result);
```

## The 6 Primitives

### 1. RECON - Reconnaissance
Read-only observation of security configurations.

**When to use**: First step of any mission, before planning attacks.

```typescript
{
  name: "recon",
  input: {
    targetId: "us-west-2_ABC123",
    source: "fixture" // or "aws" for real API
  }
}
```

### 2. MARK - Drift Detection
Compare reality vs security expectations.

**When to use**: After RECON to identify specific vulnerabilities.

```typescript
{
  name: "mark",
  input: {
    snapshotId: "us-west-2_ABC123",
    expectations: [
      { field: "mfaConfiguration", operator: "eq", value: "ON" }
    ]
  }
}
```

### 3. RAID - Controlled Chaos
Execute attack vectors to test security controls.

**When to use**: To prove controls work (or don't) under attack.

```typescript
{
  name: "raid",
  input: {
    snapshotId: "us-west-2_ABC123",
    vector: "mfa-bypass",
    intensity: 7,
    dryRun: true // ALWAYS true unless authorized
  }
}
```

### 4. PLUNDER - Evidence Extraction
Generate tamper-proof evidence with SHA-256 hash chain.

**When to use**: After RAID to capture compliance evidence.

```typescript
{
  name: "plunder",
  input: {
    raidId: "raid-001",
    evidencePath: "./evidence/raid-001.jsonl"
  }
}
```

### 5. CHART - Framework Mapping
Map findings to MITRE ATT&CK, NIST-CSF, SOC2.

**When to use**: To translate technical findings to compliance language.

```typescript
{
  name: "chart",
  input: {
    findingsId: "raid-001" // or mark result ID
  }
}
```

### 6. ESCAPE - Cleanup
Rollback changes and restore original state.

**When to use**: After RAID to ensure clean recovery.

```typescript
{
  name: "escape",
  input: {
    raidId: "raid-001",
    verifyRestore: true
  }
}
```

## Agent Behavior

### Strategic Process

The agent follows this general pattern:

1. **RECONNAISSANCE**: Start with RECON to understand target
2. **DRIFT ANALYSIS**: Use MARK to identify vulnerabilities
3. **ATTACK PLANNING**: Choose vector based on findings
4. **RAID EXECUTION**: Execute attack with appropriate intensity
5. **EVIDENCE CAPTURE**: Use PLUNDER for cryptographic evidence
6. **FRAMEWORK MAPPING**: Apply CHART for compliance translation
7. **CLEANUP**: Execute ESCAPE to restore state

### Safety Guardrails

- Always uses `dryRun: true` by default
- Never attacks blindly (RECON first)
- Cleans up after raids (ESCAPE)
- Documents reasoning at each step
- Respects maximum turn limits

### Communication Style

- **Pirate-themed narration**: "Ahoy!", "Setting sail", "Plundering evidence"
- **Professional analysis**: Clear technical findings and risk assessment
- **Strategic thinking**: Step-by-step reasoning with explicit rationale
- **Evidence-driven**: Facts over assumptions

## Example Missions

### Mission 1: MFA Security Test
```
Test MFA security of Cognito pool 'us-west-2_TEST123'.
Identify bypass scenarios and generate SOC2 evidence.
```

### Mission 2: Password Policy Audit
```
Audit password policies across all user pools.
Test resistance to password-spray attacks.
Map findings to NIST-CSF controls.
```

### Mission 3: Session Security
```
Test session hijacking protections.
Validate device challenge requirements.
Generate MITRE ATT&CK mappings.
```

## Troubleshooting

### API Key Not Set
```bash
export ANTHROPIC_API_KEY=your_key_here
```

### Max Turns Reached
Increase `maxTurns` option:
```typescript
const agent = new CorsairAgent({
  apiKey,
  maxTurns: 20 // default: 15
});
```

### Verbose Logging
Enable detailed output:
```typescript
const agent = new CorsairAgent({
  apiKey,
  verbose: true // default: true
});
```

## Next Steps

1. **Real AWS Integration**: Connect to actual AWS Cognito APIs
2. **Multi-Provider Support**: Add support for Okta, Auth0, Azure AD
3. **Advanced Strategies**: Implement multi-stage attack campaigns
4. **Evidence Validation**: Cryptographic verification of evidence chains
5. **Framework Extensions**: Add CIS, PCI-DSS, HIPAA mappings

## Philosophy

> Attack first. Discover reality. Evidence emerges.

Traditional GRC tools check documentation. CORSAIR agents prove what actually works under attack.

The agent is a pirate, but a professional one:
- Strategic and methodical (not reckless)
- Evidence-driven (not assumption-driven)
- Respectful of systems (dryRun by default)
- Focused on truth (not damage)

🏴‍☠️
