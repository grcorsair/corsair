# Parley Protocol Plan (GRC Staff + Vendors + Auditors)

Date: 2026-02-09
Scope: Protocol + product UX for non-technical GRC users. GRC-first, engineering-grade.
Status: Updated to reflect what is already implemented in the codebase.

## 0) Goals, Non-Goals, Audience

### Goals
- Deliver a **GRC-native trust protocol** for compliance evidence that is cryptographically verifiable, human-legible, and cross-framework.
- Make verification **obvious and decision-ready** for GRC staff/auditors (not engineers).
- Make CPOEs **portable** across frameworks and consumable in **OSCAL**.
- Provide **continuous assurance** via standardized signals (FLAGSHIP/CAEP).
- Build a **best-in-class trust product** that is sticky in daily workflows and sets a technical bar that earns respect from security engineering.

### Non-Goals
- Developer-first DX as the primary interface (API/CLI are secondary to the verify UI).
- Replacing GRC platforms; Parley is a trust exchange layer.

### Primary Users
- **GRC Analysts** (TPRM, vendor risk): need quick, trustworthy decisions.
- **Auditors**: need evidence quality, provenance, and observation windows.
- **Vendors**: need to publish verifiable attestations without leaking raw evidence.

---

## 1) Protocol Principles (Design Constraints)

1. **Trust legibility > raw data density**
   - A verifier must understand trust tier, evidence quality, and expiry in <30s.
2. **Assurance is multi-dimensional**
   - Single scores are insufficient; provide method, depth, coverage, freshness, independence.
3. **No new vocabulary where standards exist**
   - Map L0–L4 to common frameworks (SOC 2 Type I/II, ISO stage 1/2, CSA STAR levels).
4. **Cross-framework portability is first-class**
   - One attestation, many framework views.
5. **Continuous assurance is external**
   - FLAGSHIP must be a core output, not optional.
6. **Engineering-grade rigor without engineer-first UX**
   - The protocol must be technically rigorous enough that security engineers trust it, even if they are not the primary UI audience.

---

## 1.1 Product Quality Bar (GRC-First, Engineering-Grade)

These are non-negotiable attributes that make the product exceptional in GRC and credible in security engineering.

1. **Cryptographic clarity**
   - Every trust claim is backed by a signature, key reference, and verifiable chain of custody.
2. **Reproducible verification**
   - A verifier can independently reproduce validity without relying on the issuer.
3. **Anti-gaming guarantees**
   - Evidence scoring penalizes sampling opacity, stale data, or unverifiable methodology.
4. **Tamper-evident history**
   - SCITT receipts and hash chains make rewrites detectable.
5. **Explainability to auditors**
   - Every assurance level must be explainable in plain language with supporting dimensions.
6. **Engineering-grade transparency**
   - Provide a “Technical Details” view with cryptographic and protocol metadata for security teams.

---

## 1.2 Protocol Strength Bar (TLS/JWT-Class Rigor)

Parley must feel as *technically sound* as TLS/JWT to engineers, but applied to GRC evidence. This is the minimum bar:

1. **Chain of trust comparable to TLS**
   - Trust anchors are explicit, rotating, and verifiable (DID + JWKS).
   - Verification never requires trusting the issuer’s runtime.
2. **Revocation and transparency like CT**
   - SCITT receipts prove inclusion in an append-only log.
   - Revocation is first-class and discoverable at verification time.
3. **JWT best practices, not “JWT-like”**
   - Strict header validation, `kid` resolution, algorithm pinning.
   - Token freshness and expiry enforced.
4. **Cryptographic agility**
   - Explicit algorithm identifiers and room for future suites.
5. **Deterministic validation**
   - Canonicalized payloads and reproducible verification across toolchains.
6. **Replay and substitution resistance**
   - Unique identifiers, issuance timestamps, and binding of evidence hash roots.
7. **Auditable invariants**
   - “What must always be true” documented and testable (e.g., any L2+ CPOE has observationPeriod).

---

## 1.3 Why Security Engineering Should Care (Without Being the Primary User)

Security engineers will take notice if Parley enforces the following technical expectations:
- **Deterministic verification**: same CPOE yields the same verdict across verifiers.
- **Evidence realism**: test-based evidence beats “checkbox” documentation.
- **Freshness guarantees**: hard expiry + observation windows are first-class, not optional.
- **Attack model coverage**: explicit handling of key rotation, revocation, replay, and DID resolution failure.
- **Minimal trust assumptions**: verification does not depend on Parley-hosted services.

---

## 1.4 Current Implementation Snapshot (Already Done)

