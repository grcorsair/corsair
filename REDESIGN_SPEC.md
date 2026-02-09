# Corsair Redesign Spec — Compliance Trust Exchange Protocol

**Date**: February 9, 2026
**Status**: Synthesized from 8 rounds of strategic elimination + 3 deep research reports
**Author**: Ayoub + Arudjreis

---

## 1. Identity (What Survived Elimination)

Eight rounds of stress-testing killed every product framing except one:

| Round | Framing Tested | Verdict | Why |
|-------|---------------|---------|-----|
| 1 | AI document rating | KILLED | Any AI tool + Claude = same analysis. Zero moat. |
| 2 | Opinionated assurance engine | KILLED | Still just "AI + opinions." Commoditized. |
| 3 | Offensive chaos engineering (old Corsair) | KILLED | Crowded (9+ tools), solo founder can't maintain 100+ plugins. |
| 4 | Wrapper around Nuclei/offensive tools | KILLED | Competing on two fronts. Doubled surface area + liability. |
| 5 | Defensive telemetry reader | KILLED | That's literally what Vanta/Drata do. Zero moat. |
| 6 | Crypto-as-feature on GRC platform | KILLED | Crypto solves verifiability, not assurance. Not enough alone. |
| 7 | Protocol for trust centers | REFINED | Fabrik saves SOC 2s. Sustaining innovation trap. |
| **8** | **Inter-company compliance trust exchange PROTOCOL** | **SURVIVED** | **Nobody builds the format. Everyone moves old documents through proprietary platforms.** |

### The One-Line Identity

**Corsair is the open protocol for machine-readable, cryptographically verifiable compliance attestations.**

- **Vanta is Salesforce** (manages compliance within orgs). **Corsair is SMTP** (moves trust between orgs).
- Corsair does not compete with GRC platforms. GRC platforms are customers.
- The CPOE format is the product. Verification is free. Issuance is paid.

### The Dave Winer / RSS Precedent

Solo content creator defines an open format. Distributes through existing audience (30K LinkedIn). Format becomes the standard because it solves a concrete pain (stop emailing SOC 2 PDFs). Independent implementations emerge because the spec is simple enough.

---

## 2. What the Protocol Is

### Three-Standard Composition (Parley)

| Standard | Status | Role | Corsair Integration |
|----------|--------|------|-------------------|
| **JWT-VC** (W3C VC 2.0) | W3C Recommendation (May 2025) | Attestation envelope | CPOE is a Verifiable Credential, Ed25519-signed |
| **SSF/CAEP** (OpenID) | Final Spec (Sept 2025), 8 production impls | Real-time signals | FLAGSHIP module signals compliance changes |
| **SCITT** (IETF) | Internet-Draft (draft-22), near-zero production | Transparency log | Postgres-backed registry, log from day one |

**Nobody has shipped W3C Verifiable Credentials for compliance attestations (SOC 2, ISO 27001, pentest results). Corsair would be first.**

### Minimum Viable CPOE (What Ships at Launch)

```
Header:  { "alg": "EdDSA", "typ": "vc+jwt" }
Payload: {
  "iss": "did:web:grcorsair.com",
  "sub": "did:web:example.com",
  "iat": 1707436800,
  "exp": 1715212800,
  "vc": {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/v1"],
    "type": ["VerifiableCredential", "CorsairCPOE"],
    "credentialSubject": {
      "type": "CorsairCPOE",
      "scope": "SOC 2 Type II — Acme Cloud Platform",
      "assurance": {
        "declared": 1,
        "method": "automated-config-check",
        "breakdown": { "0": 2, "1": 18, "2": 4 }
      },
      "provenance": {
        "source": "auditor",
        "sourceIdentity": "Deloitte LLP",
        "sourceDocument": "sha256:abc123..."
      },
      "summary": {
        "controlsTested": 24,
        "controlsPassed": 22,
        "controlsFailed": 2,
        "overallScore": 91.7
      }
    }
  },
  "parley": "2.0"
}
Signature: Ed25519
```

### Verification Flow (4 Steps, Standard Libraries)

```
1. Decode JWT (split on '.', base64-decode)
2. Fetch issuer's public key (HTTP GET did:web URL → .well-known/did.json)
3. Verify Ed25519 signature
4. Read claims
```

**The test**: Can a developer verify a CPOE in under 30 minutes using existing JWT libraries? If yes, the protocol is simple enough.

---

## 3. L0-L4 Assurance Ladder

### Core Rule

> A CPOE's assurance level = the **declared** level, verified against ALL in-scope controls. No control may be below the declared level unless explicitly excluded with rationale.

