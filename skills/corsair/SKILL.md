---
name: corsair
description: Cryptographic compliance verification. Sign security tool output into verifiable CPOEs (JWT-VC), verify vendor proofs via trust.txt, detect drift with diff, and assess third-party risk. Use when the user mentions compliance proofs, CPOE, trust.txt, SCITT, vendor assessment, GRC evidence, or compliance drift.
license: Apache-2.0
compatibility: Requires Corsair CLI and Bun runtime for repo scripts; network access needed for DID/trust.txt resolution.
metadata:
  author: grcorsair
  version: "2.0"
  website: https://grcorsair.com
---

# Corsair Skill v2 — Agentic Compliance Substrate

Corsair is a protocol layer that makes compliance evidence verifiable, portable, and agent-consumable. This skill provides deterministic workflows for signing, verifying, diffing, and discovering proofs without building new scanners.

Core primitives: SIGN, LOG, PUBLISH, VERIFY, DIFF, SIGNAL

---

## Capability Contract

The agent may perform these capabilities when invoked:

- `sign_cpoe(evidence_path, format?, mapping?, source?, did?, scope?, expiry_days?, sd_jwt?, sd_fields?)`
- `verify_cpoe(cpoe_path, did?, require_issuer?, require_framework?, max_age?, min_score?)`
- `diff_cpoe(current_path, previous_path, verify?)`
- `publish_trust_txt(did, cpoes?, base_url?, scitt?, catalog?, flagship?, frameworks?, contact?, expiry_days?)`
- `discover_trust_txt(domain, verify?)`
- `log_cpoes(dir?, last?, scitt?, issuer?, domain?, framework?)`
- `mappings_list()`
- `mappings_validate()`
- `mappings_add(url_or_path)`
- `vendor_assessment(domain, framework?, verify?, diff?)`

---

## Inputs

Required inputs by task:

- SIGN: evidence file path (or `-` for stdin)
- VERIFY: CPOE file path (JWT string or JSON envelope)
- DIFF: two CPOE paths (current, previous)
- PUBLISH: DID and at least one of CPOEs, SCITT, or catalog
- DISCOVER: domain
- LOG: directory or SCITT endpoint (optional)

If required input is missing, ask for it explicitly.

---

## Outputs

Return a concise summary plus a structured JSON-like result when possible.

Sign output fields:

- `cpoe_path`
- `detected_format`
- `summary.controlsTested`
- `summary.controlsPassed`
- `summary.controlsFailed`
- `summary.overallScore`
- `provenance.source`
- `warnings[]`

Verify output fields:

- `valid`
- `reason`
- `issuerTier`
- `summary`
- `evidenceChain.chainDigest`
- `processProvenance.chainDigest`

Evidence chain fields (CPOE):

- `chainType: "hash-linked"`
- `algorithm: "sha256"`
- `canonicalization: "sorted-json-v1"`
- `recordCount`
- `chainVerified`
- `chainDigest`
- `chainStartHash?`
- `chainHeadHash?`
- `chains[]?`

---

## Decision Routing

Use this routing logic:

1. If user asks to sign evidence -> SIGN workflow
2. If user asks to verify a proof -> VERIFY workflow
3. If user asks to compare changes -> DIFF workflow
4. If user asks to publish proofs -> PUBLISH workflow
5. If user asks to discover proofs -> DISCOVER workflow
6. If user asks to list proofs -> LOG workflow
7. If user asks about mappings -> MAPPINGS workflow
8. If user asks to assess a vendor -> AUDIT workflow

---

## Workflows

### SIGN

1. Identify evidence file path (or stdin).
2. Run `corsair sign --file <PATH> --verbose`
3. If format is specified: `corsair sign --file <PATH> --format <FORMAT>`
4. If mapping pack provided: `corsair sign --file <PATH> --mapping <PATH>`
5. Report: CPOE path, format, summary.

### VERIFY

1. Identify CPOE path.
2. Run `corsair verify --file <PATH>`
3. If DID validation required: `corsair verify --file <PATH> --did`
4. Report validity, issuer tier, summary.

### DIFF

1. Identify current and previous CPOE paths.
2. Run `corsair diff --current <NEW> --previous <OLD>`
3. If verify: `corsair diff --current <NEW> --previous <OLD> --verify`
4. Report regressions and score delta.

### PUBLISH (trust.txt)

1. Require DID.
2. Generate trust.txt: `corsair trust-txt generate --did <DID> [options] -o .well-known/trust.txt`
3. Report output path and hosting requirement `/.well-known/trust.txt`.

### DISCOVER

1. Require domain.
2. Run `corsair trust-txt discover <DOMAIN> [--verify]`
3. Summarize CPOEs and verification status.

### LOG

1. Optional directory or SCITT endpoint.
2. Run `corsair log [--dir <DIR>] [--scitt <URL>] [--issuer <DID>]`
3. Summarize recent CPOEs.

### MAPPINGS

- List: `corsair mappings list`
- Validate: `corsair mappings validate`
- Add: `corsair mappings add <URL_OR_PATH>`

### AUDIT (Vendor Assessment)

1. Resolve trust.txt: `corsair trust-txt discover <DOMAIN> --verify`
2. If SCITT is present, log entries: `corsair log --domain <DOMAIN> --framework <FRAMEWORK>`
3. If multiple CPOEs available, diff: `corsair diff --current <NEW> --previous <OLD> --verify`
4. Report risk summary with evidence.

---

## Trust Center Resolution Flow

1. Fetch `https://<DOMAIN>/.well-known/trust.txt`
2. Validate DID and URLs
3. Discover CPOE URLs, SCITT endpoint, catalog, and FLAGSHIP
4. Verify each CPOE signature if requested
5. Summarize results and highlight missing proofs

---

## Error Handling

Common failures and responses:

- Missing file path -> ask for path
- Invalid JSON -> report parse error and request correct file
- DID resolution failed -> report and suggest `--did` or `--require-issuer`
- CPOE expired -> report with expiry timestamp
- Evidence chain unverified -> report `chainVerified=false`

---

## Security and Privacy

- Never expose secrets from evidence or environment variables.
- Prefer evidence-only mappings when controls are sensitive.
- Use SD-JWT for selective disclosure when requested.

---

## Examples

Sign evidence:
`corsair sign --file prowler-results.json --format prowler`

Verify:
`corsair verify --file cpoe.jwt --did`

Discover:
`corsair trust-txt discover acme.com --verify`