- 7-dimension assurance model (0-100) in `src/parley/vc-types.ts` and scoring in `src/ingestion/assurance-calculator.ts`.
- Observation period and evidence type hierarchy implemented in types and calculators.
- FAIR-CAM / CRQ mapping in `src/parley/crq-mapper.ts`.
- OSCAL export via `src/output/oscal-generator.ts`.
- FLAGSHIP event descriptions in `src/flagship/set-generator.ts`.
- Verify UI partially implemented in `apps/web/src/components/features/marque-verifier.tsx`.

---

## 2) CPOE Schema Enhancements (Protocol Changes)

### 2.1 Assurance Equivalence Mapping (Framework-specific)
Add an equivalence *hint* so GRC staff don’t need to learn Parley-specific levels.
This should be shown in the verify UI and reports, not asserted as a protocol claim.

**Proposed UI hint** (not persisted in the CPOE payload):
```json
"frameworkEquivalence": {
  "SOC2": "Type II operating effectiveness",
  "ISO27001": "Stage 2 operational validation",
  "CSA-STAR": "Level 2 third-party attestation",
  "CMMC": "Level 2 C3PAO assessment"
}
```

### 2.2 Multi-Dimensional Assurance (Already Implemented)
Provide a dimensional breakdown to explain *why* a level was earned.
This is already implemented as **7 numeric dimensions (0-100)** in `src/parley/vc-types.ts`
and computed in `src/ingestion/assurance-calculator.ts`.

### 2.3 Observation Period for L2+ (Type II equivalence) — Implemented
Observation windows are already represented by `ObservationPeriod` in `vc-types.ts`.

```json
"observationPeriod": {
  "startDate": "2025-07-01",
  "endDate": "2026-01-01",
  "durationDays": 184
}
```

### 2.4 Assurance Rigor for L0-L4 (TLS/JWT-Class)
The L0-L4 level must be **deterministic, explainable, and testable**. Treat it like a verification profile, not a label.

**Core rule:** L-level is the minimum across all in-scope controls, computed from explicit evidence requirements.

#### 2.4.1 Level Definitions (Gated, Not Heuristic)
- **L0 Documented**: policy or narrative exists, no verification.
- **L1 Configured**: evidence shows control is configured at a point in time.
- **L2 Demonstrated**: evidence shows control *works* across an observation period.
- **L3 Observed**: continuous monitoring + change detection proves ongoing operation.
- **L4 Attested**: independent third-party co-signature (auditor VC / VP).

#### 2.4.2 Evidence Requirements by Level
Each level has required evidence types and minimum dimension thresholds.

```
L0: evidenceVerification >= documented
L1: methodology in {examine, test} AND evidenceVerification >= documented
L2: methodology == test AND observationPeriod.durationDays >= 90
L3: evidenceVerification == automated AND continuousSignals == true
L4: assessorIndependence == auditor AND auditorCoSignature == true
```

Issuance gates and rejection criteria must stay aligned with `L0-L4_ISSUANCE_SPEC.md`
and the current `assurance-calculator.ts` logic (source of truth).

#### 2.4.3 Dimension Thresholds (Minimums)
```
L1: coverage >= 50
L2: coverage >= 75
L3: coverage >= 90
L4: coverage >= 90 AND independence == auditor
```

#### 2.4.4 Deterministic Calculation
- Record `assurance.calculationVersion` and `assurance.inputsHash`.
- Emit a machine-readable `assurance.ruleTrace` explaining the level outcome.
**Phase note:** implement in Week 5–8 (not required for Week 1–4 verify).

Example:
```json
"assurance": {
  "declared": 2,
  "calculationVersion": "l0-l4@2026-02-09",
  "inputsHash": "sha256-abc123...",
  "ruleTrace": [
    "L2 satisfied: methodology=test",
    "L2 satisfied: observationPeriod >= 90 days",
    "L2 satisfied: controlCoverage >= 0.75"
  ]
}
```

#### 2.4.5 Anti-Gaming Safeguards
- **Sampling opacity penalty**: unknown sample size caps max level at L1.
- **Freshness decay**: stale evidence reduces level (e.g., >180 days old caps at L1).
- **Independence check**: if issuer == subject, cap at L2 unless co-signed.

#### 2.4.6 Auditor Co-Signature (L4)
- L4 requires a second VC/VP signed by auditor.
- Verification must confirm:
  - auditor DID resolution
  - auditor signature validity
  - auditor VC scope matches the CPOE scope

#### 2.4.7 LLM Role (Bounded, Auditable)
LLMs can assist with L0–L4 analysis **only as structured input generators**, never as the final authority.

**LLM responsibilities (allowed):**
- Extract evidence attributes into structured fields (methodology, evidence types, sample size).
- Propose dimension scores and draft rule traces with evidence citations.

**Rule engine responsibilities (required):**
- Compute the final declared level using explicit gates/thresholds.
- Enforce caps when evidence is unverifiable or stale.