This is the SSL certificate model: declare OV, the CA verifies every domain. One unverified domain = rejected.

### Tiers

| Tier | Name | Who Signs | Evidence Required | Price |
|------|------|-----------|-------------------|-------|
| **L0** | Documented | Vendor (self-signed) | Policy docs only | Free |
| **L1** | Configured | Corsair | Config screenshots/exports, non-manual source | $49 |
| **L2** | Demonstrated | Corsair + Quartermaster | Test results + AI review (confidence >= 70) | $199 |
| **L3** | Observed | Corsair + FLAGSHIP | Continuous monitoring, re-validation within 90d | $499/qtr |
| **L4** | Attested | Corsair + Auditor | VP bundling Corsair VC + Auditor VC | $2K+ |

### Key Design Decision: L0 = "Documented" (Not "Claimed")

A SOC 2 report from Deloitte is a PDF (lowest crypto level) but from an auditor (highest authority). L0-L4 measures **cryptographic verifiability**, not trust. The `provenance` field captures authority separately.

### Three-Tier Verify Display

| Display | Condition | Icon |
|---------|-----------|------|
| **Corsair Verified** | Signed by Corsair (L1+), methodology-backed | Green shield |
| **Self-Signed Valid** | Valid signature, unknown/self issuer (L0) | Blue padlock |
| **Unverifiable** | No DID resolution possible | Gray question |
| **Invalid** | Tampered, expired, or bad signature | Red X |

---

## 4. Codebase Assessment (What To Keep / Change / Defer)

### KEEP (80% of codebase is aligned)

| Module | Files | LOC | Status |
|--------|-------|-----|--------|
| `src/parley/` | 19 | 3,606 | Production-ready protocol layer |
| `src/flagship/` | 6 | 975 | Correctly implements SSF/CAEP |
| `src/ingestion/` | 8 | 1,133 | PDF → IngestedDocument pipeline |
| `src/quartermaster/` | 5 | 1,012 | AI governance with adversarial evals |
| `src/chart/` | 2 | ~400 | Framework mapping |
| `src/evidence.ts` | 1 | ~200 | SHA-256 hash chain |
| `src/db/` | 6 | ~600 | Bun.sql + 4 migrations |
| `functions/` | 5 | ~500 | Railway endpoints |
| `tests/` | 47 | ~8K | 556 tests, 403 passing |

### CHANGE (Critical path for verify page)

| File | Change | Priority | Effort |
|------|--------|----------|--------|
| `src/parley/vc-types.ts` | Add `assurance` and `provenance` fields to `CPOECredentialSubject` | P0 | 1 hr |
| `src/parley/vc-generator.ts` | Populate `assurance` + `provenance` in `buildCredentialSubject()` | P0 | 2 hrs |
| `src/parley/marque-verifier.ts` | Extract + display assurance from verified JWT-VC | P0 | 1 hr |
| `src/ingestion/mapper.ts` | Propagate per-control `assuranceLevel` to CPOE output | P1 | 2 hrs |
| `src/parley/did-resolver.ts` | Add HTTP fetch for `did:web` resolution (currently parse-only) | P1 | 3 hrs |
| `src/types.ts` | Add `ASSURANCE_LEVELS`, `ASSURANCE_NAMES` constants | P1 | 30 min |
| `README.md` | Rewrite for v0.3.0 identity (compliance proof infrastructure) | P2 | 3 hrs |

### DEFER (Not needed for first user)

| Feature | Current Status | Why Defer |
|---------|---------------|-----------|
| SD-JWT selective disclosure | Designed, not built | No user requesting it yet |
| SCITT registration in verify flow | Postgres registry built | Run silently, don't require for verification |
| FLAGSHIP in verify flow | SSF/CAEP built | Need subscriber base first |
| L3/L4 tiers | Spec'd | L0-L2 sufficient for initial market |
| Multi-tenancy (005 migration) | 774 lines SQL, untracked | No users yet. Causes 31 test failures. |
| Verifiable Presentations | Designed for L4 | Year 2 |
| Multi-issuer verification | Architecture supports it | Start with Corsair as sole issuer |

### ALREADY DELETED (v0.3.0 cleanup was correct)

Old chaos engineering (RECON, RAID, ESCAPE, SPYGLASS, plugins, MCP server, agents, ISC system, work manager) — ~116 files, 31K lines. Properly removed. No remnants in codebase.

---

## 5. Type Changes Required

### New Types (add to `src/parley/vc-types.ts`)

