# Week 1 Implementation Plan — Verify Page Backend

**Date**: February 9, 2026
**Goal**: Backend ready to power `grcorsair.com/verify` — paste a JWT-VC, get full verification result
**Constraint**: 15-20 hrs/week. This plan covers ~11 hrs of backend work.

---

## Overview

The verify page is the #1 priority from the redesign spec. It makes CPOEs visible, creates demand, and requires zero login/account. This week focuses on the **backend changes** that make verification meaningful — adding assurance levels, provenance, and DID-based key resolution.

The frontend (Next.js page on grcorsair.com) comes after the backend is solid.

---

## Deliverables

By end of week 1:
1. `CPOECredentialSubject` type has `assurance` and `provenance` fields
2. VC generator populates assurance + provenance from ingestion data
3. VC verifier returns rich result (assurance level, provenance, issuer tier)
4. DID-based verification works (resolve did:web → fetch key → verify)
5. A real example CPOE generated and verifiable via CLI
6. All existing tests still pass + new tests for new fields

---

## Task Breakdown (ordered by dependency)

### Task 1: Update `vc-types.ts` — Add assurance + provenance types (~1 hr)

**File**: `src/parley/vc-types.ts`

**What to add** (after line 124, before JWT-VC types):

```typescript
// =============================================================================
// ASSURANCE & PROVENANCE TYPES
// =============================================================================

/** Assurance level — L0 (Documented) through L4 (Attested) */
export type AssuranceLevel = 0 | 1 | 2 | 3 | 4;

/** Human-readable assurance level names */
export const ASSURANCE_NAMES: Record<AssuranceLevel, string> = {
  0: "Documented",
  1: "Configured",
  2: "Demonstrated",
  3: "Observed",
  4: "Attested",
};

/** Assurance metadata for a CPOE */
export interface CPOEAssurance {
  /** Declared assurance level (0-4). Min of all in-scope controls. */
  declared: AssuranceLevel;
  /** Has the declared level been verified against all controls? */
  verified: boolean;
  /** Method used to establish assurance */
  method:
    | "self-assessed"
    | "automated-config-check"
    | "ai-evidence-review"
    | "continuous-observation"
    | "third-party-attested";
  /** Count of controls at each level: { "0": 2, "1": 18 } */
  breakdown: Record<string, number>;
  /** Controls explicitly excluded from scope */
  excluded?: Array<{
    controlId: string;
    reason: string;
    acceptedBy?: string;
  }>;
}

/** Evidence provenance — who produced the underlying evidence */
export interface CPOEProvenance {
  /** Source authority type */
  source: "self" | "tool" | "auditor";
  /** Identity of source (e.g., "Deloitte LLP", "Prowler v3.1") */
  sourceIdentity?: string;
  /** SHA-256 hash of the source document */
  sourceDocument?: string;
  /** Date of source assessment (ISO 8601) */
  sourceDate?: string;
}
```

**What to change on `CPOECredentialSubject`**:

```typescript
export interface CPOECredentialSubject extends CredentialSubject {
  type: "CorsairCPOE";

  // CHANGED: scope from object to string (human-readable at launch)
  scope: string;

  // NEW: assurance metadata (required)
  assurance: CPOEAssurance;

  // NEW: evidence provenance (required)
  provenance: CPOEProvenance;

  // KEPT: summary
  summary: { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number; };

  // CHANGED: now optional (document ingestion has no evidence chain)
  evidenceChain?: { hashChainRoot: string; recordCount: number; chainVerified: boolean; };

  // CHANGED: now optional
  frameworks?: Record<string, { controlsMapped: number; passed: number; failed: number; controls: Array<{ controlId: string; status: "passed" | "failed" | "not-tested" }> }>;

  threatModel?: { ... };  // KEPT optional, unchanged
  quartermasterAttestation?: { ... };  // KEPT optional, unchanged
}
```

**Test file**: `tests/parley/vc-types.test.ts` — Add tests for new types, update existing tests that construct `CPOECredentialSubject` to include `assurance` and `provenance`.

---

### Task 2: Update `vc-generator.ts` — Populate assurance + provenance (~2 hrs)

**File**: `src/parley/vc-generator.ts`

**Change**: `buildCredentialSubject()` function (lines 91-185).

**Logic for `assurance`**:
- If `input.document` exists (ingestion path), use `calculateDocumentAssurance()` to get per-control levels
- `declared` = min of all control assurance levels
- `method` = map from `DocumentSource`: soc2/iso27001 → "self-assessed", prowler/securityhub → "automated-config-check", pentest → "ai-evidence-review"
- `breakdown` = count controls at each level
- `verified` = true if all controls meet or exceed declared level

