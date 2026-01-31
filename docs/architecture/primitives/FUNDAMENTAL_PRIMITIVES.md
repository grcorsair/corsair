# Fundamental Primitives - GRC Chaos Engineering

**Research Date:** 2026-01-31
**Analysis Type:** First Principles Deconstruction
**Source:** FirstPrinciples skill analysis
**Theme:** Pirate-themed chaos engineering for GRC

---

## Executive Summary

These 6 primitives are the **irreducible components** of GRC chaos engineering. Everything else in the system is composed from these operations. They represent the fundamental truths - what compliance validation **actually is** at the lowest level.

**Pirate Metaphor:** Like historical corsairs who held letters of marque to raid enemy ships, these primitives give you authorization to attack your own infrastructure—finding gaps between documented compliance and actual security.

---

## The 6 Primitives

### 1. RECON (State Observer)

**Function Signature:**
```typescript
recon(target: Target) → ObservedState
```

**Purpose:** Scout the current state of a target system without modification. Survey the waters before the raid.

**Fundamental Truth:** You cannot validate compliance without knowing what currently exists.

**Properties:**
- Read-only operation (no side effects)
- Deterministic (same target → same state)
- Timestamped (observation moment captured)
- Structured output (machine-readable state)
- **Threat-driven (MITRE ATT&CK reconnaissance tagged)** - Optional enrichment

**Examples:**
- Read AWS IAM policy JSON (scout the defenses)
- Query firewall rules (map the perimeter)
- Snapshot database access controls (identify treasure locations)
- Capture network configuration (chart the network seas)

**Examples with Threat Context:**
- Enumerate cloud resources and permissions → **T1580** (Cloud Infrastructure Discovery)
- Scan network for open ports and services → **T1046** (Network Service Discovery)
- Query DNS records for target infrastructure → **T1590.002** (DNS/Passive DNS)
- Gather cloud account configuration details → **T1592.007** (Cloud Account Configuration)

**Pirate Command:** `corsair recon <target>`

**Threat-Driven Enhancement (Optional):**
```bash
# Basic reconnaissance (no threat context required)
$ corsair recon --target aws-prod-environment

# Enhanced with ATT&CK technique (automatic framework mapping)
$ corsair recon --target aws-prod --technique T1580
# Automatically maps: T1580 → NIST CM-8, AC-2 → SOC2 CC6.1, ISO 27001 A.8.1
```

**Why Primitive:** All raids start with reconnaissance. This is the foundation. Threat intelligence enriches recon with real-world adversary tactics but is NOT required to start scouting.

---

### 2. MARK (State Asserter)

**Function Signature:**
```typescript
mark(observed: ObservedState, expected: ExpectedState) → (Pass/Fail, Delta)
```

**Purpose:** Identify the target - compare observed reality against desired state and quantify the gap. Mark what's worth raiding.

**Fundamental Truth:** Compliance is the delta between "what is" and "what should be."

**Properties:**
- Binary outcome (pass or fail)
- Delta calculation (exactly what differs)
- Evidence generation (proof of comparison)
- Threshold-aware (acceptable variance)

**Examples:**
- Mark MFA for all users → Fail: 3 crew without protection
- Mark encryption requirement → Pass: All cargo holds secured
- Mark least privilege → Fail: 7 officers with too much authority

**Pirate Command:** `corsair mark <control>`

**Why Primitive:** Without marking the target, recon is just charts. Marking identifies what to raid.

---

### 3. RAID (State Perturber)

**Function Signature:**
```typescript
raid(target: Target, spec: RaidSpec) → (NewState, EscapeToken)
```

**Purpose:** Execute the attack - inject controlled chaos to test if controls actually hold under adversarial conditions. Board the ship and test the defenses. Each raid maps to real-world adversary tactics.

**Fundamental Truth:** Controls that work in calm seas may fail under attack. Raids reveal truth.