```typescript
/** Assurance level — L0 through L4 */
export type AssuranceLevel = 0 | 1 | 2 | 3 | 4;

/** Assurance metadata attached to every CPOE */
export interface CPOEAssurance {
  /** Declared assurance level (0-4) */
  declared: AssuranceLevel;

  /** Has the declared level been verified against all in-scope controls? */
  verified: boolean;

  /** Method used to establish this assurance level */
  method:
    | "self-assessed"
    | "automated-config-check"
    | "ai-evidence-review"
    | "continuous-observation"
    | "third-party-attested";

  /** Count of controls at each level: { "0": 2, "1": 18, "2": 4 } */
  breakdown: Record<string, number>;

  /** Controls explicitly excluded from the assessment */
  excluded?: Array<{
    controlId: string;
    reason: string;
    acceptedBy?: string;
  }>;
}

/** Provenance — who produced the underlying evidence (independent of crypto level) */
export interface CPOEProvenance {
  /** Source authority */
  source: "self" | "tool" | "auditor";

  /** Identity of the source (e.g., "Deloitte LLP", "Prowler v3.1") */
  sourceIdentity?: string;

  /** SHA-256 hash of the source document */
  sourceDocument?: string;

  /** Date of the source assessment */
  sourceDate?: string;
}
```

### Updated `CPOECredentialSubject`

```typescript
export interface CPOECredentialSubject extends CredentialSubject {
  type: "CorsairCPOE";

  /** Assessment scope (simplified for launch) */
  scope: string;                                        // CHANGED: was object, now string

  /** Assurance metadata — NEW */
  assurance: CPOEAssurance;

  /** Evidence provenance — NEW */
  provenance: CPOEProvenance;

  /** Assessment summary */
  summary: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };

  /** Evidence chain metadata */
  evidenceChain?: {                                     // CHANGED: now optional
    hashChainRoot: string;
    recordCount: number;
    chainVerified: boolean;
  };

  /** Per-framework results */
  frameworks?: Record<string, {                         // CHANGED: now optional
    controlsMapped: number;
    passed: number;
    failed: number;
    controls: Array<{
      controlId: string;
      status: "passed" | "failed" | "not-tested";
    }>;
  }>;

  /** Quartermaster attestation */
  quartermasterAttestation?: {
    confidenceScore: number;
    trustTier: string;
    dimensions: Array<{ dimension: string; score: number }>;
  };
}
```

Key changes:
- `scope` simplified from object to string (for human readability at launch)
- `assurance` added (required — every CPOE must declare a level)
- `provenance` added (required — every CPOE must state its evidence source)
- `evidenceChain` made optional (document ingestion has no JSONL chain)
- `frameworks` made optional (keep for framework mapping, but not required)

---

## 6. First Principles Constraints (What The Research Proved)

### MUST Do

1. **Ship the verify page before anything else.** Public, free, no login. This is the Chrome padlock — makes CPOEs visible. Target: 2 weeks.

2. **Keep the core spec to one page.** JWT-VC with 6-8 top-level claims. If a developer can't verify a CPOE using `jose` (JS) or `PyJWT` (Python), the format has failed.

3. **Publish the methodology for each assurance level.** L0 means X, L1 means Y. Public, specific, versioned. Trust comes from methodology transparency, not cryptographic sophistication.

4. **Position CPOE as a layer on existing artifacts, not a replacement.** "Your SOC 2 + a CPOE" is adoptable. "Replace your SOC 2 with a CPOE" is a fight you cannot win.

5. **Have one undeniable first use case.** "Share your SOC 2 compliance status via a verification link instead of emailing PDFs."

### SHOULD Do

1. Run SCITT transparency log from day one (even if nobody looks at it — value compounds with time).
2. Write a Python verification example (20 lines — proves the spec is simple enough).
3. Integrate with one vendor risk platform within 6 months (Fabrik conversation).
4. Create a "CPOE badge" for trust pages (like the SSL padlock).

### MUST NOT Do

1. **MUST NOT require CBOR/COSE for primary CPOE verification.** Fine for SCITT receipts (infrastructure layer), but user-facing format = pure JWT.
2. **MUST NOT submit to standards body before 1,000 CPOEs in production.** Standards bodies formalize what works — they don't create adoption.
3. **MUST NOT build multi-tenancy before the verify page is live.** The 005_multi_tenancy.sql is a signal — resist the pull toward infrastructure without users.
4. **MUST NOT make issuance require understanding the protocol.** Upload SOC 2 PDF, click button, get CPOE. Users don't need to know what JWT-VC means.
5. **MUST NOT position as an AI compliance analysis company.** Intelligence commoditizes, infrastructure compounds.
6. **MUST NOT add features before users request them.** SD-JWT, FLAGSHIP, Verifiable Presentations — build when asked, not before.