**Audit metadata (required fields, only when LLM was used):**
```json
"assurance": {
  "assessor": {
    "type": "ai",
    "model": "claude-3.5-sonnet-2026-01",
    "promptHash": "sha256-...",
    "runId": "run_...",
    "inputsHash": "sha256-...",
    "outputsHash": "sha256-..."
  },
  "calculationVersion": "l0-l4@2026-02-09",
  "ruleTrace": [ "L2 satisfied: methodology=test", "L2 satisfied: observationPeriod >= 90 days" ]
}
```

**Hard caps:**
- If evidence is only LLM-interpreted text with no verifiable artifact hashes → max L1.
- If sample size or methodology is unknown → max L1.
- If evidence freshness exceeds threshold → auto-downgrade.

### 2.5 Evidence Type Hierarchy (ISO 19011) — Implemented
Evidence type hierarchy is implemented in `vc-types.ts` and derived in `assurance-calculator.ts`.

```json
"provenance": {
  "source": "auditor",
  "sourceIdentity": "Example Audit Firm LLP",
  "sourceDate": "2026-01-15",
  "evidenceTypes": ["automated-observation", "documented-record", "direct-observation"],
  "evidenceTypeDistribution": {
    "automated-observation": 0.65,
    "documented-record": 0.25,
    "direct-observation": 0.10
  }
}
```
Note: `evidenceTypeDistribution` is **not yet implemented** (planned enhancement).

### 2.6 Cross-Framework Results
Expand per-framework result payloads for GRC-native filtering.

```json
"frameworks": {
  "SOC2": { "controlsMapped": 24, "passed": 22, "failed": 2, "trustCriteria": ["CC6.1", "CC6.2"] },
  "ISO27001": { "controlsMapped": 28, "passed": 26, "failed": 2, "clauses": ["A.8.5", "A.9.2.1"] }
}
```
Note: `trustCriteria` and `clauses` arrays are **not yet implemented** (planned enhancement).

---

## 3) Verification Semantics (What a Verifier Must Decide)

### 3.1 Minimum Decision Outputs
- **Validity**: cryptographic signature + schema + expiry checks.
- **Trust Tier**: clear green/yellow/red/grey outcome.
- **Assurance Summary**: L-level + dimensions + observation period.
- **Framework Filter**: view only SOC 2 / ISO / NIST results.
- **Evidence Quality**: dimensional interpretation.
- **Provenance**: source identity, type distribution.
- **Technical Details (optional view)**: DID resolution path, kid, JWKS fingerprint, SCITT receipt status.

### 3.2 Trust Tier Rendering (GRC-Oriented)
- **Green**: L2–L4 (independently verified or auditor-attested)
- **Yellow**: L0–L1 (self-declared)
- **Red**: invalid/expired/tampered
- **Grey**: unverifiable (DID resolution failure)

### 3.3 Revocation + Status Checks
- Add a revocation status query in verification:
  - SCITT entry existence and receipt validity.
  - Optional local revocation list or timestamped revocation VC.

### 3.4 Engineering-Grade Verification Outputs
Expose a compact, verifiable metadata block so security engineers can independently validate:
- `issuerDid`, `kid`, `jwkThumbprint`
- `didResolutionUrl`
- `scittEntryId`, `scittReceiptHash`
- `hashChainRoot`, `recordCount`
- `verificationTime`, `verifierVersion`
- `didResolutionStatus`, `didResolutionError` (if any)

---

## 4) FLAGSHIP (Continuous Assurance as Default)

### 4.1 GRC-Oriented Event Language
Map CAEP events to business-readable descriptions:
- COLORS_CHANGED → “Assurance level changed (L2 → L1)”
- FLEET_ALERT → “Compliance drift detected in access controls”
- PAPERS_CHANGED → “New CPOE issued; prior version superseded”
- MARQUE_REVOKED → “CPOE revoked; review required”

### 4.2 Subscription Model
- Verify UI offers a “Subscribe to changes” action.
- Default delivery: email + webhook + downloadable CSV digest.

---

## 5) OSCAL Export (Government/Enterprise Interop)

- One-click export of CPOE to OSCAL Assessment Results.
- Maintain `marque-oscal-mapper.ts` as the canonical mapper.
- Ensure framework mapping includes NIST 800-53 structures used in OSCAL.

---

## 6) FAIR-CAM / Risk Quantification Integration

- Provide an optional CPOE → FAIR-CAM mapping in JSON:
  - Resistance strength (from summary scores)
  - Confidence interval (from assurance level)
  - Freshness decay (from provenance dates)

---

## 7) Data Model + API Surface Updates

### 7.1 CPOE Versioning
- Add `parley: "2.1"` and schema version in payload (if not already present).
- Ensure backwards compatibility for existing v2.0 CPOEs.