**Properties:**
- Controlled blast radius (defined boarding party size)
- Reversible (escape token generated)
- Approved (captain's authorization for high-risk raids)
- Isolated (lane serialization prevents crew interference)
- **Threat-driven (MITRE ATT&CK technique tagged)** - Optional enrichment

**Examples with Threat Context:**
- Delete IAM role to test if alarm bells ring → **T1531** (Account Access Removal)
- Simulate network partition to test if ship stays afloat → **T1498** (Network DoS)
- Inject malicious traffic to test if cannons fire back → **T1190** (Exploit Public-Facing Application)
- Disable backup to test if lookout spots the gap → **T1490** (Inhibit System Recovery)
- **MFA bypass via legacy protocol** → **T1556.006** (Multi-Factor Authentication Request Generation)

**Pirate Command:** `corsair raid <target> --pattern <chaos-pattern>`

**Threat-Driven Enhancement (Optional):**
```bash
# Basic raid (no threat context required)
$ corsair raid --target mfa-enforcement --pattern exception-drift

# Enhanced with ATT&CK technique (automatic framework mapping)
$ corsair raid --target mfa-enforcement --technique T1556.006
# Automatically maps: T1556.006 → NIST PR.AC-7 → SOC2 CC6.1, ISO 27001 A.9.4.2
```

**Why Primitive:** Static inspection from shore is insufficient. Boarding and attacking validates that defenses actually work. Threat intelligence enriches raids with real-world adversary tactics but is NOT required to start raiding.

---

### 4. PLUNDER (Evidence Capturer)

**Function Signature:**
```typescript
plunder(observation: Observation) → Artifact
```

**Purpose:** Extract the loot - create immutable, timestamped, searchable records of what was discovered. Capture proof of the raid.

**Fundamental Truth:** Compliance without evidence is legend. Evidence makes it verifiable treasure.

**Properties:**
- Immutable (append-only ship's log)
- Timestamped (when plundered)
- Structured (catalogued treasure)
- Searchable (hybrid vector + keyword maps)
- Cryptographically signed (captain's seal)
- **Threat-driven (MITRE ATT&CK exfiltration tagged)** - Optional enrichment

**Examples:**
- JSONL session transcript of raid
- Screenshot of breached defenses (or successfully blocked attacks)
- Hash chain of plundered artifacts
- Signed manifest of control effectiveness

**Examples with Threat Context:**
- Capture evidence to cloud storage bucket → **T1567.002** (Exfiltration to Cloud Storage)
- Extract logs via alternative protocol → **T1048** (Exfiltration Over Alternative Protocol)
- Automated collection of control effectiveness data → **T1119** (Automated Collection)
- Transfer compliance artifacts via encrypted channel → **T1048.002** (Exfiltration Over Asymmetric Encrypted Non-C2 Protocol)

**Pirate Command:** `corsair plunder --raid <raid-id>`

**Threat-Driven Enhancement (Optional):**
```bash
# Basic evidence extraction (no threat context required)
$ corsair plunder --raid latest --artifacts logs,screenshots

# Enhanced with ATT&CK technique (automatic framework mapping)
$ corsair plunder --raid latest --technique T1567.002
# Automatically maps: T1567.002 → NIST AU-9, AU-11 → SOC2 CC7.2, ISO 27001 A.12.4
```

**Why Primitive:** Port authorities require proof. Evidence artifacts are the currency of legitimacy. Threat intelligence enriches evidence collection with exfiltration taxonomy but is NOT required to start plundering.

---

### 5. CHART (Goal Evaluator)

**Function Signature:**
```typescript
chart(target: Target, criteria: Criteria[]) → (Achieved: boolean, Evidence)
```

**Purpose:** Map compliance territory - determine if a goal is met by evaluating multiple criteria and charting progress. Chart where the treasure actually lies.

**Fundamental Truth:** Compliance goals are composed of multiple testable waypoints. Goal achievement requires reaching all waypoints.

**Properties:**
- Criteria-based (8-word waypoints, testable, granular)
- Aggregating (all waypoints must be reached)
- Evidence-backed (each criterion has treasure map proof)
- Binary outcome (destination reached or not)

**Examples:**
- Goal: "Least Privilege Access Control"
  - Waypoint: No wildcard IAM policies in the fleet
  - Waypoint: All roles inspected in last 90 days
  - Waypoint: Unused permissions scrapped automatically
  - Result: DESTINATION REACHED (all 3 waypoints) + Treasure map

**Pirate Command:** `corsair chart <compliance-goal>`

**Why Primitive:** Raids are goal-oriented. Individual marks roll up into charted territory.

---

### 6. ESCAPE (Rollback Executor)

**Function Signature:**
```typescript
escape(token: EscapeToken) → Confirmation
```

**Purpose:** Clean getaway - restore previous state after the raid, ensuring the boarding party escapes safely. Leave no trace.

**Fundamental Truth:** Chaos engineering requires escape routes. Rollback is the safety mechanism.

**Properties:**
- Token-based (captain's orders, unforgeable)
- Idempotent (multiple escapes same result)
- Verifiable (confirmation with proof)
- Automatic (triggers when alarm bells sound)

**Examples:**
- Escape deleted IAM role from backup hold
- Restore network configuration from nautical charts
- Re-enable disabled service (repair the mast)
- Revert firewall rule changes (close the breach)

**Pirate Command:** `corsair escape --token <escape-token>`

**Why Primitive:** Without escape routes, raids are reckless piracy. Escape makes it sanctioned corsair activity.

---

## Composition Examples

Primitives compose into higher-order raid campaigns:

### Compliance Validation Voyage
```
recon(target)           // Scout the waters
  → mark(observed, expected)    // Identify targets
  → plunder(observation)        // Capture evidence
  → chart(target, criteria)     // Map progress
```

### Chaos Raid Campaign
```
recon(target)           // Scout before boarding
  → raid(target, spec)          // Execute attack
  → recon(target)               // Survey the damage
  → mark(post_raid, expected)   // Assess success
  → plunder(observation)        // Extract proof
  → escape(token)               // Clean getaway
```

### Continuous Patrol Loop
```
while sailing:
  fleet_state = recon(targets)         // Scout the waters
  findings = [mark(s, expected) for s in fleet_state]
  plunder(findings)                    // Log evidence
  if any(f.vulnerable for f in findings):
    raid(target, chaos_spec)           // Test defenses
    escape(token)                      // Safe return
```

---

## Why These Are Fundamental

**Test: Can any primitive be reduced further?**

- **RECON** → No. "Scout the territory" is atomic.
- **MARK** → No. "Identify the target" is atomic.
- **RAID** → No. "Execute the attack" is atomic.
- **PLUNDER** → No. "Extract the loot" is atomic.
- **CHART** → No. "Map the progress" is atomic.
- **ESCAPE** → No. "Restore safe state" is atomic.

**Test: Can a corsair campaign work without any primitive?**

- Without **RECON**: Blind raiding (no intel)
- Without **MARK**: No target selection
- Without **RAID**: Static observation only (insufficient)
- Without **PLUNDER**: No proof (unverifiable legends)
- Without **CHART**: No navigation (lost at sea)
- Without **ESCAPE**: Unsafe raids (destructive piracy)

**Conclusion:** All 6 primitives are necessary and sufficient for sanctioned corsair operations.

---

## Primitive vs. Composition

| Primitive | Composition Example |
|-----------|---------------------|
| RECON | Multi-target parallel reconnaissance fleet |
| MARK | Threshold-based target selection with priority |
| RAID | Scheduled chaos campaigns with captain's approval |
| PLUNDER | Evidence chain with captain's cryptographic seal |
| CHART | Hierarchical navigation maps with waypoint dependencies |
| ESCAPE | Cascading escape routes across fleet dependencies |

Compositions use primitives. Primitives are irreducible boarding maneuvers.

---

## Translation Architecture: MITRE ATT&CK as Rosetta Stone

**Core Insight:** Corsair operates in three architectural layers, with MITRE ATT&CK serving as the translation mechanism between offensive operations and compliance frameworks.

### The 3-Layer Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: FRAMEWORK VIEWS (Compliance Reporting)                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  SOC2 (CC6.1, CC7.2) │ ISO27001 (A.9.4, A.12.4) │ NIST CSF (PR.AC-7)  │
│  PCI-DSS (Req 8.3)   │ HIPAA (§164.312)         │ CIS Controls (5.3)  │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↑
                    Automatic Translation via Control Mappings
                                   ↑
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: TRANSLATION LAYER (MITRE ATT&CK Rosetta Stone)               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  T1556.006 (MFA Bypass) → NIST PR.AC-7 → SOC2 CC6.1, ISO A.9.4.2      │
│  T1531 (Account Removal) → NIST PR.AC-4 → SOC2 CC6.2, ISO A.9.2.1     │
│  T1567.002 (Cloud Exfil) → NIST AU-9, AU-11 → SOC2 CC7.2, ISO A.12.4  │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↑
                         Maps Attack → Security Control
                                   ↑
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: REALITY LAYER (Framework-Agnostic Raids)                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  corsair raid --target mfa-enforcement --pattern exception-drift        │
│  corsair recon --target aws-prod-environment                            │
│  corsair plunder --raid latest --artifacts logs,screenshots             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why MITRE ATT&CK as the Translation Mechanism?

**Problem:** Different compliance frameworks use different language for the same security concepts:
- SOC2 calls it "Access Control" (CC6.1)
- ISO 27001 calls it "Logical Access Controls" (A.9.4.2)
- NIST CSF calls it "Identity Management and Access Control" (PR.AC-7)
- PCI-DSS calls it "Multi-Factor Authentication" (Req 8.3)

**Solution:** MITRE ATT&CK provides a universal attack taxonomy that maps to security controls across ALL frameworks.

**Example Translation Chain:**

```
Raid Reality:
  corsair raid --target mfa-enforcement --technique T1556.006

ATT&CK Translation:
  T1556.006 = "Modify Authentication Process: Multi-Factor Authentication"
  Defense: Implement and enforce multi-factor authentication controls

Framework Mappings:
  → NIST 800-53: IA-2(1), IA-2(2), IA-2(11)
  → NIST CSF: PR.AC-7 (Users authenticated before access)
  → SOC2: CC6.1 (Logical and physical access controls)
  → ISO 27001: A.9.4.2 (Secure log-on procedures)
  → PCI-DSS: Requirement 8.3 (MFA for all access)
  → HIPAA: §164.312(d) (Person/entity authentication)
```

### Offensive-First, Translation-Automatic

**User Experience:**

1. **Corsair raids focus on attack realism** - no framework selection required
2. **ATT&CK technique tagging is OPTIONAL** - raids work without it
3. **Framework translation happens automatically in background** - when needed for reporting
4. **Compliance views generated on-demand** - `corsair parley --format soc2`

**Key Principle:** You raid infrastructure like a real attacker. Corsair translates your offensive validation into compliance evidence automatically.

### Data Model: Framework-Agnostic Attack Artifacts

```typescript
// Reality Layer: What actually happened during the raid
interface AttackArtifact {
  raid_id: string
  primitive: "RECON" | "MARK" | "RAID" | "PLUNDER" | "CHART" | "ESCAPE"
  target: string
  timestamp: string
  outcome: "success" | "blocked" | "failed"
  evidence: Evidence[]

  // OPTIONAL: Threat intelligence enrichment
  mitre_technique?: string  // e.g., "T1556.006"
}

// Translation Layer: Automatic mapping to controls
interface ControlMapping {
  attack_technique: string  // MITRE ATT&CK ID
  nist_controls: string[]   // NIST 800-53 controls
  nist_csf: string[]        // NIST CSF categories
  frameworks: {
    soc2: string[]          // SOC2 criteria
    iso27001: string[]      // ISO 27001 controls
    pci_dss: string[]       // PCI-DSS requirements
    hipaa: string[]         // HIPAA sections
  }
}

// Framework Layer: Compliance view
interface ComplianceReport {
  framework: "soc2" | "iso27001" | "nist_csf" | "pci_dss"
  criteria: Criterion[]
  evidence: AttackArtifact[]  // Maps back to reality
  effectiveness: "PROVEN" | "GAPS" | "UNTESTED"
}
```

### Why This Matters

**Traditional GRC approach:**
1. Pick framework (SOC2)
2. Read control requirements
3. Check if controls exist
4. Generate self-attestation report

**Corsair approach:**
1. Attack your infrastructure like a real adversary
2. Capture what happened (framework-agnostic)
3. Translate attacks → framework evidence (automatic)
4. Generate reports with PROOF controls work under attack

**Result:** Same compliance frameworks, but validated through adversarial testing rather than checkbox auditing.

---

## Mapping to OpenClaw Patterns

| Primitive | OpenClaw Pattern | Corsair Semantics |
|-----------|------------------|-------------------|
| RECON | Read tools (filesystem, API, database) | Scout enemy territory |
| MARK | Tool policy authorization checks | Identify weak points |
| RAID | Bash execution with approval gates | Board and attack |
| PLUNDER | JSONL session serialization | Extract proof of raid |
| CHART | ISC criteria verification | Map compliance territory |
| ESCAPE | Session state management | Clean getaway mechanism |

OpenClaw provides the **execution engine** (the ship). These primitives provide the **GRC raid semantics** (the corsair tactics).

---

## Next Steps

1. **Prototype Implementation**: Build minimal working version of each primitive (first raid campaign)
2. **Composition Patterns**: Design higher-order raid workflows (multi-target campaigns)
3. **Evidence Architecture**: JSONL + cryptographic chain design (ship's log with captain's seal)
4. **Chaos Library**: Pre-built raid patterns for common scenarios (standard boarding maneuvers)
5. **Goal Hierarchy**: Define compliance navigation chart structures (treasure maps)

---

**Key Insight:** These primitives are the "boarding maneuvers" of GRC chaos engineering. Every corsair raid compiles down to these 6 operations. Like historical corsairs who held letters of marque, Corsair executes **sanctioned chaos** - authorized attacks that validate your controls actually work, not just that they exist on paper.