---

## 7. Protocol Adoption Strategy

### The Let's Encrypt Bootstrap Model

| Let's Encrypt | Corsair Equivalent |
|--------------|-------------------|
| Free DV certs | Free L0 CPOEs (self-sign) + free verification |
| ACME protocol (simple, opinionated) | Parley protocol (JWT-VC + DID:web, 4-step verify) |
| Chrome "Not Secure" warning | Verify page showing "Unverifiable" for raw PDFs |
| Certbot reference client | `corsair verify` CLI + `grcorsair.com/verify` |
| Certificate Transparency logs | SCITT transparency log |

### 90-Day Build Sequence

**Month 1: Verify Page (Make CPOEs Visible)**
- `grcorsair.com/verify` — paste JWT-VC, see verification result
- `grcorsair.com/.well-known/did.json` — Corsair DID document
- One-page CPOE spec on website
- One example CPOE from realistic SOC 2 data
- Blog post: "What is a CPOE?"

**Month 2: Issue Flow (Make CPOEs Easy)**
- `grcorsair.com/issue` — upload SOC 2 report, get L0/L1 CPOE
- Shareable verification links (`grcorsair.com/verify?jwt=...`)
- LinkedIn content explaining the format (30K audience)
- Methodology document for L0-L2

**Month 3: API + First Integration**
- `api.grcorsair.com/v1/verify` and `/v1/issue` endpoints
- Fabrik conversation (first platform partner)
- Python verification example (10-20 lines)
- SCITT log browsable (but not required for verification)

---

## 8. Competitive Landscape

| Player | What They Do | Why Not a Threat |
|--------|-------------|-----------------|
| **Fabrik** | Moves existing docs through proprietary platform | Distribution partner, not competitor. "They build the highway, you build the vehicle." |
| **Whistic** | Trust center + document sharing | Proprietary platform. No format innovation. |
| **SafeBase/Drata** | Trust centers + compliance automation | Manages compliance within orgs. CPOE moves trust between orgs. |
| **Conveyor** | AI-powered questionnaire responses | Automates existing process. Doesn't create new format. |
| **Vanta/Drata** | Compliance platforms | Prepares evidence. Corsair proves and exchanges it. |

**The gap**: ALL players move existing documents through proprietary platforms. NONE build a new, open, machine-readable format. The CPOE format itself is the moat — once adopted, it creates network effects that proprietary platforms cannot replicate.

### Agent-to-Agent Forcing Function (2027-2028)

AI agents performing vendor risk assessment cannot process PDFs efficiently. They need machine-readable, verifiable attestations. CPOEs become the agent-native compliance format. This is not a feature — it is the reason the protocol wins long-term.

### FedRAMP OSCAL Mandate (September 2026)

Machine-readable compliance packages REQUIRED for FedRAMP. CPOE as a trust envelope around OSCAL assessment results rides this mandate. Timing: Corsair can be the first to wrap OSCAL in a signed, verifiable envelope.

---

## 9. What Success Looks Like

### 30 Days
- Verify page live at `grcorsair.com/verify`
- One real CPOE verifiable by anyone
- DID:web endpoint serving Corsair public key
- Blog post explaining CPOEs to 30K LinkedIn audience

### 90 Days
- Issue flow producing L0/L1 CPOEs from SOC 2 uploads
- API endpoints for programmatic verify/issue
- First platform partner conversation (Fabrik)
- SCITT log running with real entries

### 12 Months
- 1,000+ CPOEs in production
- 3+ platforms embedding verification
- Python verification library (community or self-built)
- L2 tier with Quartermaster review live
- CPOE mentioned in GRC conference talks

### 24 Months
- Independent CPOE verification implementations
- L3 continuous monitoring tier
- L4 auditor co-signing
- Standards body informal engagement
- "CPOE-verified" as a recognized status in vendor risk

---

## 10. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-engineering before first user | Fatal — delays everything | Ship verify page in 2 weeks. Defer all non-essential features. |
| Format too complex for independent implementations | High — stays proprietary | One-page spec. Verify with existing JWT libraries. |
| No adoption despite good protocol | High — protocol without users is nothing | Piggyback on existing document flows. CPOE wraps SOC 2, doesn't replace it. |
| Competitor ships similar format first | Medium — first mover advantage lost | Speed. Content business (30K audience) = distribution advantage. |
| Premature standardization | Medium — committee capture | No standards body until 1,000 CPOEs in production. |
| Solo founder burnout (15-20 hrs/week) | Medium — pace must be sustainable | Focus ruthlessly. One feature at a time. GitLab FT = infinite runway. |
