<div align="center">

<img src="assets/corsair-logo.gif" alt="Corsair — Verify Proof. Not Promises." width="505"/>

<br/>

**Open protocol for machine-readable, cryptographically verifiable compliance attestations.**

<br/>

![Tests](https://img.shields.io/github/actions/workflow/status/arudjreis/corsair/test.yml?style=for-the-badge&label=TESTS&labelColor=0A0E17&color=2ECC71)
![Version](https://img.shields.io/badge/v0.5.0-D4A853?style=for-the-badge&label=VERSION&labelColor=0A0E17)
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

> *Vanta is Salesforce (manages compliance within orgs). Corsair is SMTP (moves trust between orgs).*

---

## The Problem

Compliance trust today is exchanged via PDF. SOC 2 reports, pentest results, ISO 27001 certificates — emailed as attachments, stored in shared drives, re-requested every quarter. They are **machine-unreadable**, **unverifiable**, and **impossible to validate** without trusting the sender.

## The Solution

**CORSAIR** replaces this with the **CPOE** (Certificate of Proof of Operational Effectiveness) — a [W3C Verifiable Credential](https://www.w3.org/TR/vc-data-model-2.0/) signed with Ed25519.

A CPOE is:
- **Machine-readable** — structured JSON, not a PDF
- **Cryptographically verifiable** — Ed25519 signature, anyone can check
- **Provenance-tracked** — records who produced the evidence, not just what it says

Think of it like **git for compliance**. Sign evidence (`corsair sign`), diff changes (`corsair diff`), query history (`corsair log`), verify proof (`corsair verify`). Anyone can verify a CPOE. Free to check. No account required.

The protocol composing this is called **Parley**: [JWT-VC](https://www.w3.org/TR/vc-data-model-2.0/) for the attestation, [SCITT](https://datatracker.ietf.org/wg/scitt/about/) for the transparency log, and [SSF/CAEP](https://openid.net/specs/openid-sharedsignals-framework-1_0.html) for real-time compliance signals.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/Arudjreis/corsair.git
cd corsair
bun install

# Verify an existing CPOE (always free)
bun run bin/corsair-verify.ts examples/example-cpoe.jwt

# Sign tool output as a CPOE
bun run corsair.ts sign --file prowler-findings.json --output cpoe.jwt

# Generate Ed25519 signing keys
bun run corsair.ts keygen --output ./keys
```

### CLI Reference

| Command | Description | Analogy |
|:--------|:------------|:--------|
| `corsair sign --file <path> [--did <did>] [--enrich]` | Sign evidence as a CPOE (JWT-VC) | `git commit` |
| `corsair diff --current <new.jwt> --previous <old.jwt>` | Detect compliance regressions | `git diff` |
| `corsair log [--help]` | Query SCITT transparency log | `git log` |
| `corsair verify --file <cpoe.jwt> [--pubkey <path>]` | Verify a CPOE signature and display results | |
| `corsair keygen [--output <dir>]` | Generate Ed25519 signing keypair | |
| `corsair help` | Show available commands | |

---

## CPOE Format

A CPOE is a JWT with three base64url-encoded segments: `header.payload.signature`

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER   { "alg": "EdDSA", "typ": "vc+jwt", "kid": "did:web:grcorsair.com#key-1" }  │
├──────────────────────────────────────────────────────────────────┤
│ PAYLOAD  { "iss": "did:web:grcorsair.com", "vc": { ... CPOE ... }, "parley": "2.0" } │
├──────────────────────────────────────────────────────────────────┤
│ SIGNATURE  Ed25519                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

The credential subject contains the minimum viable attestation:

```json
{
  "type": "CorsairCPOE",
  "scope": "SOC 2 Type II — Acme Cloud Platform",
  "assurance": {
    "declared": 1,
    "verified": true,
    "method": "corsair-attested",
    "breakdown": { "0": 2, "1": 22 }
  },
  "provenance": {
    "source": "auditor",
    "sourceIdentity": "Example Audit Firm LLP",
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
    "format": "in-toto/v1+cose-sign1",
    "reproducibleSteps": 3,
    "attestedSteps": 1
  }
}
```

### Verification Flow

```
1. Decode    ─── Parse JWT header + payload (base64url, no crypto yet)
2. Resolve   ─── Fetch issuer's DID document via HTTPS  (did:web → /.well-known/did.json)
3. Extract   ─── Find the public key matching header.kid
4. Verify    ─── Check Ed25519 signature over the JWT payload
```

Anyone can do this. No Corsair account needed. Four steps with any JWT library.

---

## Provenance Model

Corsair uses a **provenance-first** model. Instead of judging evidence quality, it records where evidence came from and lets buyers decide what's sufficient.

| Provenance | Source | Example |
|:-----------|:-------|:--------|
| **Self** | Organization self-reports | Policy documents, manual attestation |
| **Tool** | Automated scanning tools | Prowler, InSpec, Trivy, SecurityHub |
| **Auditor** | Independent third party | SOC 2 auditor, ISO 27001 certification body |

### Assurance Levels (Optional Enrichment)

When `--enrich` is passed, Corsair also classifies evidence at L0-L4 assurance levels. This is optional — the default signing path records provenance without judgment.

| | Level | Name | Evidence Required |
|:---:|:---:|:-----|:------------------|
| ◇ | **L0** | Documented | Policy docs only |
| ◈ | **L1** | Configured | Config exports, tool scans |
| ◆ | **L2** | Demonstrated | Test results, pentest findings |
| ◆ | **L3** | Observed | Continuous monitoring |
| ★ | **L4** | Attested | Independent third-party verification |

---

## Architecture

```
                    ┌─────────────────────┐
                    │  Tool / Platform     │   Prowler, InSpec, Trivy,
                    │  Evidence Output     │   SecurityHub, CISO Assistant
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
              01    │       SIGN           │   Parse → Provenance → Sign JWT-VC
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

           ┌──────────────────────────────────────┐
           │  Optional enrichment (--enrich):      │
           │  CLASSIFY → CHART → QUARTER           │
           │  Adds L0-L4 assurance scoring,        │
           │  framework mapping, governance review  │
           └──────────────────────────────────────┘
```

| Stage | CLI Command | What It Does |
|:------|:------------|:-------------|
| Sign evidence | `corsair sign` | Parse tool output, record provenance, sign as JWT-VC (Ed25519) |
| Transparency log | `corsair log` | Register CPOEs in SCITT append-only log |
| Verify proof | `corsair verify` | Verify Ed25519 signature via DID:web resolution |
| Detect regressions | `corsair diff` | Compare two CPOEs, detect new failures |

### Optional Enrichment (via `--enrich`)

| Stage | Pirate Name | What It Does |
|:------|:------------|:-------------|
| Assurance classification | **CLASSIFY** | Assigns L0-L4 assurance level per control based on evidence type |
| Framework mapping | **CHART** | Maps controls to 13+ compliance frameworks via CTID/SCF |
| Governance review | **QUARTER** | Deterministic + LLM evidence quality review (7 dimensions) |
| Real-time signals | **FLAGSHIP** | SSF/CAEP notifications for compliance state changes |

---

## Parley Protocol

Parley composes open standards so any JWT library can verify a CPOE. Zero vendor lock-in.

| Standard | Role | Implementation |
|:---------|:-----|:---------------|
| [**JWT-VC**](https://www.w3.org/TR/vc-data-model-2.0/) | Attestation envelope | CPOE as W3C Verifiable Credential, Ed25519-signed |
| [**DID:web**](https://w3c-ccg.github.io/did-method-web/) | Issuer identity | DNS-based decentralized identifiers |
| [**SCITT**](https://datatracker.ietf.org/wg/scitt/about/) | Transparency log | Postgres-backed registry with COSE receipts + Merkle proofs |
| [**SSF/CAEP**](https://openid.net/specs/openid-sharedsignals-framework-1_0.html) | Real-time notifications | FLAGSHIP signals compliance changes via signed SETs |
| **Ed25519** | Signatures | Curve25519 — fast, compact, no weak keys |
| [**in-toto/SLSA**](https://in-toto.io/) | Process provenance | COSE-signed pipeline receipts with Merkle root chain |

### FLAGSHIP Events

| Event | CAEP Type | Trigger |
|:------|:----------|:--------|
| `COLORS_CHANGED` | `assurance-level-change` | Trust tier changed |
| `FLEET_ALERT` | `compliance-change` | Drift detected |
| `PAPERS_CHANGED` | `credential-change` | CPOE issued, renewed, or revoked |
| `MARQUE_REVOKED` | `session-revoked` | Emergency revocation |

### DID Identity

Organizations are identified via `did:web` DIDs. The DID document at `/.well-known/did.json` contains the Ed25519 public key for CPOE verification.

```
did:web:grcorsair.com  →  https://grcorsair.com/.well-known/did.json
did:web:acme.com       →  https://acme.com/.well-known/did.json
```

---

## Testing

```bash
bun test                          # All tests (772 tests, 39 files)

bun test tests/parley/            # Parley protocol (MARQUE, JWT-VC, DID, SCITT)
bun test tests/flagship/          # FLAGSHIP (SSF/SET/CAEP)
bun test tests/ingestion/         # Document ingestion pipeline
bun test tests/functions/         # API endpoints (SSF, SCITT, health)
bun test tests/db/                # Database tests (requires Postgres)
```

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Runtime | [Bun](https://bun.sh/) — TypeScript runs directly, no build step |
| Language | TypeScript (strict mode, ESM) |
| Crypto | Ed25519 via Node.js `crypto` + [jose](https://github.com/panva/jose) for JWT-VC |
| AI | [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) — Claude for PDF extraction + governance |
| Database | Postgres via [Bun.sql](https://bun.sh/docs/api/sql) — zero-dependency driver |
| Web | [Next.js 15](https://nextjs.org/) + Tailwind 4 + shadcn/ui |
| Hosting | [Railway](https://railway.app/) (Postgres + Functions + Web) |
| Standards | W3C VC 2.0, IETF SCITT, OpenID SSF/CAEP, NIST OSCAL |

> **Dependencies**: Only 1 runtime dep — `jose` (JWT/JWK). Everything else is hand-rolled. `@anthropic-ai/sdk` is a dev dependency for optional Quartermaster AI enrichment.

---

<details>
<summary><strong>Project Structure</strong></summary>

<br/>

```
corsair.ts                 # CLI entry point (sign, verify, diff, log, keygen, help)

src/
  types.ts                 # Core type definitions
  evidence.ts              # JSONL evidence engine with SHA-256 hash chain

  ingestion/               # Evidence parsing + classification (5 files)
    json-parser.ts         #   Tool format adapters (Prowler, InSpec, Trivy)
    mapper.ts              #   Parsed data → MarqueGeneratorInput
    assurance-calculator.ts #  L0-L4 per-control classification
    types.ts               #   IngestedDocument, IngestedControl types
    index.ts               #   Barrel exports

  parley/                  # Parley trust exchange protocol (21 files)
    vc-generator.ts        #   JWT-VC generation (jose + Ed25519)
    vc-verifier.ts         #   JWT-VC verification
    vc-types.ts            #   W3C Verifiable Credential 2.0 types
    marque-generator.ts    #   MARQUE generation (JWT-VC + JSON)
    marque-verifier.ts     #   MARQUE verification (auto-detects format)
    marque-key-manager.ts  #   Ed25519 keypair management + JWK export
    marque-types.ts        #   MARQUE document types
    pg-key-manager.ts      #   Postgres-backed key manager (AES-256-GCM)
    did-resolver.ts        #   DID:web resolution and formatting
    scitt-types.ts         #   SCITT transparency log types
    scitt-registry.ts      #   In-memory SCITT registry
    pg-scitt-registry.ts   #   Postgres-backed SCITT registry
    cbor.ts                #   Minimal CBOR encoder/decoder (zero deps)
    cose.ts                #   COSE_Sign1 sign/verify (Ed25519, zero deps)
    merkle.ts              #   SHA-256 Merkle tree + inclusion proofs
    auto-bundler.ts        #   Multi-provider MARQUE pipeline
    parley-client.ts       #   HTTP client + SSF streams
    parley-types.ts        #   Protocol types + config
    process-receipt.ts     #   Process receipt types + COSE signing
    receipt-chain.ts       #   Pipeline step receipt accumulator
    receipt-verifier.ts    #   Process chain integrity verification

  flagship/                # Real-time compliance signals (6 files)
    flagship-types.ts      #   CAEP event types with pirate aliases
    set-generator.ts       #   Security Event Token generation (Ed25519 JWT)
    ssf-stream.ts          #   SSF stream lifecycle (in-memory)
    pg-ssf-stream.ts       #   Postgres-backed SSF stream manager
    flagship-client.ts     #   Push/poll delivery (retry, circuit breaker)
    index.ts               #   Barrel exports

  security/                # Security utilities (1 file)
    url-validation.ts      #   DID resolver URL safety checks

  middleware/              # HTTP middleware (3 files)
    auth.ts                #   API key authentication
    rate-limit.ts          #   Request rate limiting
    security-headers.ts    #   Security response headers

  db/                      # Postgres via Bun.sql (6 files)
    connection.ts          #   Singleton connection pool
    migrate.ts             #   Idempotent SQL migration runner
    index.ts               #   Barrel exports
    migrations/            #   001–007 SQL migrations

bin/
  corsair-verify.ts        # Standalone CPOE verification CLI
  corsair-did-generate.ts  # DID document generation
  generate-first-cpoe.ts   # Example CPOE generator

examples/
  example-cpoe.jwt         # Sample signed CPOE
  example-cpoe-decoded.json # Decoded CPOE payload
  did.json                 # Example DID document

functions/                 # Railway Functions (HTTP endpoints)
  health.ts                #   GET /health
  verify.ts                #   POST /verify
  issue.ts                 #   POST /issue
  did-json.ts              #   GET /.well-known/did.json
  jwks-json.ts             #   GET /.well-known/jwks.json
  ssf-configuration.ts     #   GET /.well-known/ssf-configuration
  ssf-stream.ts            #   SSF stream CRUD API
  scitt-register.ts        #   SCITT registration + receipt API
  ssf-delivery-worker.ts   #   Event delivery worker with retry

apps/
  web/                     # grcorsair.com (Next.js 15 + Tailwind 4 + shadcn/ui)

tests/                     # 772 tests across 39 files
  parley/                  #   MARQUE, JWT-VC, DID, SCITT, CBOR, COSE, Merkle
  flagship/                #   SET generation, SSF streams, delivery
  ingestion/               #   Evidence parsing, mapping, classification
  db/                      #   Database connection + migrations
  functions/               #   API endpoint tests
  cli/                     #   CLI integration tests
```

</details>

---

## Data Retention

- **SCITT entries** are append-only by design (enforced by database constraints). Entries cannot be deleted or modified after registration.
- **SSF streams** can be soft-deleted via the API but remain in the database for audit purposes.
- **Signing keys** are encrypted at rest (AES-256-GCM) and retired keys are preserved for historical CPOE verification.
- Storage monitoring is recommended via your hosting provider's dashboard. Time-based partitioning will be implemented at >100K SCITT entries.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the Pirate's Code.

## License

Code is licensed under [Apache 2.0](LICENSE). Specifications ([CPOE_SPEC.md](CPOE_SPEC.md), [L0-L4_ISSUANCE_SPEC.md](L0-L4_ISSUANCE_SPEC.md)) are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [NOTICE](NOTICE) for the full licensing architecture.

---

<div align="center">

<sub>Verify trust. Don't assume it.</sub>

<br/>

![Corsair](https://img.shields.io/badge/CORSAIR-Verify_Trust-D4A853?style=for-the-badge&labelColor=0A0E17)

</div>
