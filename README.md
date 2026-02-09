<div align="center">

<img src="assets/final corsair logo.png" alt="Corsair Logo" width="700"/>

</div>

# CORSAIR

![Tests](https://github.com/arudjreis/corsair/actions/workflows/test.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)
![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1.svg?logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)

**Open protocol for machine-readable, cryptographically verifiable compliance attestations.**

> Vanta is Salesforce (manages compliance within orgs). Corsair is SMTP (moves trust between orgs).

---

## What is CORSAIR?

Compliance trust today is exchanged via PDF. SOC 2 reports, pentest results, ISO 27001 certificates -- emailed as attachments, stored in shared drives, re-requested every quarter. They are machine-unreadable, unverifiable, and impossible to validate without trusting the sender.

CORSAIR replaces this with the **CPOE** (Certificate of Proof of Operational Effectiveness) -- a [W3C Verifiable Credential](https://www.w3.org/TR/vc-data-model-2.0/) signed with Ed25519. A CPOE is machine-readable, cryptographically verifiable, and carries a declared assurance level from L0 (documented) to L4 (independently attested).

Think of it like HTTPS certificates for compliance. Anyone can verify a CPOE. Free to check. No account required.

The protocol composing this is called **Parley**: [JWT-VC](https://www.w3.org/TR/vc-data-model-2.0/) for the attestation envelope, [SCITT](https://datatracker.ietf.org/wg/scitt/about/) for the transparency log, and [SSF/CAEP](https://openid.net/specs/openid-sharedsignals-framework-1_0.html) for real-time compliance change notifications.

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

### CLI Commands

```bash
corsair ingest  --file <path> [--type soc2] [--did <did>] [--format vc|v1]
corsair verify  --file <cpoe.jwt> [--pubkey <path>]
corsair keygen  [--output <dir>]
corsair help
```

---

## CPOE Format

A CPOE is a JWT-VC with this structure:

```
Header:  { "alg": "EdDSA", "typ": "vc+jwt", "kid": "did:web:grcorsair.com#key-1" }
Payload: { "iss": "did:web:grcorsair.com", "vc": { ... CPOE ... }, "parley": "2.0" }
Signature: Ed25519
```

The credential subject contains the minimum viable attestation:

```json
{
  "type": "CorsairCPOE",
  "scope": "SOC 2 Type II -- Acme Cloud Platform",
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
  }
}
```

### Verification Flow

1. Parse the JWT-VC and extract the `kid` (key ID)
2. Resolve the issuer's `did:web` DID document to fetch the Ed25519 public key
3. Verify the Ed25519 signature over the JWT payload
4. Check expiry, assurance level, and control results

Anyone can do this. No Corsair account needed.

---

## Assurance Levels (L0-L4)

Every control in a CPOE is classified at an assurance level. The CPOE's overall level is the minimum across all in-scope controls -- like an SSL certificate where one unverified domain means rejection.

| Level | Name | Evidence Required | Analogy |
|-------|------|-------------------|---------|
| **L0** | Documented | Policy docs only | Self-signed cert |
| **L1** | Configured | Config exports, settings screenshots | Domain-validated (DV) |
| **L2** | Demonstrated | Test results, pentest findings | Org-validated (OV) |
| **L3** | Observed | Continuous monitoring, FLAGSHIP active | Extended validation (EV) |
| **L4** | Attested | Independent third-party verification | EV + audit letter |

L0 is free and self-signed. L1+ involves Corsair attestation. L4 requires an independent auditor co-signature via W3C Verifiable Presentation.

---

## Architecture

```
PDF / JSON / CSV
       |
       v
    INGEST ---- Claude extracts controls from documents
       |
       v
    CHART ----- Maps controls to compliance frameworks (SOC 2, NIST, ISO, ...)
       |
       v
    QUARTER --- Quartermaster AI reviews governance and evidence quality
       |
       v
    MARQUE ---- Signs as JWT-VC (Ed25519, did:web) --> CPOE
       |
       +------> SCITT ------- Registers in transparency log (COSE receipts)
       +------> FLAGSHIP ---- Signals compliance changes in real-time (SSF/CAEP)
```

| Stage | Pirate Name | What It Does |
|-------|-------------|--------------|
| Ingestion | INGEST | PDF/JSON to structured controls via Claude |
| Framework mapping | CHART | Maps controls to 12+ compliance frameworks |
| Governance review | QUARTER | AI-powered evidence quality and methodology review |
| Signed proof | MARQUE | JWT-VC generation with Ed25519 signing |
| Transparency log | SCITT | COSE receipts, Merkle proofs, append-only registry |
| Real-time signals | FLAGSHIP | SSF/CAEP notifications for compliance state changes |

---

## Parley Protocol

Parley composes three open standards to make CPOEs interoperable with any standards-compliant verifier.

| Standard | Role | Implementation |
|----------|------|----------------|
| **JWT-VC** ([W3C](https://www.w3.org/TR/vc-data-model-2.0/)) | Attestation envelope | CPOE as Verifiable Credential, Ed25519-signed |
| **SCITT** ([IETF](https://datatracker.ietf.org/wg/scitt/about/)) | Transparency log | Postgres-backed registry with COSE receipts and Merkle proofs |
| **SSF/CAEP** ([OpenID](https://openid.net/specs/openid-sharedsignals-framework-1_0.html)) | Real-time notifications | FLAGSHIP signals compliance changes via signed SETs |

### FLAGSHIP Events

| Event | CAEP Type | Trigger |
|-------|-----------|---------|
| `COLORS_CHANGED` | assurance-level-change | Trust tier changed |
| `FLEET_ALERT` | compliance-change | Drift detected |
| `PAPERS_CHANGED` | credential-change | CPOE issued, renewed, or revoked |
| `MARQUE_REVOKED` | session-revoked | Emergency revocation |

### DID Identity

Organizations are identified via `did:web` DIDs. The DID document at `.well-known/did.json` contains the Ed25519 public key for CPOE verification.

---

## Project Structure

```
corsair.ts                 # CLI entry point (ingest, verify, keygen, help)

src/
  types.ts                 # Core type definitions
  evidence.ts              # JSONL evidence engine with SHA-256 hash chain

  ingestion/               # Document ingestion pipeline (8 files)
    pdf-extractor.ts       # PDF -> text via Claude
    soc2-parser.ts         # SOC 2 report parser
    mapper.ts              # Parsed data -> MarqueGeneratorInput
    assurance-calculator.ts # L0-L4 per-control classification
    batch-processor.ts     # Multi-document batch ingestion
    cli.ts                 # CLI handler for ingest subcommand
    types.ts               # Ingestion type definitions
    index.ts               # Barrel exports

  parley/                  # Parley trust exchange protocol (19 files)
    vc-generator.ts        # JWT-VC generation (jose + Ed25519)
    vc-verifier.ts         # JWT-VC verification
    vc-types.ts            # W3C Verifiable Credential 2.0 types
    marque-generator.ts    # MARQUE generation (JWT-VC + JSON)
    marque-verifier.ts     # MARQUE verification (auto-detects format)
    marque-key-manager.ts  # Ed25519 keypair management + JWK export
    marque-types.ts        # MARQUE document types
    marque-oscal-mapper.ts # MARQUE -> OSCAL Assessment Results
    pg-key-manager.ts      # Postgres-backed key manager (AES-256-GCM)
    did-resolver.ts        # DID:web resolution and formatting
    scitt-types.ts         # SCITT transparency log types
    scitt-registry.ts      # In-memory SCITT registry
    pg-scitt-registry.ts   # Postgres-backed SCITT registry
    cbor.ts                # Minimal CBOR encoder/decoder (zero deps)
    cose.ts                # COSE_Sign1 sign/verify (Ed25519, zero deps)
    merkle.ts              # SHA-256 Merkle tree + inclusion proofs
    auto-bundler.ts        # Multi-provider MARQUE pipeline
    parley-client.ts       # HTTP client + SSF streams
    parley-types.ts        # Protocol types + config

  flagship/                # Real-time compliance signals (6 files)
    flagship-types.ts      # CAEP event types with pirate aliases
    set-generator.ts       # Security Event Token generation (Ed25519 JWT)
    ssf-stream.ts          # SSF stream lifecycle (in-memory)
    pg-ssf-stream.ts       # Postgres-backed SSF stream manager
    flagship-client.ts     # Push/poll delivery (retry, circuit breaker)
    index.ts               # Barrel exports

  quartermaster/           # Governance verification (5 files)
    quartermaster-agent.ts          # Deterministic + LLM governance review
    quartermaster-marque-bridge.ts  # Governance -> MARQUE attestation
    quartermaster-types.ts          # Governance types
    evals/                          # Adversarial evaluation harness

  chart/                   # Framework mapping (2 files)
    chart-engine.ts        # Maps controls to 12+ frameworks via CTID/SCF
    index.ts               # Barrel exports

  output/                  # Report generation (3 files)
    oscal-generator.ts     # OSCAL Assessment Results JSON
    oscal-types.ts         # OSCAL type definitions
    report-generator.ts    # HTML + Markdown reports

  data/                    # Framework mapping data (3 files)
    mapping-loader.ts      # CTID/SCF loader with singleton cache
    ctid-mappings.json     # ATT&CK -> NIST 800-53 (6,300+ mappings)
    scf-crosswalk.json     # NIST 800-53 -> 175+ frameworks

  db/                      # Postgres via Bun.sql (6 files)
    connection.ts          # Singleton connection pool
    migrate.ts             # Idempotent SQL migration runner
    index.ts               # Barrel exports
    migrations/            # 001-005 SQL migrations

bin/
  corsair-verify.ts        # Standalone CPOE verification CLI
  corsair-did-generate.ts  # DID document generation
  generate-first-cpoe.ts   # Example CPOE generator

examples/
  example-cpoe.jwt         # Sample signed CPOE
  example-cpoe-decoded.json # Decoded CPOE payload
  did.json                 # Example DID document

functions/                 # Railway Functions (HTTP endpoints)
  health.ts                # GET /health
  ssf-configuration.ts     # GET /.well-known/ssf-configuration
  ssf-stream.ts            # SSF stream CRUD API
  scitt-register.ts        # SCITT registration + receipt API
  ssf-delivery-worker.ts   # Event delivery worker with retry

tests/                     # 567 tests across 47 files
  parley/                  # MARQUE, JWT-VC, DID, SCITT, CBOR, COSE, Merkle
  flagship/                # SET generation, SSF streams, delivery
  ingestion/               # SOC 2 parsing, mapping, batch processing
  quartermaster/           # Governance review + adversarial evals
  chart/                   # Framework mapping
  output/                  # OSCAL + report generation
  data/                    # CTID/SCF mapping loader
  db/                      # Database connection + migrations
  functions/               # API endpoint tests
  cli/                     # CLI integration tests
  integration/             # E2E pipeline tests
```

---

## Testing

```bash
bun test                        # All tests (567 tests, 47 files)

bun test tests/parley/          # Parley protocol (MARQUE, JWT-VC, DID, SCITT)
bun test tests/flagship/        # FLAGSHIP (SSF/SET/CAEP)
bun test tests/ingestion/       # Document ingestion pipeline
bun test tests/quartermaster/   # Governance review + adversarial evals
bun test tests/chart/           # Framework mapping
bun test tests/functions/       # API endpoints (SSF, SCITT, health)
bun test tests/db/              # Database tests (requires Postgres)
```

---

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) -- TypeScript runs directly, no build step
- **Language**: TypeScript (strict mode, ESM)
- **Crypto**: Ed25519 via Node.js `crypto` + [jose](https://github.com/panva/jose) for JWT-VC
- **AI**: [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) (Claude for PDF extraction + governance review)
- **Database**: Postgres via [Bun.sql](https://bun.sh/docs/api/sql) (zero-dependency driver)
- **Hosting**: Railway (Postgres + Functions)
- **Standards**: W3C VC Data Model 2.0, IETF SCITT, OpenID SSF/CAEP, NIST OSCAL

---

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the Pirate's Code.

## License

MIT

---

**Verify trust. Don't assume it.**
