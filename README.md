<div align="center">

<img src="assets/corsair-logo.gif" alt="Corsair — Verify Proof. Not Promises." width="505"/>

<br/>

**Your security tools already know if your controls work. Nobody can verify that. Until now.**

<br/>

![Tests](https://img.shields.io/github/actions/workflow/status/arudjreis/corsair/test.yml?style=for-the-badge&label=TESTS&labelColor=0A0E17&color=2ECC71)
![Version](https://img.shields.io/badge/v1.0.0-D4A853?style=for-the-badge&label=VERSION&labelColor=0A0E17)
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

[Website](https://grcorsair.com) · [Documentation](https://grcorsair.com/docs) · [CPOE Spec](CPOE_SPEC.md) · [Verify a CPOE](https://grcorsair.com/marque) · [Generate trust.txt](https://grcorsair.com/generate)

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
# Install (pick one)
npm install -g @grcorsair/cli                  # npm
brew install grcorsair/corsair/corsair         # homebrew
npx skills add grcorsair/corsair               # AI agent skill (Claude Code, Cursor, 25+ agents)

# Initialize a project (generates keys + example evidence)
corsair init

# Sign your Prowler scan as a CPOE (keys auto-generate on first use)
corsair sign --file prowler-findings.json

# Verify any CPOE (always free, no account needed)
corsair verify --file cpoe.jwt

# Compare two CPOEs over time (like git diff)
corsair diff --current q2.jwt --previous q1.jwt
```

---

## Three Production Pillars

Corsair ships with a simple, shareable surface that maps directly to how people verify compliance in the real world.

- **trust.txt** — publish discoverable proofs at `/.well-known/trust.txt`
- **4-line verification** — verify any CPOE with standard JWT libs (see `CPOE_SPEC.md`)
- **corsair diff** — drift detection that reads like `git diff`

```bash
corsair diff --current q2.jwt --previous q1.jwt
```

---

## CLI Primitives (Full Surface)

Corsair does six things. Like git.

| Primitive | Command | What It Does | Analogy |
|:----------|:--------|:-------------|:--------|
| **SIGN** | `corsair sign --file <path>` | Parse tool output, record provenance, sign JWT-VC | `git commit` |
| **LOG** | `corsair log` | List CPOEs from local files or a SCITT log | `git log` |
| **PUBLISH** | `corsair trust-txt generate` | Generate trust.txt for proof discovery | `git push` |
| **VERIFY** | `corsair verify --file <cpoe.jwt>` | Verify Ed25519 signature, apply policy checks | `git verify-commit` |
| **DIFF** | `corsair diff --current <new> --previous <old>` | Compare two CPOEs, detect regressions | `git diff` |
| **SIGNAL** | `corsair signal generate` | Generate FLAGSHIP SETs for real-time notifications | `git webhooks` |

### Sign Options

```bash
corsair sign --file evidence.json              # Auto-detect format, sign
corsair sign --file evidence.json --format prowler  # Force format
corsair sign --file evidence.json --json       # Structured JSON output
corsair sign --file evidence.json --dry-run    # Preview without signing
corsair sign --file evidence.json --sd-jwt     # SD-JWT selective disclosure
corsair sign --file evidence.json --sd-jwt --sd-fields scope  # Disclose only scope
corsair sign --file evidence.json --mapping ./mappings/toolx.json  # Apply mapping file
corsair sign --file evidence.json --mapping ./mappings/            # Apply mapping directory
corsair sign --file evidence.json --source tool  # Override provenance source
corsair sign --file evidence.json --baseline baseline.cpoe.jwt --gate  # Fail on regression vs baseline
corsair sign --file - < data.json              # Sign from stdin
```

### Mapping Registry

```bash
corsair mappings list                          # Show loaded mappings
corsair mappings list --json                   # Machine-readable output
corsair mappings validate --json               # Validate mappings
corsair mappings add https://example.com/pack.json  # Add a mapping pack
```

Mapping packs can be signed. If a pack includes a `signature`, set
`CORSAIR_MAPPING_PACK_PUBKEY` to the Ed25519 public key PEM to enforce verification.

### Verify Options

```bash
corsair verify --file cpoe.jwt --json          # Structured JSON output
corsair verify --file cpoe.jwt --did           # Verify via DID:web
corsair verify --file cpoe.jwt --require-issuer did:web:acme.com
corsair verify --file cpoe.jwt --require-framework SOC2,ISO27001
corsair verify --file cpoe.jwt --max-age 30 --min-score 90
corsair verify --file cpoe.jwt --receipts receipts.json
corsair verify --file cpoe.jwt --evidence evidence.jsonl
corsair verify --file cpoe.jwt --require-source tool --require-source-identity "Prowler v3.1"
corsair verify --file cpoe.jwt --require-tool-attestation --require-receipts --receipts receipts.json
corsair verify --file cpoe.jwt --require-evidence-chain --evidence evidence.jsonl
corsair verify --file cpoe.jwt --require-input-binding --source-document raw-evidence.json
corsair verify --file cpoe.jwt --require-scitt --receipts receipts.json
```

`--source-document` computes a canonical JSON hash (sorted keys) and compares it to `provenance.sourceDocument`.

### Evidence Receipts (Optional)

Evidence receipts prove that a specific evidence record exists in the evidence chain
without revealing the record itself.

```bash
corsair receipts generate --evidence evidence.jsonl --index 0 --output receipt.json
corsair receipts verify --file receipt.json --cpoe cpoe.jwt
```

### Diff Options

```bash
corsair diff --current new.jwt --previous old.jwt
corsair diff --current new.jwt --previous old.jwt --verify
corsair diff --current new.jwt --previous old.jwt --json
```

### Trust Discovery (trust.txt)

Corsair supports a discovery layer modeled after `security.txt`. Organizations publish
`/.well-known/trust.txt` so verifiers can discover DID identity, current CPOEs,
SCITT log endpoints, optional catalog snapshots, and FLAGSHIP streams.
For large numbers of proofs, keep trust.txt tiny and point to SCITT + catalog.

```bash
corsair trust-txt generate --did did:web:acme.com --scitt https://log.acme.com/v1/entries?issuer=did:web:acme.com
corsair trust-txt generate --did did:web:acme.com --catalog https://acme.com/compliance/catalog.json
corsair trust-txt generate --did did:web:acme.com --cpoe-url https://acme.com/soc2.jwt
corsair trust-txt discover acme.com --verify
```

---

## Supported Formats

Corsair auto-detects evidence format from JSON structure. Override with `--format <name>`.
For tools not on this list, use the mapping registry to extract controls or passthrough
fields without code changes (see `--mapping` and `CORSAIR_MAPPING_DIR`). Mappings
are evaluated by priority (higher wins), then filename order.

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
  "evidenceChain": {
    "chainType": "hash-linked",
    "algorithm": "sha256",
    "canonicalization": "sorted-json-v1",
    "recordCount": 128,
    "chainVerified": true,
    "chainDigest": "f4c1..."
  },
  "frameworks": {
    "SOC2": { "controlsMapped": 24, "passed": 22, "failed": 2 },
    "NIST-800-53": { "controlsMapped": 22, "passed": 20, "failed": 2 }
  },
  "extensions": {
    "mapping": { "id": "toolx-evidence-only", "evidenceOnly": true },
    "passthrough": { "summary": { "passed": 12, "failed": 2 } }
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
| `FLEET_ALERT` | `compliance-change` | Drift detected |
| `PAPERS_CHANGED` | `credential-change` | CPOE issued, renewed, or revoked |
| `MARQUE_REVOKED` | `session-revoked` | Emergency revocation |

---

## Integrations

### Agent Skill (Recommended for AI Agents)

```bash
npx skills add grcorsair/corsair
```

Works with Claude Code, Cursor, GitHub Copilot, and [25+ AI agents](https://skills.sh). Your agent can then sign evidence, verify CPOEs, detect compliance drift, and autonomously assess vendor compliance via `trust.txt`.

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
bun test   # 1184 tests, 64 files — all passing
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

## Glossary

Lost in the acronyms? Here's every term in plain English.

### Corsair Terms

| Term | What It Means |
|:-----|:--------------|
| **CPOE** | Certificate of Proof of Operational Effectiveness — a signed compliance proof. Think "digitally signed SOC 2 result." |
| **Parley** | The open protocol behind Corsair. Like SMTP is for email, Parley is for compliance proofs. |
| **MARQUE** | A signed CPOE — the actual JWT you hand to a verifier. Named after letters of marque (pirate commissions). |
| **FLAGSHIP** | Real-time compliance change notifications. If your controls drift, subscribers know immediately. |

### Standards Used

| Term | What It Means |
|:-----|:--------------|
| **JWT-VC** | JSON Web Token — Verifiable Credential. A W3C standard for digitally signed claims. The envelope a CPOE lives in. |
| **DID:web** | Decentralized Identifier anchored to a domain. `did:web:acme.com` means "look up acme.com's public key at `/.well-known/did.json`." |
| **Ed25519** | A modern digital signature algorithm. Fast, small, no weak keys. What Corsair signs with. |
| **SCITT** | Supply Chain Integrity, Transparency, and Trust — an IETF draft for append-only transparency logs. Corsair's audit trail. |
| **SSF/CAEP** | Shared Signals Framework / Continuous Access Evaluation Protocol — OpenID standards for real-time security events. Powers FLAGSHIP. |
| **SD-JWT** | Selective Disclosure JWT — prove specific claims without revealing the full document. Share your SOC 2 score without exposing every control. |
| **in-toto/SLSA** | Supply chain provenance standards. Records the full pipeline that produced a CPOE — who ran what, when, in what order. |
| **COSE** | CBOR Object Signing and Encryption — a compact binary signing format. Used in SCITT receipts. |

### GRC Terms

| Term | What It Means |
|:-----|:--------------|
| **GRC** | Governance, Risk, and Compliance — the industry Corsair operates in. |
| **SOC 2** | A trust framework for service organizations. The most common compliance report in SaaS. |
| **NIST 800-53** | A US government catalog of security controls. One of many frameworks Corsair maps evidence to. |

---

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
  api/                     # Versioned API router
  mcp/                     # MCP server

bin/                       # Standalone CLIs (verify, DID, MCP)
functions/                 # Railway API endpoints
examples/                  # Evidence format examples (8 files)
apps/web/                  # grcorsair.com (Next.js 15)
packages/sdk/              # @corsair/sdk
tests/                     # Test suite
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
