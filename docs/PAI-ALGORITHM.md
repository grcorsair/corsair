# CORSAIR × PAI Algorithm Integration

**Pirate-Themed Security Testing Engine**

The PAI Algorithm provides the strategic framework. Bounded autonomy provides the intelligence. Together they create verifiable, compliant security testing at scale.

---

## Table of Contents

1. [Overview](#overview)
2. [The 7 Phases (Pirate Edition)](#the-7-phases-pirate-edition)
3. [ISC as Security Expectations](#isc-as-security-expectations)
4. [Architecture Design](#architecture-design)
5. [Example Execution](#example-execution)
6. [Three-Tier Bounded Autonomy](#three-tier-bounded-autonomy)
7. [ISC Provenance System](#isc-provenance-system)

---

## Overview

### The Problem

Traditional security testing requires:
- **Pre-programmed expectations** (developer writes 8 fields to check)
- **Manual mapping** to compliance frameworks
- **Static test cases** that don't adapt to new threats

Scaling to 50+ services becomes:
- 50 services × 8 hours/service = **400 hours of developer work**
- Brittle when APIs change
- False negatives when expectations are incomplete

### The Solution

**PAI Algorithm + Bounded Autonomy:**

| What Developer Provides (Structure) | What Agent Provides (Intelligence) |
|-------------------------------------|-----------------------------------|
| Snapshot type (S3Snapshot interface) | Security expectations (ISC criteria) |
| API authentication | Attack vectors |
| Service routing | Compliance mappings |
| Cleanup hooks | Risk assessment |

**Result**: 160 hours for 50 services (60% reduction) with **better coverage** because agent generates expectations from security knowledge, not assumptions.

---

## The 7 Phases (Pirate Edition)

### 🔭 Phase 1: SCOUT THE WATERS (OBSERVE)

**Purpose**: Reconnaissance without modification. Understand the target's current state.

**Primitive**: `RECON`

**What Happens**:
1. Agent calls RECON primitive with service/target
2. Fetches current configuration snapshot (S3Snapshot, CognitoSnapshot, etc.)
3. Stores snapshot with unique ID for later reference
4. Returns read-only intelligence

**Example**:
```typescript
// Agent executes
const recon = await recon({
  targetId: "corsair-81740c58-public-data",
  service: "s3",
  source: "aws"
});

// Returns
{
  snapshotId: "corsair-81740c58-public-data",
  snapshot: {
    bucketName: "corsair-81740c58-public-data",
    publicAccessBlock: false,    // ⚠️ VULNERABLE
    encryption: null,             // ⚠️ VULNERABLE
    versioning: "Disabled",       // ⚠️ VULNERABLE
    logging: false               // ⚠️ VULNERABLE
  },
  metadata: { source: "aws", readonly: true, durationMs: 1834 }
}
```

**Pirate Wisdom**: "Know thy target before the cannons roar"

---

### 🧭 Phase 2: CHART THE COURSE (THINK)

**Purpose**: Apply security knowledge to reconnaissance data. Identify what IDEAL STATE looks like.

**Primitive**: *(Agent reasoning, no tool call)*

**What Happens**:
1. Agent reviews reconnaissance snapshot
2. Applies security best practices knowledge for the service
3. Identifies gaps between current state and ideal state
4. Reasons about attack surface and threat models
5. Plans what ISC criteria will define success

**Example Reasoning**:
```
Current State (RECON results):
- publicAccessBlock: false
- encryption: null
- versioning: "Disabled"
- logging: false

Security Knowledge (Agent's training):
- AWS S3 Security Best Practices:
  * Public access should be BLOCKED
  * Encryption should be ENABLED (AES256 or aws:kms)
  * Versioning should be ENABLED (data protection)
  * Logging should be ENABLED (audit trails)

Gap Analysis:
- 4 critical deviations from baseline
- Attack surface: public data exposure, no encryption at rest
- Compliance risk: NIST-CSF PR.DS-1 (data at rest), SOC2 CC6.7
```

**Pirate Wisdom**: "Strategic pirates win; reckless ones sink"

---

### 📜 Phase 3: PLOT THE RAID (PLAN)

**Purpose**: Choose attack vectors, set intensity, determine verification strategy.

**Primitive**: *(Agent planning, prepares for RAID/MARK)*

**What Happens**:
1. Based on gaps, select attack vectors
2. Set intensity (1-10 scale) based on worst-case scenarios
3. Plan which ISC criteria will be tested
4. Determine compliance frameworks to map

**Example Plan**:
```
Attack Strategy:
- Vector: "public-access-test"
- Intensity: 8 (assume worst-case: data contains PII)
- DryRun: true (safety first)

ISC Criteria to Generate (Phase 4):
1. Public access block enabled
2. Encryption configured (AES256/KMS)
3. Versioning enabled
4. Access logging enabled

Compliance Frameworks:
- MITRE: T1530 (Data from Cloud Storage)
- NIST-CSF: PR.DS-1, PR.DS-5
- SOC2: CC6.7, A1.2
```

**Pirate Wisdom**: "A battle plan survives first contact with the enemy"

---

### ⚔️ Phase 4: READY THE CANNONS (BUILD)

**Purpose**: Generate ISC (Ideal State Criteria) - the verifiable security expectations.

**Primitive**: Prepares expectations for `MARK`

**What Happens**:
1. Transform security best practices into ISC format
2. Each criterion: **8 words**, **binary** (PASS/FAIL), **granular**, **testable**
3. ISC become the MARK expectations AND VERIFY criteria
4. Provenance: document how each ISC was derived

**Example ISC Generation**:

```typescript
interface SecurityISC {
  id: string;
  criterion: string;           // 8 words max
  field: string;              // S3Snapshot field to check
  operator: "eq" | "neq" | "exists";
  expectedValue: unknown;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  rationale: string;          // Why this matters
  source: "agent-knowledge" | "baseline" | "strict";
  mitreMapping?: string[];
  nistMapping?: string[];
  soc2Mapping?: string[];
}

// Agent generates:
const isc: SecurityISC[] = [
  {
    id: "s3-public-access-block",
    criterion: "Public access block enabled at bucket level",  // 8 words
    field: "publicAccessBlock",
    operator: "eq",
    expectedValue: true,
    severity: "CRITICAL",
    rationale: "Prevents accidental public data exposure",
    source: "agent-knowledge",
    mitreMapping: ["T1530"],
    nistMapping: ["PR.AC-3", "PR.DS-5"],
    soc2Mapping: ["CC6.7"]
  },
  {
    id: "s3-encryption-enabled",
    criterion: "Server-side encryption configured using AES-256 standard",  // 8 words
    field: "encryption",
    operator: "neq",
    expectedValue: null,
    severity: "CRITICAL",
    rationale: "Protects data at rest from unauthorized access",
    source: "agent-knowledge",
    mitreMapping: ["T1530"],
    nistMapping: ["PR.DS-1"],
    soc2Mapping: ["CC6.1", "CC6.7"]
  },
  {
    id: "s3-versioning-enabled",
    criterion: "Versioning enabled to prevent data loss scenarios",  // 8 words
    field: "versioning",
    operator: "eq",
    expectedValue: "Enabled",
    severity: "HIGH",
    rationale: "Protects against accidental deletion and ransomware",
    source: "agent-knowledge",
    mitreMapping: ["T1485", "T1486"],
    nistMapping: ["PR.IP-4"],
    soc2Mapping: ["A1.2"]
  },
  {
    id: "s3-logging-enabled",
    criterion: "Access logging enabled for audit trail compliance",  // 8 words
    field: "logging",
    operator: "eq",
    expectedValue: true,
    severity: "HIGH",
    rationale: "Required for incident detection and forensic analysis",
    source: "agent-knowledge",
    mitreMapping: ["T1530"],
    nistMapping: ["DE.AE-3", "DE.CM-1"],
    soc2Mapping: ["CC7.2"]
  }
];
```

**Key Requirements**:
- ✅ 8 words exactly (enforced)
- ✅ Binary testable (PASS or FAIL in 2 seconds)
- ✅ Granular (one security concern per criterion)
- ✅ Includes severity, rationale, compliance mappings
- ✅ Provenance tracked (how was this derived?)

**Pirate Wisdom**: "Forge thy expectations into unbreakable criteria"

---

### 🏴‍☠️ Phase 5: RAID! (EXECUTE)

**Purpose**: Execute attacks to test if security controls actually work under adversarial conditions.

**Primitive**: `RAID`

**What Happens**:
1. Execute attack vector with configured intensity
2. Simulate real-world attack scenarios
3. Observe control behavior under pressure
4. Document actual vs expected behavior
5. **ALWAYS dryRun: true** unless explicitly authorized

**Example Execution**:
```typescript
const raid = await raid({
  snapshotId: "corsair-81740c58-public-data",
  vector: "public-access-test",
  intensity: 8,
  dryRun: true  // CRITICAL: safety first
});

// Returns
{
  raidId: "raid_s3_1738746920000",
  target: "corsair-81740c58-public-data",
  vector: "public-access-test",
  success: true,  // Attack succeeded (control failed)
  controlsHeld: false,  // Controls did NOT hold under attack
  findings: [
    "Public access enabled - bucket contents accessible without authentication",
    "No encryption at rest - data readable if accessed",
    "Versioning disabled - single-point-of-failure for data loss",
    "No access logs - attack would go undetected"
  ],
  timeline: [
    { timestamp: "2025-02-05T10:15:20Z", action: "Attempt anonymous read", result: "SUCCESS" },
    { timestamp: "2025-02-05T10:15:21Z", action: "Check encryption", result: "NONE" },
    { timestamp: "2025-02-05T10:15:22Z", action: "Verify versioning", result: "DISABLED" }
  ],
  startedAt: "2025-02-05T10:15:20Z",
  completedAt: "2025-02-05T10:15:23Z",
  durationMs: 3000
}
```

**Attack Result Interpretation**:
- `success: true` = Attack succeeded (BAD for security)
- `controlsHeld: false` = Security controls failed under attack
- Findings document exactly what an attacker could do

**Pirate Wisdom**: "Attack reveals truth that documentation conceals"

---

### 💰 Phase 6: TALLY THE SPOILS (VERIFY)

**Purpose**: Verify ISC criteria, extract cryptographic evidence, map to compliance frameworks.

**Primitives**: `MARK` (verify) + `PLUNDER` (extract) + `CHART` (map)

**What Happens**:
1. **MARK**: Test each ISC criterion against snapshot → PASS/FAIL
2. **PLUNDER**: Extract tamper-proof evidence (SHA-256 hash chain)
3. **CHART**: Map findings to MITRE/NIST/SOC2 automatically

**Example Verification**:

#### Step 6A: MARK (Drift Detection)
```typescript
const mark = await mark({
  snapshotId: "corsair-81740c58-public-data",
  expectations: [
    { field: "publicAccessBlock", operator: "eq", value: true },
    { field: "encryption", operator: "neq", value: null },
    { field: "versioning", operator: "eq", value: "Enabled" },
    { field: "logging", operator: "eq", value: true }
  ]
});

// Returns
{
  findings: [
    {
      id: "drift_1",
      field: "publicAccessBlock",
      expected: true,
      actual: false,
      drift: true,  // ❌ FAIL
      severity: "CRITICAL",
      description: "Public access block disabled - bucket exposed to internet"
    },
    {
      id: "drift_2",
      field: "encryption",
      expected: "not null",
      actual: null,
      drift: true,  // ❌ FAIL
      severity: "CRITICAL",
      description: "No encryption configured - data at rest unprotected"
    },
    {
      id: "drift_3",
      field: "versioning",
      expected: "Enabled",
      actual: "Disabled",
      drift: true,  // ❌ FAIL
      severity: "HIGH",
      description: "Versioning disabled - no protection against data loss"
    },
    {
      id: "drift_4",
      field: "logging",
      expected: true,
      actual: false,
      drift: true,  // ❌ FAIL
      severity: "HIGH",
      description: "Access logging disabled - no audit trail for security events"
    }
  ],
  driftDetected: true,
  durationMs: 50
}
```

**Verification Score**: **0/4 ISC PASSED** (all controls failed)

#### Step 6B: PLUNDER (Evidence Extraction)
```typescript
const plunder = await plunder({
  raidId: "raid_s3_1738746920000",
  evidencePath: "./evidence/s3-public-data-raid.jsonl"
});

// Creates tamper-proof JSONL file with SHA-256 hash chain:
{
  "sequence": 1,
  "timestamp": "2025-02-05T10:15:20Z",
  "operation": "recon",
  "data": { "snapshot": {...}, "snapshotId": "..." },
  "previousHash": null,
  "hash": "a1b2c3..."
}
{
  "sequence": 2,
  "timestamp": "2025-02-05T10:15:21Z",
  "operation": "raid",
  "data": { "vector": "public-access-test", "success": true, ... },
  "previousHash": "a1b2c3...",
  "hash": "d4e5f6..."
}
{
  "sequence": 3,
  "timestamp": "2025-02-05T10:15:22Z",
  "operation": "mark",
  "data": { "findings": [...], "driftDetected": true },
  "previousHash": "d4e5f6...",
  "hash": "g7h8i9..."
}
```

**Evidence Properties**:
- ✅ **Immutable**: Hash chain prevents tampering
- ✅ **Auditable**: Every operation recorded with timestamp
- ✅ **Compliant**: Ready for SOC2, ISO27001 audits
- ✅ **Verifiable**: Chain integrity can be cryptographically verified

#### Step 6C: CHART (Compliance Mapping)
```typescript
const chart = await chart({
  findingsId: "drift_1",  // Public access block disabled
  frameworks: ["MITRE", "NIST-CSF", "SOC2"]
});

// Returns
{
  mitre: {
    technique: "T1530",
    name: "Data from Cloud Storage Object",
    tactic: "Collection",
    description: "Adversaries may access data from cloud storage"
  },
  nist: {
    function: "PROTECT",
    category: "Data Security",
    controls: ["PR.AC-3", "PR.DS-5"]
  },
  soc2: {
    principle: "Confidentiality",
    criteria: ["CC6.1", "CC6.7"],
    description: "Logical and physical access controls"
  }
}
```

**Pirate Wisdom**: "Evidence is the only treasure that matters"

---

### 📖 Phase 7: LOG THE VOYAGE (LEARN)

**Purpose**: Clean up, restore state, capture lessons for continuous improvement.

**Primitive**: `ESCAPE`

**What Happens**:
1. **ESCAPE**: Rollback any changes, verify state restoration
2. Document lessons learned from the raid
3. Update security knowledge base
4. Refine attack strategies for next mission

**Example Cleanup**:
```typescript
const escape = await escape({
  raidId: "raid_s3_1738746920000",
  verifyRestore: true
});

// Returns
{
  cleanupOps: 0,  // No cleanup needed (dryRun: true)
  allSuccessful: true,
  stateRestored: true,
  noLeakedResources: true,
  durationMs: 100
}
```

**Lessons Learned**:
```markdown
## Mission: S3 Public Data Bucket Assessment

### What Worked:
- Autonomous ISC generation correctly identified 4 CRITICAL/HIGH findings
- Attack simulation (dryRun) revealed actual control gaps
- Compliance mapping automated MITRE/NIST/SOC2 connections

### What Failed:
- All 4 security controls failed verification
- No compensating controls detected
- Zero evidence of security monitoring

### Next Mission Improvements:
- Test compensating controls (CloudTrail, GuardDuty)
- Verify incident response procedures
- Assess blast radius (how much data exposed?)
```

**Pirate Wisdom**: "Every raid teaches lessons for the next"

---

## ISC as Security Expectations

### The Perfect Match

PAI Algorithm's ISC criteria format maps **perfectly** to security testing requirements:

| ISC Requirement | Security Testing Need | Example |
|----------------|----------------------|---------|
| **8 words** | Concise, actionable | "MFA configuration set to REQUIRED not optional" |
| **Binary** | Pass/fail clarity | ✅ PASS or ❌ FAIL (no ambiguity) |
| **Granular** | One security control per test | Don't mix "encryption + versioning" in one criterion |
| **Testable** | Automated verification | Can check in 2 seconds via API call |

### Traditional vs ISC-Powered

**Traditional Approach (Pre-Programmed)**:
```typescript
// Developer manually codes expectations
function checkCognitoSecurity(pool: CognitoUserPool): Finding[] {
  const findings = [];

  if (pool.mfaConfiguration !== "REQUIRED") {
    findings.push("MFA not required");
  }

  if (pool.passwordPolicy.minimumLength < 12) {
    findings.push("Password too short");
  }

  // ... 8 more hardcoded checks
  return findings;
}
```

**Problems**:
- 🚨 Developer must know every security best practice
- 🚨 Brittle when AWS API changes
- 🚨 No compliance mappings
- 🚨 50 services × 10 checks × 1 hour = **500 hours**

**ISC-Powered Approach (Bounded Autonomy)**:
```typescript
// Agent generates ISC from security knowledge
async function generateSecurityISC(
  service: "cognito" | "s3" | "okta",
  snapshot: unknown
): Promise<SecurityISC[]> {
  // Agent reasoning with security knowledge + service context
  const isc = await agent.generateISC({
    service,
    snapshot,
    securityKnowledge: SECURITY_BEST_PRACTICES[service],
    complianceFrameworks: ["MITRE", "NIST-CSF", "SOC2"]
  });

  return isc;  // Returns 4-12 ISC criteria with provenance
}
```

**Benefits**:
- ✅ Agent generates expectations from latest security knowledge
- ✅ Adapts to new services without code changes
- ✅ Includes compliance mappings automatically
- ✅ 50 services × 2 hours = **100 hours** (80% reduction)

---

## Architecture Design

### TypeScript Interface Definitions

```typescript
/**
 * Security-focused ISC that extends PAI Algorithm's base ISC format.
 * Used in Phase 4 (BUILD) to define verifiable security expectations.
 */
interface SecurityISC {
  // PAI Algorithm base fields
  id: string;
  criterion: string;           // 8 words max, binary testable

  // Security-specific fields
  field: string;              // Snapshot field to check (e.g., "publicAccessBlock")
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "exists" | "contains";
  expectedValue: unknown;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  rationale: string;          // Why this criterion matters

  // Provenance (transparency)
  source: "agent-knowledge" | "baseline" | "strict";
  derivedFrom?: string;       // If from baseline, what baseline?

  // Compliance mappings (auto-generated in Phase 6)
  mitreMapping?: string[];    // ["T1530", "T1556"]
  nistMapping?: string[];     // ["PR.AC-7", "PR.DS-1"]
  soc2Mapping?: string[];     // ["CC6.1", "CC6.7"]
}

/**
 * Corsair mission execution structure using PAI Algorithm phases.
 */
interface CorsairMission {
  missionId: string;
  service: string;            // "cognito", "s3", "okta", etc.
  targetId: string;          // Resource identifier

  // Phase 1: SCOUT THE WATERS
  recon?: {
    snapshotId: string;
    snapshot: unknown;       // Service-specific (CognitoSnapshot, S3Snapshot, etc.)
    timestamp: string;
  };

  // Phase 2-3: CHART & PLOT (agent reasoning)
  analysis?: {
    vulnerabilities: string[];
    attackSurface: string;
    threatModel: string;
  };

  // Phase 4: READY THE CANNONS
  isc: SecurityISC[];        // Generated expectations

  // Phase 5: RAID
  raid?: {
    raidId: string;
    vector: string;
    intensity: number;
    dryRun: boolean;
    results: RaidResult;
  };

  // Phase 6: TALLY THE SPOILS
  verification: {
    mark: {
      iscResults: Array<{
        iscId: string;
        passed: boolean;
        evidence: string;
      }>;
      score: string;         // "3/4 PASSED"
    };
    plunder?: {
      evidencePath: string;
      chainVerified: boolean;
    };
    chart?: {
      mitre: unknown;
      nist: unknown;
      soc2: unknown;
    };
  };

  // Phase 7: LOG THE VOYAGE
  escape?: {
    cleanedUp: boolean;
    lessonsLearned: string[];
  };

  // Overall mission status
  status: "in-progress" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
}

/**
 * ISC provenance for transparency and auditability.
 * Tracks how each ISC criterion was derived.
 */
interface ISCProvenance {
  iscId: string;
  criterion: string;

  // How was this ISC created?
  source: "agent-knowledge" | "baseline" | "strict";

  // If agent-knowledge: what security principle?
  securityPrinciple?: string;

  // If baseline: what baseline was used?
  baselineId?: string;
  baselineName?: string;      // "AWS Security Best Practices v2024"

  // If strict: what compliance requirement?
  complianceRequirement?: string;

  // Traceability
  createdAt: string;
  createdBy: "corsair-agent";
  agentModel: string;         // "claude-sonnet-4.5-20250929"
  confidence: number;         // 0.0-1.0

  // Audit trail
  approvedBy?: string;        // For strict/baseline sources
  approvedAt?: string;
}
```

### Service Adapter Pattern

Different services require different levels of autonomy:

```typescript
/**
 * Three-tier service adapter architecture for bounded autonomy.
 */

// Tier 1: Full Autonomy (60% of services)
// - Well-documented APIs (AWS, Azure)
// - Clear security standards
// - Agent generates all ISC from knowledge
interface Tier1ServiceAdapter {
  service: string;
  autonomyLevel: "full";

  generateISC(snapshot: unknown): Promise<SecurityISC[]>;
  // Agent generates 100% of ISC from security knowledge

  estimatedSetupTime: "2 hours";
}

// Tier 2: Bounded + Baseline (30% of services)
// - Documented APIs but custom security models
// - Provide security baseline, agent fills gaps
interface Tier2ServiceAdapter {
  service: string;
  autonomyLevel: "bounded";

  baseline: SecurityISC[];    // 3-5 CRITICAL criteria (developer-provided)

  generateISC(snapshot: unknown, baseline: SecurityISC[]): Promise<SecurityISC[]>;
  // Agent: "Here are 3 CRITICAL criteria from baseline"
  //        "I've added 5 more HIGH/MEDIUM criteria from my knowledge"

  estimatedSetupTime: "4 hours";
}

// Tier 3: Hybrid Strict (10% of services)
// - Undocumented/custom internal APIs
// - Strict expectations required by policy
interface Tier3ServiceAdapter {
  service: string;
  autonomyLevel: "hybrid";

  strictExpectations: SecurityISC[];  // All criteria developer-provided

  validateISC(snapshot: unknown): Promise<MarkResult>;
  // Agent only validates against provided ISC
  // But can suggest additional criteria for review

  estimatedSetupTime: "8 hours";
}
```

---

## Example Execution

### Complete S3 Security Testing Flow

```typescript
import { CorsairAgent } from "./agents/corsair-agent";

const agent = new CorsairAgent({ apiKey: process.env.ANTHROPIC_API_KEY });

// Mission: Test S3 bucket security using PAI Algorithm
const mission = await agent.executeMission(`
  Execute the 7-phase PAI Algorithm for S3 bucket security testing.

  Target: corsair-81740c58-public-data
  Service: s3
  Source: aws

  Follow the Algorithm:
  1. 🔭 SCOUT: RECON the bucket
  2. 🧭 CHART: Apply S3 security knowledge
  3. 📜 PLOT: Plan attack vectors
  4. ⚔️ READY: Generate ISC criteria
  5. 🏴‍☠️ RAID: Execute attacks (dryRun: true)
  6. 💰 TALLY: MARK drift, PLUNDER evidence, CHART compliance
  7. 📖 LOG: ESCAPE cleanup, capture lessons

  Show ISC provenance and verification results.
`);

// Agent autonomously executes all 7 phases and returns:
console.log(mission);
```

**Agent Output** (condensed):

```
🏴‍☠️ CORSAIR AGENT REPORT

🔭 PHASE 1: SCOUT THE WATERS
Reconnaissance complete. Captured S3 bucket configuration.
SnapshotId: corsair-81740c58-public-data

🧭 PHASE 2: CHART THE COURSE
Analyzed security posture. Identified 4 deviations from AWS best practices:
- Public access block: DISABLED (should be ENABLED)
- Encryption: NULL (should be AES256 or KMS)
- Versioning: DISABLED (should be ENABLED)
- Logging: DISABLED (should be ENABLED)

📜 PHASE 3: PLOT THE RAID
Attack vector selected: "public-access-test"
Intensity: 8 (worst-case: sensitive data exposure)
DryRun: TRUE (safety protocol engaged)

⚔️ PHASE 4: READY THE CANNONS
Generated 4 ISC criteria:
1. "Public access block enabled at bucket level" [CRITICAL]
2. "Server-side encryption configured using AES-256 standard" [CRITICAL]
3. "Versioning enabled to prevent data loss scenarios" [HIGH]
4. "Access logging enabled for audit trail compliance" [HIGH]

ISC Provenance:
- Source: agent-knowledge
- Security Principle: Defense in Depth
- Confidence: 0.95
- Created: 2025-02-05T10:15:19Z

🏴‍☠️ PHASE 5: RAID!
Attack executed: public-access-test
Result: SUCCESS (security controls FAILED)
Findings:
- Anonymous access granted (no authentication required)
- Data readable in plaintext (no encryption)
- Single point of failure (no versioning)
- Attack undetectable (no logging)

💰 PHASE 6: TALLY THE SPOILS

MARK Results:
❌ ISC 1: FAILED (publicAccessBlock: false, expected: true)
❌ ISC 2: FAILED (encryption: null, expected: not null)
❌ ISC 3: FAILED (versioning: "Disabled", expected: "Enabled")
❌ ISC 4: FAILED (logging: false, expected: true)

Score: 0/4 PASSED (0% security compliance)

PLUNDER Results:
Evidence file: ./evidence/s3-raid-1738746920.jsonl
Events captured: 5
Hash chain: VERIFIED ✓
Immutable: TRUE
Audit-ready: TRUE

CHART Results:
MITRE ATT&CK: T1530 (Data from Cloud Storage Object)
NIST-CSF: PR.AC-3, PR.DS-1, PR.DS-5
SOC2: CC6.1, CC6.7, A1.2

📖 PHASE 7: LOG THE VOYAGE
ESCAPE: State restored, no resources leaked ✓
Lessons Learned:
- All 4 security controls absent (CRITICAL risk)
- Bounded autonomy successfully identified gaps
- ISC criteria accurately predicted attack success
- Compliance mappings automated end-to-end

🏴‍☠️ MISSION COMPLETE
The Algorithm transformed chaos into verifiable evidence.
From CURRENT STATE (insecure) → IDEAL STATE (proven via attack).
```

---

## Three-Tier Bounded Autonomy

### Scaling to 50+ Services

| Tier | Services | Autonomy | Setup Time | Example |
|------|----------|----------|------------|---------|
| **Tier 1** | 30 (60%) | Full | 2 hrs/service | AWS S3, Azure Blob, GCP Storage |
| **Tier 2** | 15 (30%) | Bounded + Baseline | 4 hrs/service | Okta, Crowdstrike, GitHub |
| **Tier 3** | 5 (10%) | Hybrid Strict | 8 hrs/service | Custom internal APIs |

**Total Effort**:
- Tier 1: 30 × 2 = 60 hours
- Tier 2: 15 × 4 = 60 hours
- Tier 3: 5 × 8 = 40 hours
- **Total: 160 hours** (vs 400 hours pre-programmed approach)

### Tier 2 Example: Okta

```typescript
// Developer provides baseline (30 minutes)
const oktaBaseline: SecurityISC[] = [
  {
    id: "okta-mfa-required",
    criterion: "Multi-factor authentication enforced for all user accounts",
    field: "mfaEnrollmentPolicy",
    operator: "eq",
    expectedValue: "REQUIRED",
    severity: "CRITICAL",
    rationale: "Prevents credential-based attacks",
    source: "baseline",
    derivedFrom: "okta-security-baseline-v2024"
  },
  {
    id: "okta-password-strength",
    criterion: "Password policy requires 14 plus character minimum length",
    field: "passwordPolicy.minLength",
    operator: "gte",
    expectedValue: 14,
    severity: "HIGH",
    rationale: "NIST 800-63B requirement for password strength",
    source: "baseline",
    derivedFrom: "okta-security-baseline-v2024"
  }
];

// Agent adds 5-8 more criteria from security knowledge (1 hour agent reasoning)
const agent = new CorsairAgent({ apiKey });
const fullISC = await agent.generateISC({
  service: "okta",
  snapshot: oktaSnapshot,
  baseline: oktaBaseline,  // Start with these 2 CRITICAL
  securityKnowledge: "okta-security-best-practices"
});

// Agent returns:
// - 2 baseline criteria (CRITICAL)
// - 6 agent-generated criteria (HIGH/MEDIUM)
// - Total: 8 ISC criteria with full provenance
```

**Result**:
- Developer effort: 30 minutes (baseline) + 2 hours (integration) = **4 hours total**
- Agent effort: 1 hour reasoning → 6 additional ISC criteria
- Coverage: Better than manual (agent knows latest threats)

---

## ISC Provenance System

### Why Provenance Matters

When ISC criteria are auto-generated, **transparency is critical**:
- Auditors ask: "How was this criterion derived?"
- Security teams ask: "Can we trust this?"
- Compliance frameworks ask: "What's the authoritative source?"

**Provenance answers**:
1. **How**: What source generated this ISC? (agent-knowledge, baseline, strict)
2. **Why**: What security principle or compliance requirement?
3. **When**: Timestamp for audit trail
4. **Confidence**: How certain is the agent? (0.0-1.0)

### Provenance Example

```typescript
// ISC Criterion
{
  id: "s3-encryption-enabled",
  criterion: "Server-side encryption configured using AES-256 standard",
  field: "encryption",
  operator: "neq",
  expectedValue: null,
  severity: "CRITICAL"
}

// ISC Provenance (audit trail)
{
  iscId: "s3-encryption-enabled",
  criterion: "Server-side encryption configured using AES-256 standard",

  // How was this derived?
  source: "agent-knowledge",
  securityPrinciple: "Defense in Depth - Data at Rest Protection",

  // Traceability
  createdAt: "2025-02-05T10:15:19Z",
  createdBy: "corsair-agent",
  agentModel: "claude-sonnet-4.5-20250929",
  confidence: 0.95,

  // Compliance linkage (auto-generated in Phase 6)
  complianceRequirement: "NIST-CSF PR.DS-1: Data-at-rest is protected",

  // For baseline/strict sources
  approvedBy: null,  // agent-generated, no human approval needed
  approvedAt: null
}
```

### Three Provenance Sources

```typescript
// 1. Agent Knowledge (Tier 1: Full Autonomy)
{
  source: "agent-knowledge",
  securityPrinciple: "AWS S3 Security Best Practices",
  confidence: 0.95,  // High confidence from training data
  approvedBy: null   // No approval needed for well-known standards
}

// 2. Baseline (Tier 2: Bounded Autonomy)
{
  source: "baseline",
  baselineId: "okta-baseline-2024-v1",
  baselineName: "Okta Security Baseline v2024",
  confidence: 1.0,   // Absolute confidence (human-provided)
  approvedBy: "security-team@company.com",
  approvedAt: "2024-06-15T00:00:00Z"
}

// 3. Strict (Tier 3: Hybrid)
{
  source: "strict",
  complianceRequirement: "SOC2 CC6.1: Logical access security measures",
  confidence: 1.0,
  approvedBy: "compliance-team@company.com",
  approvedAt: "2024-03-01T00:00:00Z"
}
```

---

## Summary

### The Power of ISC + Bounded Autonomy

| Traditional Approach | PAI Algorithm + Bounded Autonomy |
|---------------------|----------------------------------|
| Developer codes expectations | Agent generates ISC from security knowledge |
| Static, brittle | Adaptive, resilient |
| 400 hours for 50 services | 160 hours for 50 services |
| False negatives (missed checks) | Better coverage (agent knows latest threats) |
| No compliance mappings | Auto-maps to MITRE/NIST/SOC2 |
| No provenance | Full audit trail |

### The Algorithm in Action

```
CURRENT STATE (insecure)
         ↓
🔭 SCOUT THE WATERS → RECON snapshot
         ↓
🧭 CHART THE COURSE → Security reasoning
         ↓
📜 PLOT THE RAID → Attack strategy
         ↓
⚔️ READY THE CANNONS → Generate ISC
         ↓
🏴‍☠️ RAID! → Execute attacks
         ↓
💰 TALLY THE SPOILS → Verify + Extract + Map
         ↓
📖 LOG THE VOYAGE → Cleanup + Learn
         ↓
IDEAL STATE (proven secure via evidence)
```

### Key Takeaways

1. **ISC = Security Expectations**: Perfect format match (8 words, binary, granular, testable)
2. **Algorithm = Mission Engine**: 7 phases from chaos to verifiable evidence
3. **Bounded Autonomy = Scale**: 60% time reduction with better coverage
4. **Provenance = Trust**: Full audit trail for auto-generated criteria
5. **Pirate Theme = Culture**: Professional security testing with swashbuckling spirit 🏴‍☠️

---

**Next Steps**:
1. Run `bun run src/agents/example-pai-algorithm.ts` to see Algorithm in action
2. Test against multiple services: S3, Cognito, custom APIs
3. Measure ISC coverage vs manual expectations
4. Build service adapters for Tier 1/2/3 services
5. Integrate with CI/CD for continuous compliance testing

**The Algorithm turns chaos into evidence. Bounded autonomy turns effort into scale. Together, they make security testing verifiable, compliant, and pirate-approved.** 🏴‍☠️