**Logic for `provenance`**:
- If `input.document` exists, derive from `document.metadata`:
  - `source` = "auditor" for soc2/iso27001, "tool" for prowler/securityhub/pentest, "self" for manual
  - `sourceIdentity` = `metadata.auditor || metadata.issuer`
  - `sourceDocument` = `metadata.rawTextHash`
  - `sourceDate` = `metadata.date`
- If legacy input (no document), use defaults: `{ source: "tool", sourceIdentity: input.issuer.name }`

**Logic for `scope`**:
- Change from object to string: `input.document?.metadata.scope || input.providers.join(", ")`

**Add import**: `import { calculateDocumentAssurance } from "../ingestion/assurance-calculator";`

**Test file**: `tests/parley/vc-generator.test.ts` — Update existing tests, add test for assurance population from IngestedDocument.

---

### Task 3: Update `MarqueGeneratorInput` — carry document through (~30 min)

**File**: `src/parley/marque-generator.ts`

The `MarqueGeneratorInput` already has `document?: IngestedDocument` (line 41). Verify the `mapToMarqueInput` in `src/ingestion/mapper.ts` passes the document through.

**Change in `mapper.ts`**: Add `document: doc` to the return object in `mapToMarqueInput()`:

```typescript
return {
  document: doc,           // NEW: pass through for assurance/provenance extraction
  markResults,
  raidResults: [],
  chartResults,
  evidencePaths: [],
  issuer,
  providers: [`${doc.source}-document`],
};
```

**Test file**: `tests/ingestion/mapper.test.ts` — verify document passthrough.

---

### Task 4: Enrich `MarqueVerificationResult` — return assurance info (~1 hr)

**File**: `src/parley/marque-verifier.ts` + `src/parley/vc-verifier.ts`

**Extend `MarqueVerificationResult`**:

```typescript
export interface MarqueVerificationResult {
  valid: boolean;
  reason?: "signature_invalid" | "expired" | "schema_invalid" | "evidence_mismatch";
  signedBy?: string;
  generatedAt?: string;
  expiresAt?: string;
  // NEW: extracted from verified VC payload
  assuranceLevel?: number;
  assuranceName?: string;
  provenance?: { source: string; sourceIdentity?: string; sourceDate?: string };
  scope?: string;
  summary?: { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number };
  // NEW: issuer trust tier
  issuerTier?: "corsair-verified" | "self-signed" | "unverifiable" | "invalid";
}
```

**Change in `vc-verifier.ts`**: After successful signature verification (line 88), extract CPOE claims from `verifiedVc.credentialSubject`:

```typescript
const cs = verifiedVc.credentialSubject as Record<string, unknown>;
return {
  valid: true,
  signedBy,
  generatedAt,
  expiresAt,
  assuranceLevel: (cs?.assurance as any)?.declared,
  assuranceName: ASSURANCE_NAMES[(cs?.assurance as any)?.declared as AssuranceLevel],
  provenance: cs?.provenance as any,
  scope: cs?.scope as string,
  summary: cs?.summary as any,
  issuerTier: determineIssuerTier(payload),
};
```

**New helper `determineIssuerTier()`**:
- If `iss` starts with `did:web:grcorsair.com` → "corsair-verified"
- If `iss` starts with `did:web:` → "self-signed"
- Else → "unverifiable"

**Test file**: `tests/parley/vc-verifier.test.ts` — Test that verification result includes assurance/provenance/tier.

---

### Task 5: Add DID-based verification path (~2 hrs)

**File**: New function in `src/parley/vc-verifier.ts`

Currently `verifyVCJWT()` takes `trustedKeys: Buffer[]` — the caller must already have the keys. For the verify page, we need a function that resolves keys from the JWT's `kid` DID.

**New function**:

```typescript
/**
 * Verify a JWT-VC by resolving the issuer's public key via DID:web.
 * This is the "zero-trust" verification path — no pre-loaded keys needed.
 */
export async function verifyVCJWTViaDID(
  jwt: string,
  fetchFn?: typeof fetch,
): Promise<MarqueVerificationResult> {
  // 1. Decode header to get kid (DID URL)
  const header = decodeProtectedHeader(jwt);
  const kid = header.kid;
  if (!kid) return { valid: false, reason: "schema_invalid", issuerTier: "unverifiable" };

  // 2. Extract DID from kid (kid format: "did:web:domain#key-1")
  const did = kid.split("#")[0];

  // 3. Resolve DID document
  const { resolveDIDDocument } = await import("./did-resolver");
  const resolution = await resolveDIDDocument(did, fetchFn);

  if (!resolution.didDocument) {
    return { valid: false, reason: "schema_invalid", issuerTier: "unverifiable" };
  }

  // 4. Find the verification method matching kid
  const vm = resolution.didDocument.verificationMethod.find(m => m.id === kid);
  if (!vm?.publicKeyJwk) {
    return { valid: false, reason: "signature_invalid", issuerTier: "unverifiable" };
  }

  // 5. Import JWK and verify
  const { importJWK } = await import("jose");
  const publicKey = await importJWK(vm.publicKeyJwk, "EdDSA");

  // 6. Verify JWT
  try {
    const { payload } = await jwtVerify(jwt, publicKey);
    // ... extract claims, return rich result
  } catch {
    return { valid: false, reason: "signature_invalid", issuerTier: "invalid" };
  }
}
```

