<div align="center">

<img src="assets/corsair-logo.gif" alt="Corsair — Verify Proof. Not Promises." width="647"/>

<br/>

**Open protocol for machine-readable, cryptographically verifiable compliance attestations.**

<br/>

![Tests](https://img.shields.io/github/actions/workflow/status/arudjreis/corsair/test.yml?style=for-the-badge&label=TESTS&labelColor=0A0E17&color=2ECC71)
![Version](https://img.shields.io/badge/v0.4.0-D4A853?style=for-the-badge&label=VERSION&labelColor=0A0E17)
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
- **Assurance-graded** — L0 (documented) to L4 (independently attested)

Think of it like **HTTPS certificates for compliance**. Anyone can verify a CPOE. Free to check. No account required.

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

# Generate a CPOE from a SOC 2 report
export ANTHROPIC_API_KEY=your_key_here
bun run corsair.ts ingest --file report.pdf --type soc2

# Generate Ed25519 signing keys
bun run corsair.ts keygen --output ./keys
```

### CLI Reference

| Command | Description |
|:--------|:------------|
| `corsair ingest --file <path> [--type soc2] [--did <did>] [--format vc\|v1]` | Ingest a compliance document and generate a CPOE |
| `corsair verify --file <cpoe.jwt> [--pubkey <path>]` | Verify a CPOE signature and display results |
| `corsair keygen [--output <dir>]` | Generate Ed25519 signing keypair |
| `corsair help` | Show available commands |

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

## Assurance Levels

Every control in a CPOE is classified at an assurance level. The CPOE's overall level is the **minimum** across all in-scope controls — like an SSL certificate where one unverified domain means rejection.

| | Level | Name | Evidence Required | SSL Analogy |
|:---:|:---:|:-----|:------------------|:------------|
| ◇ | **L0** | Documented | Policy docs only | Self-signed cert |
| ◈ | **L1** | Configured | Config exports, tool scans | Domain-validated (DV) |
| ◆ | **L2** | Demonstrated | Test results, pentest findings | Org-validated (OV) |
| ◆ | **L3** | Observed | Continuous monitoring, FLAGSHIP active | Extended validation (EV) |
| ★ | **L4** | Attested | Independent third-party verification | EV + audit letter |

> L0 is free and self-signed. L1+ involves Corsair attestation. L4 requires an independent auditor co-signature via W3C Verifiable Presentation.

---

## Architecture

```
                    ┌─────────────────────┐
                    │   PDF / JSON / CSV   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
              01    │       INGEST         │  Claude extracts controls from documents
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
              02    │      CLASSIFY        │  Assigns L0–L4 assurance per control
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
              03    │       CHART          │  Maps controls to compliance frameworks
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
              04    │      QUARTER         │  AI reviews governance + evidence quality
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
              05    │       MARQUE         │  Signs as JWT-VC (Ed25519) → CPOE
                    └─────┬─────┬─────────┘
                          │     │
               ┌──────────▼┐   ┌▼──────────┐
               │   SCITT    │   │  FLAGSHIP  │
               │ Transparency│   │ Real-time  │
               │    Log     │   │  Signals   │
               └────────────┘   └────────────┘
```

| Stage | Pirate Name | What It Does |
|:------|:------------|:-------------|
| Ingestion | **INGEST** | PDF/JSON to structured controls via Claude |
| Assurance classification | **CLASSIFY** | Assigns L0–L4 assurance level per control based on evidence type |
| Framework mapping | **CHART** | Maps controls to 13+ compliance frameworks via CTID/SCF |
| Governance review | **QUARTER** | Deterministic + LLM evidence quality review (7 dimensions) |
| Signed proof | **MARQUE** | JWT-VC generation with Ed25519 signing + process provenance chain |
| Transparency log | **SCITT** | COSE receipts, Merkle proofs, append-only registry |
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
bun test                          # All tests (806 tests, 49 files)

bun test tests/parley/            # Parley protocol (MARQUE, JWT-VC, DID, SCITT)
bun test tests/flagship/          # FLAGSHIP (SSF/SET/CAEP)
bun test tests/ingestion/         # Document ingestion pipeline
bun test tests/quartermaster/     # Governance review + adversarial evals
bun test tests/chart/             # Framework mapping
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

> **Dependencies**: Only 2 runtime deps — `@anthropic-ai/sdk` and `jose`. Everything else is hand-rolled.

---

<details>
<summary><strong>Project Structure</strong></summary>

<br/>

```
corsair.ts                 # CLI entry point (ingest, verify, keygen, help)

src/
  types.ts                 # Core type definitions
  evidence.ts              # JSONL evidence engine with SHA-256 hash chain

  ingestion/               # Document ingestion pipeline (8 files)
    pdf-extractor.ts       #   PDF → text via Claude
    soc2-parser.ts         #   SOC 2 report parser
    mapper.ts              #   Parsed data → MarqueGeneratorInput
    assurance-calculator.ts #  L0-L4 per-control classification
    batch-processor.ts     #   Multi-document batch ingestion
    cli.ts                 #   CLI handler for ingest subcommand
    types.ts               #   Ingestion type definitions
    index.ts               #   Barrel exports

  parley/                  # Parley trust exchange protocol (22 files)
    vc-generator.ts        #   JWT-VC generation (jose + Ed25519)
    vc-verifier.ts         #   JWT-VC verification
    vc-types.ts            #   W3C Verifiable Credential 2.0 types
    marque-generator.ts    #   MARQUE generation (JWT-VC + JSON)
    marque-verifier.ts     #   MARQUE verification (auto-detects format)
    marque-key-manager.ts  #   Ed25519 keypair management + JWK export
    marque-types.ts        #   MARQUE document types
    marque-oscal-mapper.ts #   MARQUE → OSCAL Assessment Results
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

  quartermaster/           # Governance verification (5 files)
    quartermaster-agent.ts #   Deterministic + LLM governance review
    quartermaster-marque-bridge.ts  # Governance → MARQUE attestation
    quartermaster-types.ts #   Governance types
    evals/                 #   Adversarial evaluation harness

  chart/                   # Framework mapping (2 files)
    chart-engine.ts        #   Maps controls to 12+ frameworks via CTID/SCF
    index.ts               #   Barrel exports

  output/                  # Report generation (3 files)
    oscal-generator.ts     #   OSCAL Assessment Results JSON
    oscal-types.ts         #   OSCAL type definitions
    report-generator.ts    #   HTML + Markdown reports

  data/                    # Framework mapping data (3 files)
    mapping-loader.ts      #   CTID/SCF loader with singleton cache
    ctid-mappings.json     #   ATT&CK → NIST 800-53 (6,300+ mappings)
    scf-crosswalk.json     #   NIST 800-53 → 175+ frameworks

  db/                      # Postgres via Bun.sql (6 files)
    connection.ts          #   Singleton connection pool
    migrate.ts             #   Idempotent SQL migration runner
    index.ts               #   Barrel exports
    migrations/            #   001–005 SQL migrations

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
  ssf-configuration.ts     #   GET /.well-known/ssf-configuration
  ssf-stream.ts            #   SSF stream CRUD API
  scitt-register.ts        #   SCITT registration + receipt API
  ssf-delivery-worker.ts   #   Event delivery worker with retry

apps/
  web/                     # grcorsair.com (Next.js 15 + Tailwind 4 + shadcn/ui)

tests/                     # 806 tests across 49 files
  parley/                  #   MARQUE, JWT-VC, DID, SCITT, CBOR, COSE, Merkle
  flagship/                #   SET generation, SSF streams, delivery
  ingestion/               #   SOC 2 parsing, mapping, batch processing
  quartermaster/           #   Governance review + adversarial evals
  chart/                   #   Framework mapping
  output/                  #   OSCAL + report generation
  data/                    #   CTID/SCF mapping loader
  db/                      #   Database connection + migrations
  functions/               #   API endpoint tests
  cli/                     #   CLI integration tests
  integration/             #   E2E pipeline tests
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
