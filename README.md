<div align="center">

<img src="assets/corsair-logo.gif" alt="Corsair — Verify Proof. Not Promises." width="505"/>

<br/>

**Your security tools already know if your controls work. Nobody can verify that. Until now.**

<br/>

![Tests](https://img.shields.io/github/actions/workflow/status/arudjreis/corsair/test.yml?style=for-the-badge&label=TESTS&labelColor=0A0E17&color=2ECC71)
![Version](https://img.shields.io/badge/v0.5.1-D4A853?style=for-the-badge&label=VERSION&labelColor=0A0E17)
![License](https://img.shields.io/badge/Apache_2.0-D4A853?style=for-the-badge&label=LICENSE&labelColor=0A0E17)
![Runtime](https://img.shields.io/badge/Bun-E8E2D6?style=for-the-badge&label=RUNTIME&labelColor=0A0E17&logo=bun&logoColor=E8E2D6)
![Language](https://img.shields.io/badge/TypeScript-D4A853?style=for-the-badge&label=LANG&labelColor=0A0E17&logo=typescript&logoColor=D4A853)

<br/>

![JWT-VC](https://img.shields.io/badge/JWT--VC-W3C-D4A853?style=flat-square&labelColor=1a1a2e)
![DID:web](https://img.shields.io/badge/DID%3Aweb-Decentralized_ID-7FDBCA?style=flat-square&labelColor=1a1a2e)
![Ed25519](https://img.shields.io/badge/Ed25519-Signatures-2ECC71?style=flat-square&labelColor=1a1a2e)
![SCITT](https://img.shields.io/badge/SCITT-IETF-D4A853?style=flat-square&labelColor=1a1a2e)
![SSF/CAEP](https://img.shields.io/badge/SSF%2FCAEP-OpenID-7FDBCA?style=flat-square&labelColor=1a1a2e)

<br/>

[Website](https://grcorsair.com) · [Documentation](https://grcorsair.com/docs) · [CPOE Spec](CPOE_SPEC.md) · [Verify a CPOE](https://grcorsair.com/marque)

</div>

<br/>

---

## The Problem

Compliance trust today is exchanged via PDF. SOC 2 reports, pentest results, ISO 27001 certificates — emailed as attachments, stored in shared drives, re-requested every quarter. They are **machine-unreadable**, **unverifiable**, and **impossible to validate** without trusting the sender.

## The Solution

**CORSAIR** signs tool output as a **CPOE** (Certificate of Proof of Operational Effectiveness) — a [W3C Verifiable Credential](https://www.w3.org/TR/vc-data-model-2.0/) with an Ed25519 signature. Prowler says PASS, Corsair signs "Prowler said PASS." The tool's finding, signed, verifiable.

A CPOE is:
- **Machine-readable** — structured JSON, not a PDF
- **Cryptographically verifiable** — Ed25519 signature, anyone can check
- **Provenance-tracked** — records who produced the evidence, not just what it says

Anyone can verify a CPOE. Free to check. No account required. Four steps with any JWT library.

---

## Quick Start

```bash
# Install
git clone https://github.com/Arudjreis/corsair.git && cd corsair && bun install

# Generate signing keys
bun run corsair.ts keygen --output ./keys

# Sign your Prowler scan as a CPOE
bun run corsair.ts sign --file prowler-findings.json

# Verify any CPOE (always free)
bun run corsair.ts verify --file cpoe.jwt
```

---

## Five Primitives

Corsair does five things. Like git.

| Primitive | Command | What It Does | Analogy |
|:----------|:--------|:-------------|:--------|
| **SIGN** | `corsair sign --file <path>` | Parse tool output, record provenance, sign JWT-VC | `git commit` |
| **VERIFY** | `corsair verify --file <cpoe.jwt>` | Verify Ed25519 signature via DID:web | `git verify-commit` |
| **DIFF** | `corsair diff --current <new> --previous <old>` | Compare two CPOEs, detect regressions | `git diff` |
| **LOG** | `corsair log` | Query SCITT transparency log | `git log` |
| **KEYGEN** | `corsair keygen --output <dir>` | Generate Ed25519 signing keypair | `ssh-keygen` |

### Sign Options

```bash
corsair sign --file evidence.json              # Auto-detect format, sign
corsair sign --file evidence.json --format prowler  # Force format
corsair sign --file evidence.json --json       # Structured JSON output
corsair sign --file evidence.json --dry-run    # Preview without signing
corsair sign --file evidence.json --score      # Include evidence quality score
corsair sign --file evidence.json --sd-jwt     # SD-JWT selective disclosure
corsair sign --file evidence.json --sd-jwt --sd-fields scope  # Disclose only scope
corsair sign --file - < data.json              # Sign from stdin
```

---

## Supported Formats

Corsair auto-detects evidence format from JSON structure. Override with `--format <name>`.

| Format | Tool | Detection |
|:-------|:-----|:----------|
| `generic` | Any JSON with `{ metadata, controls[] }` | Default fallback |
| `prowler` | AWS Prowler OCSF | Array with `StatusCode` + `FindingInfo` |
| `securityhub` | AWS SecurityHub ASFF | `{ Findings[] }` |
| `inspec` | Chef InSpec | `{ profiles[].controls[] }` |
| `trivy` | Aqua Trivy | `{ Results[].Vulnerabilities[] }` |
| `gitlab` | GitLab SAST | `{ vulnerabilities[] }` |
| `ciso-assistant-api` | CISO Assistant (API) | `{ results[] }` with compliance fields |
| `ciso-assistant-export` | CISO Assistant (Export) | `{ requirement_assessments[] }` |

---

## CPOE Format

A CPOE is a JWT with three base64url-encoded segments: `header.payload.signature`

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER   { "alg": "EdDSA", "typ": "vc+jwt", "kid": "did:web:..." }      │
├──────────────────────────────────────────────────────────────────┤
│ PAYLOAD  { "iss": "did:web:...", "vc": { ... CPOE ... }, "parley": "2.0" }│
├──────────────────────────────────────────────────────────────────┤
│ SIGNATURE  Ed25519                                                        │
└──────────────────────────────────────────────────────────────────┘
```

The credential subject records **provenance and summary** — who produced the evidence, what they found:

```json
{
  "type": "CorsairCPOE",
  "scope": "SOC 2 Type II — Acme Cloud Platform",
  "provenance": {
    "source": "tool",
    "sourceIdentity": "Prowler v3.1",
    "sourceDate": "2026-01-15"
  },
  "summary": {
    "controlsTested": 46,
    "controlsPassed": 42,
    "controlsFailed": 4,
    "overallScore": 91
  },
  "frameworks": {
    "SOC2": { "controlsMapped": 24, "passed": 22, "failed": 2 },
    "NIST-800-53": { "controlsMapped": 22, "passed": 20, "failed": 2 }
  },
  "processProvenance": {
    "chainDigest": "a7f3e2...",
    "receiptCount": 4,
    "chainVerified": true,
    "format": "in-toto/v1+cose-sign1"
  }
}
```

### Verification

```
1. Decode    ─── Parse JWT header + payload (base64url)
2. Resolve   ─── Fetch issuer's DID document via HTTPS
3. Extract   ─── Find the public key matching header.kid
4. Verify    ─── Check Ed25519 signature
```

Anyone can do this. No Corsair account needed.

---

## Provenance Model

Corsair records **where evidence came from** and lets buyers decide what's sufficient.

| Provenance | Source | Example |
|:-----------|:-------|:--------|
| **Self** | Organization self-reports | Policy documents, manual attestation |
| **Tool** | Automated scanning tools | Prowler, InSpec, Trivy, SecurityHub |
| **Auditor** | Independent third party | SOC 2 auditor, ISO 27001 certification body |

The CPOE is a signed fact: "Prowler said PASS on Jan 15." Not an opinion. Not a score. A verifiable record of what a tool found.

---

## Privacy Architecture

Companies fear publishing detailed control data. Corsair solves this with three privacy layers — share proof, not secrets.

| Layer | What It Does | How |
|:------|:-------------|:----|
| **Summary-Only CPOEs** | Aggregate pass/fail counts, no raw evidence | Default CPOE omits control details and configuration data |
| **Evidence Sanitization** | Strip sensitive identifiers before signing | ARNs, IPs, file paths, account IDs, API keys removed recursively |
| **SD-JWT Selective Disclosure** | Reveal only chosen claims per verifier | IETF SD-JWT — holder controls which fields are disclosed |

### Proof-Only SCITT

Register a CPOE in the transparency log without storing the credential itself — only a SHA-256 hash and COSE receipt. The CPOE is shared bilaterally while the log proves it was registered at a specific time.

### SD-JWT in the Sign Pipeline

```bash
corsair sign --file evidence.json --sd-jwt                    # SD-JWT with default disclosable fields
corsair sign --file evidence.json --sd-jwt --sd-fields scope  # Only scope is disclosable
```

---

## Architecture

```
          ┌─────────────────────┐
          │  Tool / Platform     │   Prowler, InSpec, Trivy,
          │  Evidence Output     │   SecurityHub, CISO Assistant
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
    01    │       SIGN           │   Parse → Provenance → Sign JWT-VC (Ed25519)
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
    02    │        LOG           │   Register in SCITT transparency log
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
    03    │      VERIFY          │   Anyone verifies (free, no account)
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
    04    │       DIFF           │   Compare CPOEs, detect regressions
          └──────────┘
```

That's it. Tool output goes in, signed proof comes out.

---

## Parley Protocol

The protocol composing Corsair is called **Parley**. It composes open standards so any JWT library can verify a CPOE. Zero vendor lock-in.

| Standard | Role | Implementation |
|:---------|:-----|:---------------|
| [**JWT-VC**](https://www.w3.org/TR/vc-data-model-2.0/) | Attestation envelope | CPOE as W3C Verifiable Credential, Ed25519-signed |
| [**DID:web**](https://w3c-ccg.github.io/did-method-web/) | Issuer identity | DNS-based decentralized identifiers |
| [**SCITT**](https://datatracker.ietf.org/wg/scitt/about/) | Transparency log | Append-only registry with COSE receipts + Merkle proofs |
| [**SSF/CAEP**](https://openid.net/specs/openid-sharedsignals-framework-1_0.html) | Real-time signals | Compliance change notifications via signed SETs |
| **Ed25519** | Signatures | Curve25519 — fast, compact, no weak keys |
| [**in-toto/SLSA**](https://in-toto.io/) | Process provenance | COSE-signed pipeline receipts with Merkle root chain |
| **SD-JWT** | Selective disclosure | Prove specific claims without revealing the full CPOE |

### DID Identity

Organizations are identified via `did:web` DIDs. The DID document at `/.well-known/did.json` contains the Ed25519 public key for CPOE verification.

```
did:web:grcorsair.com  →  https://grcorsair.com/.well-known/did.json
did:web:acme.com       →  https://acme.com/.well-known/did.json
```

### FLAGSHIP Events

Real-time compliance signals via OpenID SSF/CAEP:

| Event | CAEP Type | Trigger |
|:------|:----------|:--------|
| `COLORS_CHANGED` | `assurance-level-change` | Trust tier changed |
| `FLEET_ALERT` | `compliance-change` | Drift detected |
| `PAPERS_CHANGED` | `credential-change` | CPOE issued, renewed, or revoked |
| `MARQUE_REVOKED` | `session-revoked` | Emergency revocation |

---

## Integrations

### MCP Server

```bash
bun run bin/corsair-mcp.ts
```

Tools: `corsair_sign`, `corsair_verify`, `corsair_diff`, `corsair_formats`

```json
{ "corsair": { "command": "bun", "args": ["run", "bin/corsair-mcp.ts"], "env": { "CORSAIR_KEY_DIR": "./keys" } } }
```

### GitHub Action

```yaml
- uses: Arudjreis/corsair@main
  with:
    file: trivy-results.json
    format: trivy
  id: sign
```

### API

```bash
# Sign (requires auth)
curl -X POST https://api.grcorsair.com/sign \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"evidence": {...}, "format": "prowler"}'

# Verify (no auth required)
curl -X POST https://api.grcorsair.com/verify \
  -d '{"cpoe": "eyJ..."}'
```

### SDK

```bash
bun add @corsair/sdk
```

---

## Testing

```bash
bun test   # 1920 tests, 76 files — all passing
```

---

## Tech Stack

| Component | Technology |
|:----------|:-----------|
| Runtime | [Bun](https://bun.sh/) — TypeScript, no build step |
| Crypto | Ed25519 via Node.js `crypto` + [jose](https://github.com/panva/jose) |
| Database | Postgres via [Bun.sql](https://bun.sh/docs/api/sql) — zero-dep driver |
| Web | [Next.js 15](https://nextjs.org/) + Tailwind 4 + shadcn/ui |
| Standards | W3C VC 2.0, IETF SCITT, OpenID SSF/CAEP |

> **Dependencies**: 1 runtime dep — `jose` (JWT/JWK). Everything else is hand-rolled.

---

<details>
<summary><strong>Advanced Features</strong></summary>

<br/>

### Evidence Quality Score (`--score`)

Add `--score` to any sign command to get a 7-dimension evidence quality assessment:

```bash
corsair sign --file prowler-findings.json --score
# Evidence Quality: 82/100 (B)
# Dimensions: source=90 recency=95 coverage=80 reproducibility=85 consistency=70 quality=80 completeness=75
```

### Compliance Audit

Multi-file audit with optional scoring and governance checks:

```bash
corsair audit --files evidence/*.json --scope "SOC 2 Type II" --score --governance --json
```

### Continuous Certification

Policy-based continuous compliance monitoring:

```bash
corsair cert create --scope "Production" --policy policy.json
corsair cert check --id cert-abc123
corsair cert list
```

### Third-Party Risk Management

Automated vendor assessment from CPOEs:

```bash
corsair tprm register --name "Acme Corp" --tier critical
corsair tprm assess --vendor vendor-123 --cpoes cpoe1.jwt cpoe2.jwt
corsair tprm dashboard
```

### Assurance Levels (Optional Enrichment)

When `--enrich` is passed, Corsair classifies evidence at L0-L4 assurance levels:

| Level | Name | Evidence Required |
|:---:|:-----|:------------------|
| **L0** | Documented | Policy docs only |
| **L1** | Configured | Config exports, tool scans |
| **L2** | Demonstrated | Test results, pentest findings |
| **L3** | Observed | Continuous monitoring |
| **L4** | Attested | Independent third-party verification |

</details>

<details>
<summary><strong>Project Structure</strong></summary>

<br/>

```
corsair.ts                 # CLI entry point

src/
  types.ts                 # Core type definitions
  evidence.ts              # JSONL evidence engine with SHA-256 hash chain

  sign/                    # Sign engine
  ingestion/               # Evidence parsing (8 formats)
  parley/                  # Parley protocol (JWT-VC, SCITT, DID, COSE, CBOR, Merkle)
  flagship/                # FLAGSHIP real-time signals (SSF/CAEP)
  security/                # URL validation for DID resolver
  middleware/              # HTTP auth, rate-limit, security headers
  db/                      # Postgres via Bun.sql + migrations

  normalize/               # Evidence normalization engine
  scoring/                 # 7-dimension evidence quality scoring
  query/                   # Evidence query engine
  quartermaster/           # Governance checks
  audit/                   # Audit engine + orchestrator
  certification/           # Continuous certification
  tprm/                    # Third-party risk management
  billing/                 # Subscription management
  webhooks/                # Webhook delivery
  api/                     # Versioned API router
  mcp/                     # MCP server

bin/                       # Standalone CLIs (verify, DID, MCP)
functions/                 # Railway API endpoints
examples/                  # Evidence format examples (8 files)
apps/web/                  # grcorsair.com (Next.js 15)
packages/sdk/              # @corsair/sdk
tests/                     # 1920 tests across 76 files
```

</details>

---

## Data Retention

- **SCITT entries** are append-only by design. Entries cannot be deleted or modified after registration.
- **Signing keys** are encrypted at rest (AES-256-GCM). Retired keys are preserved for historical CPOE verification.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the Pirate's Code.

## License

Code is licensed under [Apache 2.0](LICENSE). Specifications ([CPOE_SPEC.md](CPOE_SPEC.md)) are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [NOTICE](NOTICE) for the full licensing architecture.

---

<div align="center">

<sub>Verify trust. Don't assume it.</sub>

<br/>

![Corsair](https://img.shields.io/badge/CORSAIR-Verify_Trust-D4A853?style=for-the-badge&labelColor=0A0E17)

</div>
