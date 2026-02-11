# L0-L4 CPOE Issuance Flow — Production Spec

**Date**: February 9, 2026
**Status**: Refined, ready to implement
**Context**: This spec captures the full L0-L4 issuance design + week 1 deliverable for the Corsair proof infrastructure pivot.

---

## Table of Contents

1. [Core Rule](#core-rule)
2. [Architecture Overview](#architecture-overview)
3. [Tier Specifications (L0-L4)](#tier-specifications)
4. [CPOE-Level Assurance Rollup](#cpoe-level-assurance-rollup)
5. [Verify Page Behavior](#verify-page-behavior)
6. [Edge Cases](#edge-cases)
7. [Code Impact Assessment](#code-impact-assessment)
8. [Week 1 Deliverable](#week-1-deliverable)
9. [Type Changes Required](#type-changes-required)
10. [Build Timeline](#build-timeline)

---

## Core Rule

> **A CPOE's assurance level = the DECLARED level, verified against ALL in-scope controls. No control may be below the declared level unless explicitly excluded with rationale.**

This is the SSL certificate model: you declare OV, the CA verifies every domain. One unverified domain = rejected.

---

## Architecture Overview

```
                    +---------------------------------------------+
                    |              EVIDENCE SOURCES                |
                    |                                             |
                    |  PDF SOC 2     Config Scan JSON    Manual   |
                    |  ISO 27001     SecurityHub         Pentest  |
                    +----------------------+----------------------+
                                           |
                                           v
+----------------------------------------------------------------------+
|  INGEST (src/ingestion/)                                              |
|  PDF/JSON/CSV -> Claude extraction -> IngestedDocument                |
|  Each control gets: status, evidence, frameworkRefs                    |
+------------------------------+---------------------------------------+
                               |
                               v
+----------------------------------------------------------------------+
|  CLASSIFY (src/ingestion/assurance-calculator.ts)                     |
|                                                                       |
|  L0 CLAIMED     | Policy says so. No config. No test. No witness.    |
|  L1 CONFIGURED  | Settings show it's on. Prowler/SecurityHub.        |
|  L2 DEMONSTRATED| Test results prove it works. Pentest report.       |
|  L3 OBSERVED    | Continuous monitoring confirms. FLAGSHIP active.    |
|  L4 ATTESTED    | Independent third party verified + co-signed.       |
|                                                                       |
|  Each CONTROL gets its own level (not the whole document)             |
+------------------------------+---------------------------------------+
                               |
                               v
+----------------------------------------------------------------------+
|  SIGN (src/parley/marque-generator.ts + vc-generator.ts)              |
|                                                                       |
|  L0: Self-signed (user's key, Corsair NOT involved) -> FREE           |
|  L1: Corsair-attested (automated config check)      -> $49/CPOE      |
|  L2: Corsair-verified (Quartermaster AI review)     -> $199/CPOE     |
|  L3: Corsair-validated (continuous + FLAGSHIP)       -> $499/quarter  |
|  L4: Third-party attested (auditor co-signs via VP)  -> $2,000+      |
+------------------------------+---------------------------------------+
                               |
                               v
+----------------------------------------------------------------------+
|  VERIFY (src/parley/marque-verifier.ts -- ALWAYS FREE)                |
|                                                                       |
|  Input: JWT-VC string (paste or API call)                             |
|  Output: valid/invalid, assurance level, issuer, controls, expiry     |
|                                                                       |
|  ANYONE can verify. No account needed. Free forever.                  |
|  This is the network effect driver.                                   |
+----------------------------------------------------------------------+
```

### SSL Certificate Analogy

| Tier | SSL Equivalent | Who Signs | Evidence Required | Automation | Price |
|------|---------------|-----------|-------------------|------------|-------|
| **L0** | Self-signed cert | Vendor | Policy docs only | Full | Free |
| **L1** | Domain-validated (DV) | Corsair | Config screenshots/exports | Full | $49 |
| **L2** | Org-validated (OV) | Corsair + QM | Test results + methodology | AI-assisted | $199 |
| **L3** | Extended validation (EV) | Corsair + QM + FLAGSHIP | Continuous monitoring data | AI + continuous | $499/qtr |
| **L4** | EV + audit letter | Corsair + Auditor | Full audit workpapers | Manual co-sign | $2K+ |

---

## Tier Specifications

### L0: CLAIMED (Self-Signed)

```
WHO:     Vendor (anyone)
SIGNER:  Vendor's own Ed25519 key
COST:    Free (forever)
CORSAIR: Zero involvement
```

**User Journey:**
```bash
# 1. Generate keypair
corsair keygen --output ./keys/

# 2. Ingest document and sign with own key
corsair ingest --file soc2-report.pdf --type soc2 \
  --did "did:web:acme.com" --format vc --output acme-cpoe.jwt

# 3. (Optional) Host DID document for verifiability
# Place at https://acme.com/.well-known/did.json
```

**CPOE assurance field:**
```json
{
  "assurance": {
    "declared": 0,
    "verified": false,
    "method": "self-assessed",
    "breakdown": { "L0": 24 }
  }
}
```

**Rejection criteria:** None. If the JWT is valid, it's a valid L0 CPOE. Corsair never rejects L0.

**Verify page:** Yellow shield -- "Self-signed by did:web:acme.com. Signature valid." If DID resolution fails: gray shield -- "Issuer not reachable."

---

### L1: CONFIGURED (Corsair-Attested)

```
WHO:     Vendor with config evidence
SIGNER:  Corsair's Ed25519 key (did:web:grcorsair.com)
COST:    $49/CPOE
CORSAIR: Automated validation
```

**User Journey (Issue Page, weeks 5-8):**
```
1. Upload compliance document (SOC 2 PDF, Prowler JSON, SecurityHub export)
2. Corsair ingests -> extracts controls -> runs assurance calculator
3. AUTOMATED GATE: Every in-scope control must have:
   - status: "effective"
   - evidence: non-empty string
   - assuranceLevel >= 1 (source is soc2/iso27001/prowler/securityhub)
4. Controls that fail gate -> displayed as "Below L1" with fix instructions
5. Vendor can: fix evidence, exclude controls (with rationale), or accept L0
6. On pass: Corsair signs with its key -> CPOE registered in SCITT
7. Output: JWT-VC + SCITT receipt
```

**CPOE assurance field:**
```json
{
  "assurance": {
    "declared": 1,
    "verified": true,
    "method": "automated-config-check",
    "breakdown": { "L1": 22, "L0": 0 },
    "excluded": [
      { "controlId": "CC7.3", "reason": "Physical security -- compensating control accepted", "acceptedBy": "Ayoub Fandi" },
      { "controlId": "CC7.4", "reason": "Not applicable -- no on-premise infrastructure" }
    ]
  }
}
```

**Rejection criteria:**
- ANY in-scope control with `status !== "effective"` -> control flagged
- ANY in-scope control with empty evidence -> control flagged
- Source is `manual` -> maximum L0 (manual = claimed)
- Flagged controls must be fixed or excluded before L1 issuance

**Verify page:** Green shield -- "Corsair Attested (L1). 22 controls verified as configured."

---

### L2: DEMONSTRATED (Corsair-Verified)

```
WHO:     Vendor with test results
SIGNER:  Corsair's Ed25519 key + Quartermaster attestation embedded
COST:    $199/CPOE
CORSAIR: AI-powered evidence review
```

**User Journey:**
```
1. Same upload as L1, PLUS evidence must include test results
   (pentest reports, adversarial test output, functional test logs)
2. Corsair ingests -> L1 gate passes first
3. QUARTERMASTER GATE: Quartermaster AI reviews evidence:
   - methodology dimension: Did they describe HOW they tested? (weight: 0.30)
   - evidence_integrity dimension: Is evidence internally consistent? (weight: 0.25)
   - completeness dimension: Are all controls covered? (weight: 0.25)
   - bias dimension: Does evidence show only positives? (weight: 0.20)
4. Quartermaster confidenceScore >= 70 required
5. On pass: Corsair signs + QM attestation embedded in CPOE -> SCITT registered
6. On fail: Display QM report with dimension scores + improvement guidance
```

**CPOE assurance field:**
```json
{
  "assurance": {
    "declared": 2,
    "verified": true,
    "method": "ai-evidence-review",
    "breakdown": { "L2": 18, "L1": 4 },
    "quartermaster": {
      "confidenceScore": 82,
      "trustTier": "ai-verified",
      "dimensions": [
        { "dimension": "methodology", "score": 0.85 },
        { "dimension": "evidence_integrity", "score": 0.78 },
        { "dimension": "completeness", "score": 0.80 },
        { "dimension": "bias", "score": 0.84 }
      ]
    }
  }
}
```

**Rejection criteria:**
- L1 gate fails -> can't reach L2
- Quartermaster `confidenceScore < 70` -> stays L1 (with QM report)
- Evidence source is config-only (no test results) -> stays L1
- Controls with only config evidence stay at L1 within the breakdown

**Key distinction from L1:** L1 = "it's turned on." L2 = "we tested it and it works." The evidence TYPE matters.

**Verify page:** Green shield -- "Corsair Verified (L2). Quartermaster confidence: 82/100."

---

### L3: OBSERVED (Continuous)

```
WHO:     Vendor with active monitoring
SIGNER:  Corsair's Ed25519 key + QM + FLAGSHIP stream reference
COST:    $499/quarter
CORSAIR: Continuous monitoring + quarterly re-validation
```

**User Journey:**
```
1. Achieve L2 first (one-time)
2. Activate FLAGSHIP subscription -> continuous compliance signals
3. Corsair monitors: config drift, control changes, assurance degradation
4. Every 90 days: Quartermaster re-validates -> refreshes CPOE
5. If drift detected: FLAGSHIP emits FLEET_ALERT -> CPOE assurance downgrades
6. CPOE includes FLAGSHIP stream ID for real-time status check
```

**CPOE assurance field:**
```json
{
  "assurance": {
    "declared": 3,
    "verified": true,
    "method": "continuous-observation",
    "flagship": {
      "streamId": "stream-abc123",
      "lastValidation": "2026-02-09T00:00:00Z",
      "nextValidation": "2026-05-09T00:00:00Z",
      "activeAlerts": 0
    }
  }
}
```

**Downgrade triggers:**
- FLAGSHIP stream paused/expired -> L2
- Last QM re-validation > 90 days ago -> L2
- Active FLEET_ALERT (unresolved drift) -> L2 (or L1 if severe)
- Vendor explicitly requests downgrade

**Verify page:** Green shield + "Live" badge -- "Corsair Validated (L3). Continuous monitoring active. Last validated: 2 days ago."

---

### L4: ATTESTED (Independent Third Party)

```
WHO:     Vendor + independent auditor
SIGNER:  Corsair key + Auditor's key (Verifiable Presentation)
COST:    $2,000+
CORSAIR: Platform facilitates, auditor co-signs
```

**User Journey:**
```
1. Achieve L3 first
2. Invite external auditor to review via Corsair portal
3. Auditor reviews evidence, QM attestation, FLAGSHIP history
4. Auditor issues THEIR OWN JWT-VC (attestation of review)
5. Corsair bundles: Corsair's CPOE (VC) + Auditor's attestation (VC) = VP
6. VP registered in SCITT with both receipts
```

**Mechanism: W3C Verifiable Presentation**
```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "type": ["VerifiablePresentation"],
  "verifiableCredential": [
    "eyJ...corsair-cpoe-jwt...",
    "eyJ...auditor-attestation-jwt..."
  ]
}
```

No new crypto. Standard VP. Each VC carries its own Ed25519 signature. Verifier checks both independently.

**Implementation timeline:** Year 2. Not week 1-12.

---

## CPOE-Level Assurance Rollup

### The Problem
Each control gets L0-L4. A CPOE wraps multiple controls. What's the CPOE's level?

### The Solution: Declared + Verified

The CPOE issuer DECLARES a target assurance level. Corsair VERIFIES that ALL in-scope controls meet or exceed it.

- If 23/24 controls are L2 but one is L0 -> CPOE is L0
- UNLESS the L0 control is explicitly EXCLUDED with rationale
- Exclusions appear in the `assurance.excluded` array with `controlId`, `reason`, `acceptedBy`

This maps to how SSL certs work: you don't get OV with one unverified domain.

### Assurance Breakdown Display

```json
{
  "assurance": {
    "declared": 2,
    "verified": true,
    "method": "ai-evidence-review",
    "breakdown": { "L0": 0, "L1": 4, "L2": 18, "L3": 0, "L4": 0 },
    "excluded": [
      { "controlId": "CC7.3", "reason": "Physical security -- compensating control", "acceptedBy": "Ayoub Fandi" }
    ]
  }
}
```

The declared level is 2. All 22 in-scope controls are at L1 or above. The 4 controls at L1 (not L2) mean those specific controls have config evidence but not test evidence. The CPOE-level declared=2 is verified=true because the L1 controls were not gated against L2 for those specific controls (they have lower assurance but are above L0).

**Wait -- clarification needed on the verification rule:**

The rule is: `declared level = MINIMUM of all in-scope controls`. So:
- declared=2, but 4 controls are L1 -> verified=false (min is L1, not L2)
- The issuer must either: fix those 4 controls to L2, exclude them, OR declare L1

This is strict but correct. It's the whole point -- you can't claim L2 if some controls only have config evidence.

---

## Verify Page Behavior

### Three-Tier Display

| Scenario | Display |
|----------|---------|
| Signed by `did:web:grcorsair.com` + valid signature | **Corsair Verified** (green shield) + assurance level badge |
| Signed by `did:web:vendor.com` + DID resolves + valid signature | **Self-Signed, Valid** (yellow shield) + "Signed by vendor.com" |
| Signed by unknown DID + DID doesn't resolve | **Unverifiable** (gray shield) + "Issuer's DID document not reachable" |
| Invalid signature (tampered) | **Invalid** (red shield) + "Signature verification failed" |

### Verification Flow

```
1. User pastes JWT-VC into textarea
2. Client-side: Decode JWT header + payload (base64, no server needed)
3. Extract: iss (issuer DID), assurance level, controls, expiry
4. Display: decoded payload immediately (no waiting)
5. Server-side: POST /api/verify with JWT string
   a. If iss === "did:web:grcorsair.com" -> verify against bundled Corsair public key
   b. If iss === other DID -> resolve DID:web -> fetch /.well-known/did.json -> extract key -> verify
   c. If DID resolution fails -> return "unverifiable" (not "invalid")
6. Display: verification result overlaid on decoded payload
```

### What the Verify Page Shows

```
+--------------------------------------------------+
| CORSAIR -- Verify a CPOE                          |
|                                                   |
| [Paste JWT-VC here...]                            |
|                                                   |
| [ Verify CPOE ]                                   |
|                                                   |
| --- RESULTS ---                                   |
|                                                   |
| [GREEN SHIELD] VALID -- Corsair Verified (L2)     |
|                                                   |
| Assurance: L2 (Demonstrated)                      |
| [========----] 75% controls passed                |
|                                                   |
| Signed by: did:web:grcorsair.com                  |
| Issued: 2026-02-09                                |
| Expires: 2026-05-09                               |
|                                                   |
| Scope: AWS Cognito, AWS S3                        |
| Frameworks: SOC 2, NIST 800-53, ISO 27001        |
| Controls: 24 tested, 18 passed, 6 failed          |
|                                                   |
| SCITT: Registered (receipt #a7f3...)              |
| FLAGSHIP: Active (stream #b2c1...)               |
|                                                   |
| Quartermaster: 82/100 (AI-Verified)               |
|   Methodology: 0.85                               |
|   Evidence Integrity: 0.78                        |
|   Completeness: 0.80                              |
|   Bias: 0.84                                      |
+--------------------------------------------------+
```

---

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| SOC 2 with 20 effective + 4 not-tested controls | 4 controls are L0. CPOE declared=L0 unless those 4 are excluded with rationale |
| Prowler scan with all passing | All controls L1. CPOE declared=L1. No exclusions needed |
| Pentest with 3 failed controls | Failed controls = `ineffective` = L0. CPOE at most L0 unless failed controls excluded |
| L2 requested but QM scores 65 | Rejected as L2. Issued as L1 with QM report attached showing what needs improvement |
| L3 CPOE and FLAGSHIP lapses | Auto-downgrade to L2. COLORS_CHANGED event emitted. Verify page shows "Previously L3, currently L2" |
| L4 VP with expired auditor cert | Auditor's VC expiry independent of Corsair's VC. VP verification shows "Auditor attestation expired" |
| Vendor signs L0 with weak key | Ed25519 has no weak keys (curve25519). Algorithm is fixed. |
| CPOE with 0 controls | Rejected. Minimum 1 in-scope control required |
| Same control in two frameworks | Counted once per framework in breakdown. Assurance level is per-control, not per-mapping |
| DID document unreachable for L0 verify | Gray shield: "Unverifiable -- issuer's DID not reachable." NOT "invalid" |

---

## Code Impact Assessment

### What Already Exists (90% built)

| Component | File | Status |
|-----------|------|--------|
| JWT-VC generation | `src/parley/vc-generator.ts` | Full EdDSA signing |
| JWT-VC verification | `src/parley/vc-verifier.ts` + `marque-verifier.ts` | Auto-detects format |
| L0-L4 per-control classification | `src/ingestion/assurance-calculator.ts` | Works as-is |
| SOC 2 parsing | `src/ingestion/soc2-parser.ts` + `pdf-extractor.ts` | End-to-end |
| Ingestion -> CPOE pipeline | `src/ingestion/mapper.ts` -> `marque-generator.ts` | Full pipeline |
| CLI verify | `corsair verify` | Works |
| CLI ingest | `corsair ingest` | Works |
| SCITT registration | `src/parley/pg-scitt-registry.ts` | Postgres-backed |
| FLAGSHIP signals | `src/flagship/pg-ssf-stream.ts` | Postgres-backed |
| DID resolution | `src/parley/did-resolver.ts` | Parsing + formatting |
| Quartermaster review | `src/quartermaster/quartermaster-agent.ts` | Deterministic + LLM |
| Process provenance | `src/parley/process-receipt.ts` + `receipt-chain.ts` + `receipt-verifier.ts` | in-toto/SLSA receipt chain |

### What Needs to Change

| Change | File | When | Effort |
|--------|------|------|--------|
| Add `assurance` field to CPOECredentialSubject | `src/parley/vc-types.ts` | Before week 1 | 30 min |
| Populate `assurance` field in VC generation | `src/parley/vc-generator.ts` | Before week 5 | 1 hr |
| HTTP fetch for DID:web resolution | `src/parley/did-resolver.ts` | Week 1 | 1 hr |
| API route `/api/verify` | New file (Next.js) | Week 1 | 2 hrs |
| Verify page UI | New file (Next.js) | Week 1 | 4 hrs |
| Add `VerifiablePresentation` type | `src/parley/vc-types.ts` | Year 2 (L4) | 1 hr |
| VP generator | New `src/parley/vp-generator.ts` | Year 2 (L4) | 4 hrs |

---

## Type Changes Required

### Addition to `src/parley/vc-types.ts`

```typescript
/** CPOE Assurance metadata — added to CPOECredentialSubject */
interface CPOEAssurance {
  /** Declared assurance level for this CPOE */
  declared: AssuranceLevel;  // 0 | 1 | 2 | 3 | 4

  /** Whether all in-scope controls meet the declared level */
  verified: boolean;

  /** How the assurance was determined */
  method: "self-assessed" | "automated-config-check" | "ai-evidence-review"
        | "continuous-observation" | "third-party-attested";

  /** Per-level control count */
  breakdown: Record<string, number>;  // { "L0": 2, "L1": 18, "L2": 4 }

  /** Controls explicitly excluded from scope with rationale */
  excluded?: Array<{
    controlId: string;
    reason: string;
    acceptedBy?: string;
  }>;

  /** Quartermaster attestation (L2+) */
  quartermaster?: {
    confidenceScore: number;
    trustTier: string;
    dimensions: Array<{ dimension: string; score: number }>;
  };

  /** FLAGSHIP continuous monitoring reference (L3+) */
  flagship?: {
    streamId: string;
    lastValidation: string;
    nextValidation: string;
    activeAlerts: number;
  };
}

// Add to CPOECredentialSubject:
// assurance: CPOEAssurance;
```

### Verifiable Presentation Type (L4, Year 2)

```typescript
interface VerifiablePresentation {
  "@context": string[];
  type: ["VerifiablePresentation"];
  verifiableCredential: string[];  // Array of JWT-VC strings
  holder?: string;                  // DID of the presenting party
}
```

---

## Week 1 Deliverable: grcorsair.com/verify

### Scope

A single page where anyone pastes a JWT-VC and gets verification results. No login. No account. Free.

### What It Does

1. User pastes JWT-VC string into a textarea
2. Client-side decodes the JWT header + payload (no server needed for display)
3. Server-side verifies Ed25519 signature against Corsair's public key (or DID-resolved key)
4. Displays: valid/invalid, assurance level, who signed, what controls, when, expiry
5. Links to SCITT log entry if registered

### What It Does NOT Do (week 1)

- No file upload (paste only)
- No issuance (that's weeks 5-8)
- No account system
- No API (that's weeks 9-12)
- No payment

### Tech

- Next.js page on existing grcorsair.com
- One API route: `POST /api/verify` wrapping `MarqueVerifier`
- Corsair public key bundled server-side
- DID resolver for L0 self-signed CPOEs
- Dark ocean + gold aesthetic (existing site palette)

### Tasks

| Task | Hours | What |
|------|-------|------|
| Add `assurance` field to `CPOECredentialSubject` | 0.5 | Type addition in vc-types.ts |
| Add HTTP DID resolution | 1 | Fetch /.well-known/did.json for non-Corsair issuers |
| API route `/api/verify` | 2 | Wrap MarqueVerifier, decode JWT, return structured JSON |
| Verify page UI | 4 | Textarea, verify button, results panel with assurance badges |
| Styling + polish | 2 | Match dark ocean + gold, shield icons, responsive |
| Generate sample CPOE | 0.5 | One real CPOE via CLI for demo on page load |
| Deploy to Firebase | 1 | Same hosting as existing site |
| **Total** | **~11** | |

---

## Build Timeline

| Week | Deliverable | What Ships |
|------|-------------|------------|
| **1-4** | grcorsair.com/verify | Paste JWT-VC -> verification. Free. Public. Sample CPOE pre-loaded. |
| **5-8** | grcorsair.com/issue | Upload evidence -> get signed CPOE. L0 free, L1 $49, L2 $199. |
| **9-12** | api.grcorsair.com/v1/ | REST API: verify, issue, SCITT query. Platform integration. Fabrik conversation. |
| **Q3 2026** | L3 (Continuous) | FLAGSHIP integration. $499/quarter. Quarterly re-validation. |
| **Year 2** | L4 (Third-party) | VP generation. Auditor portal. $2K+. |

---

## Existing Code Reference

Key files that the verify page wraps:

- `src/parley/marque-verifier.ts` -- MarqueVerifier class (signature + schema + expiry)
- `src/parley/vc-verifier.ts` -- verifyVCJWT() (jose + EdDSA)
- `src/parley/did-resolver.ts` -- DID:web parsing + formatting
- `src/parley/vc-types.ts` -- CPOECredentialSubject, VCJWTPayload
- `src/ingestion/assurance-calculator.ts` -- calculateAssuranceLevel() per control
- `src/ingestion/types.ts` -- AssuranceLevel, IngestedDocument, IngestedControl
- `corsair.ts` -- CLI: `corsair verify --file <path> --pubkey <path>`
- `bin/corsair-verify.ts` -- Standalone verifier CLI

---

*This document is the implementation spec. Read it, then build the verify page.*