### 7.2 Verification API Enhancements
- Extend `functions/verify.ts` output:
  - `trustTier` display value (green/yellow/red/grey)
  - `assurance.dimensions`
  - `assurance.observationPeriod`
  - `assurance.assessor` metadata and `assurance.ruleTrace`
  - `provenance.evidenceTypes`
  - `frameworks` summary
  - `scitt` receipt status (optional)

### 7.3 Issuance Pipeline Inputs
- Extend `IssueRequest` to accept:
  - `observationPeriod`
  - `evidenceTypes`
  - `assessorIndependence`
  - `assurance.assessor` (when LLM-assisted)

### 7.4 Missing Plumbing (Critical Path)
- Ensure DID resolution over HTTPS is wired end-to-end for `/verify`.
- Add sample CPOE generation for demos and regression tests.
- Define deployment target for verify API and `.well-known` endpoints (Railway/Vercel).
- Implement SCITT revocation status check in verification.
- Document key rotation and retired-key verification behavior.

---

## 8) UX Specification: Verify Page for GRC Staff

### Core Experience
1. Paste/upload CPOE
2. Immediate trust verdict (green/yellow/red/grey)
3. Plain-language summary (“L2 operating effectiveness, tested at focused depth, 87% coverage, last updated 8 days ago”)
4. Framework filter tabs (SOC 2 / ISO / NIST / PCI)
5. Download report (JSON now; PDF/CSV later)
6. Subscribe to updates (FLAGSHIP)

### Accessibility + Language
- Use non-technical phrasing first, then toggle “Technical details”.
- Highlight observation period and expiry first.

### Technical Details Drawer (for Security Engineering)
- DID resolution chain and key fingerprint
- DID resolution status/errors
- SCITT receipt status + log ID
- Evidence hash chain root + record count
- VC/JWT header + claims (read-only)

---

## 9) Implementation Phases (90-Day Sequence)

### Week 1–4: Verify Page (End-to-End)
- Wire DID resolution + verification API to the verify UI.
- Trust tier badges, assurance dimensions, observation period.
- Sample CPOE generation for demo and regression tests.

### Week 5–8: Issue Flow (End-to-End)
- Update `/issue` to include new assurance fields and optional `assurance.assessor`.
- Add lightweight rule-trace generation (no heavy rule engine yet).

### Week 9–12: Protocol Hardening
- SCITT receipt verification in `/verify`.
- Key rotation behavior documented + verified with retired keys.
- Optional L4 auditor co-signature verification (VP).

---

## 10) Test Plan (Protocol-First)

- Unit tests for new schema fields (vc-types, generator, verifier).
- LLM output schema validation + rule engine caps (LLM as input only).
- Regression tests for v2.0 CPOEs.
- Verify UI snapshot tests for trust tier rendering.
- SCITT receipt verification tests.

---

## 11) Success Criteria (Protocol Quality)

- GRC analyst can answer “Can I trust this vendor?” in <30s.
- Auditor can explain *why* an assurance level was granted.
- Vendors can publish one CPOE that maps to multiple frameworks.
- Continuous assurance updates via FLAGSHIP are clear and actionable.
- OSCAL export is accepted by federal/commercial tooling without manual edits.
- Security engineers can validate the cryptographic chain without relying on Parley infrastructure.

---

## 11.1 Defensibility (Moat) — Protocol-Level, Not Format-Only

The protocol is defensible only if the moat is in **verification integrity** and **evidence quality**, not just in an artifact format.

### Core Moat Elements
1. **Deterministic assurance engine**
   - L0–L4 is rule-based, reproducible, and explainable via rule trace.
2. **Evidence-quality scoring grounded in standards**
   - FAIR-CAM + ISO 19011 + NIST 800-53A → multi-dimensional scoring others cannot trivially replicate.
3. **Cryptographic transparency + zero-trust verification**
   - DID/JWKS trust anchors + SCITT receipts enable independent validation without Parley runtime.
4. **Anti-gaming safeguards**
   - Caps, freshness decay, sampling opacity penalties make the system robust to incentive attacks.

### What Is *Not* a Moat
- The CPOE file format alone.
- A UI layer without deterministic verification.
- Non-reproducible LLM judgments.

### Defensibility Metric
- A third-party engineer can independently reproduce a verification result and rule trace from the CPOE + evidence hashes.

---

## 12) File Targets (Initial Edits)

- `src/parley/vc-types.ts`
- `src/parley/vc-generator.ts`
- `src/parley/vc-verifier.ts`
- `src/ingestion/assurance-calculator.ts`
- `functions/verify.ts`
- `functions/issue.ts`
- `src/output/oscal-generator.ts`
- `apps/web/src/components/features/marque-verifier.tsx`
- `CPOE_SPEC.md`
- `L0-L4_ISSUANCE_SPEC.md`