**Test file**: `tests/parley/vc-verifier.test.ts` — Test with mock fetch that returns a DID document.

---

### Task 6: Generate example CPOE (~1 hr)

**File**: `bin/generate-first-cpoe.ts` (already exists as untracked)

Generate a realistic CPOE from mock SOC 2 data:
- 24 controls, 22 effective, 2 ineffective
- Assurance: L1 (Configured) — from SOC 2 document with evidence
- Provenance: `{ source: "auditor", sourceIdentity: "Example Audit Firm", sourceDate: "2026-01-15" }`
- Scope: "SOC 2 Type II — Acme Cloud Platform"
- Sign with a test keypair
- Output: `examples/example-cpoe.jwt` (the JWT-VC string)
- Output: `examples/example-cpoe-decoded.json` (pretty-printed payload for reference)

**Also**: Generate `examples/did.json` — the DID document that would live at `grcorsair.com/.well-known/did.json`

---

### Task 7: Update existing tests (~2 hrs)

All tests that construct `CPOECredentialSubject` must be updated to include `assurance` and `provenance`. Key files:

| Test File | Changes |
|-----------|---------|
| `tests/parley/vc-types.test.ts` | Add tests for new types |
| `tests/parley/vc-generator.test.ts` | Update mock input, test assurance population |
| `tests/parley/vc-verifier.test.ts` | Test rich verification result, add DID-based test |
| `tests/parley/marque-generator.test.ts` | Update MarqueGeneratorInput construction |
| `tests/parley/marque-verifier.test.ts` | Test that assurance flows through |
| `tests/parley/marque-oscal-mapper.test.ts` | Update mock CPOE subject |
| `tests/ingestion/mapper.test.ts` | Test document passthrough |

**Verification**: `bun test` — all 403 non-Postgres tests must pass, plus new tests.

---

## Dependency Graph

```
Task 1 (vc-types)
  ├── Task 2 (vc-generator) — depends on Task 1
  │     └── Task 3 (mapper passthrough) — depends on Task 2
  ├── Task 4 (verification result) — depends on Task 1
  │     └── Task 5 (DID verification) — depends on Task 4
  └── Task 7 (update tests) — depends on Tasks 1-5
        └── Task 6 (example CPOE) — depends on Tasks 1-5
```

**Critical path**: Task 1 → Task 2 → Task 4 → Task 5 → Task 7 → Task 6

---

## Files Changed (Summary)

| File | Action | Lines ~Changed |
|------|--------|---------------|
| `src/parley/vc-types.ts` | Add types, modify CPOECredentialSubject | +60, ~30 |
| `src/parley/vc-generator.ts` | Populate assurance/provenance in buildCredentialSubject | +40, ~20 |
| `src/parley/vc-verifier.ts` | Enrich result + add DID verification function | +80 |
| `src/parley/marque-verifier.ts` | Extend MarqueVerificationResult type | +10 |
| `src/ingestion/mapper.ts` | Pass document through to MarqueGeneratorInput | +1 |
| `bin/generate-first-cpoe.ts` | Generate example CPOE | ~100 (new/rewrite) |
| 7 test files | Update mocks + add new tests | ~200 |
| **Total** | | **~540 lines** |

## Files NOT Changed (explicitly deferred)

- `src/flagship/` — Real-time signals. No subscribers yet.
- `src/parley/scitt-*` — SCITT runs silently. No user-facing changes.
- `src/parley/cbor.ts`, `cose.ts`, `merkle.ts` — Infrastructure layer. Not user-facing.
- `src/db/migrations/005_multi_tenancy.sql` — No users yet. Stays untracked.
- `README.md` — Rewrite after backend is done, not before.
- `corsair.ts` CLI — Existing `verify` and `ingest` commands work. No changes needed yet.

---

## Definition of Done

- [ ] `bun test` passes (403+ tests, 0 failures excluding Postgres)
- [ ] New CPOE generated with assurance + provenance fields
- [ ] `bun run bin/corsair-verify.ts examples/example-cpoe.jwt` shows assurance level + provenance
- [ ] DID-based verification works with mock fetch
- [ ] No new dependencies added (only existing: jose, @anthropic-ai/sdk)
