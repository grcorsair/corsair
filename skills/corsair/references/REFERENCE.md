# Corsair CLI Reference

Complete reference for all Corsair CLI commands, flags, and output formats.

## Global Patterns

- **Ed25519 signing**: All signatures use Ed25519 (NIST standard)
- **DID:web identity**: Issuer identity resolved via `/.well-known/did.json`
- **JWT-VC format**: CPOEs are W3C Verifiable Credentials encoded as JWTs
- **Auto-detection**: Evidence format is auto-detected from JSON structure
- **Key directory**: Default `./keys/`, override with `--key-dir <DIR>`
- **Piping**: Most commands support stdin/stdout for composability

## Commands

### corsair sign

Sign security evidence as a CPOE (JWT-VC).

```
corsair sign [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--file <PATH>` | Evidence file path (use `-` for stdin) | Required |
| `-o, --output <PATH>` | Output CPOE file path | Auto-derived |
| `-F, --format <NAME>` | Force parser format | Auto-detect |
| `--did <DID>` | Issuer DID | Derived from key |
| `--scope <TEXT>` | Override scope string | From evidence |
| `--expiry-days <N>` | CPOE validity in days | 90 |
| `--key-dir <DIR>` | Ed25519 key directory | ./keys |
| `--source <SOURCE>` | Override provenance source | derived from evidence |
| `--mapping <PATH>` | Mapping file or directory (repeatable) | none |
| `--dependency <PATH>` | Dependency CPOE path or URL (repeatable) | none |
| `--dry-run` | Parse + classify without signing | false |
| `--json` | Output structured JSON | false |
| `--baseline <PATH>` | Compare against baseline CPOE | none |
| `--gate` | Exit 1 if baseline shows regression | false |
| `--sd-jwt` | Enable SD-JWT selective disclosure | false |
| `--sd-fields <FIELDS>` | Comma-separated fields to disclose | summary,frameworks |
| `-v, --verbose` | Step-by-step progress to stderr | false |
| `-q, --quiet` | Suppress all stderr | false |

**JSON output structure:** (includes `baselineDiff` only when `--baseline` is used)
```json
{
  "cpoe": "<JWT string>",
  "marqueId": "marque-<uuid>",
  "detectedFormat": "prowler",
  "summary": {
    "controlsTested": 42,
    "controlsPassed": 38,
    "controlsFailed": 4,
    "overallScore": 90
  },
  "provenance": {
    "source": "prowler",
    "sourceIdentity": "unknown"
  },
  "warnings": [],
  "baselineDiff": {
    "score": { "previous": 85, "current": 92, "change": 7 },
    "regressions": ["CTRL-003"],
    "improvements": ["CTRL-007"],
    "added": ["CTRL-015"],
    "removed": [],
    "result": "ok"
  }
}
```

**Pipe patterns:**
```bash
# Pipe from tool
prowler aws --output json | corsair sign --file - --format prowler

# Pipe to next command
corsair sign --file evidence.json --json | jq '.summary'

# Sign and verify in one line
corsair sign --file evidence.json -o proof.jwt && corsair verify --file proof.jwt
```

### corsair verify

Verify a CPOE's cryptographic signature and validity.

```
corsair verify [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --file <PATH>` | CPOE file path (JWT or JSON) | Required |
| `-k, --pubkey <PATH>` | Ed25519 public key PEM | ./keys/corsair-signing.pub |
| `--did` | Verify via DID:web resolution | false |
| `--require-issuer <DID>` | Require issuer DID | - |
| `--require-framework <LIST>` | Comma-separated required frameworks | - |
| `--max-age <DAYS>` | Max evidence age (provenance.sourceDate) | - |
| `--min-score <N>` | Minimum overallScore | - |
| `--require-source <TYPE>` | Require provenance source: self\|tool\|auditor | - |
| `--require-source-identity <LIST>` | Comma-separated allowed source identities | - |
| `--require-tool-attestation` | Require toolAttestation in receipts | - |
| `--require-input-binding` | Require provenance.sourceDocument hash binding | - |
| `--require-evidence-chain` | Require evidenceChain + verification | - |
| `--require-receipts` | Require verified process receipts | - |
| `--require-scitt` | Require SCITT entry IDs for receipts | - |
| `--dependencies` | Verify dependency CPOEs (trust graph) | false |
| `--dependency-depth <N>` | Dependency verification depth | 1 |
| `--receipts <PATH>` | Verify process receipts (JSON array) | - |
| `--policy <PATH>` | Apply policy artifact JSON | - |
| `--evidence <PATH>` | Verify evidence chain against JSONL (repeatable) | - |
| `--source-document <PATH>` | Verify provenance.sourceDocument against raw evidence JSON | - |
| `--json` | Output structured JSON | false |

**Exit codes:** 0 = VERIFIED, 1 = FAILED

**JSON output structure:**
```json
{
  "valid": true,
  "issuer": "did:web:acme.com",
  "trustTier": "self-signed",
  "scope": "AWS Production",
  "summary": {
    "controlsTested": 42,
    "controlsPassed": 38,
    "controlsFailed": 4,
    "overallScore": 90
  },
  "provenance": {
    "source": "tool",
    "sourceIdentity": "Acme Corp",
    "sourceDate": "2026-01-15"
  },
  "timestamps": {
    "issuedAt": "2026-02-17T12:00:00.000Z",
    "expiresAt": "2026-05-18T12:00:00.000Z"
  },
  "policy": { "ok": true, "errors": [] },
  "process": { "chainValid": true, "receiptsVerified": 2, "receiptsTotal": 2 },
  "inputBinding": { "ok": true, "errors": [] },
  "evidence": {
    "ok": true,
    "errors": [],
    "actual": {
      "chainType": "hash-linked",
      "algorithm": "sha256",
      "canonicalization": "sorted-json-v1",
      "recordCount": 128,
      "chainVerified": true,
      "chainDigest": "f4c1..."
    }
  },
  "reason": null,
  "format": "JWT-VC"
}
```

### corsair diff

Compare two CPOEs to detect compliance regressions.

```
corsair diff [options]
corsair drift [options]   # alias
```

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --current <PATH>` | Current (new) CPOE JWT | Required |
| `-p, --previous <PATH>` | Previous (baseline) CPOE JWT | Required |
| `--verify` | Verify signatures before diffing | false |
| `--json` | Output structured JSON | false |

**JSON output structure:**
```json
{
  "score": { "previous": 85, "current": 92, "change": 7 },
  "regressions": ["CTRL-003"],
  "improvements": ["CTRL-007", "CTRL-012"],
  "added": ["CTRL-015"],
  "removed": [],
  "result": "ok"
}
```

**Exit codes:** 0 = no regression, 1 = regression detected, 2 = invalid args

### corsair receipts

Evidence inclusion proofs for JSONL evidence chains.

#### generate

```
corsair receipts generate --evidence <JSONL> [--index <N>] [--record-hash <HASH>] [--meta] [-o <PATH>] [--json]
```

Generates receipt(s) proving a specific evidence record exists in the chain.

#### verify

```
corsair receipts verify --file <RECEIPT.json> --cpoe <CPOE.jwt|json> [--json]
```

Verifies receipt inclusion proofs against the CPOE `evidenceChain.chainDigest`.

### corsair log

List signed CPOEs from local files or a SCITT log.

### corsair policy

Validate policy artifacts for verification.

```
corsair policy validate --file <POLICY.json> [--json]
```

```
corsair log [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --last <N>` | Show last N entries | 10 |
| `-d, --dir <DIR>` | Directory to scan | . |
| `--scitt <URL>` | SCITT log endpoint to query | - |
| `--domain <DOMAIN>` | Resolve trust.txt and use its SCITT endpoint | - |
| `--issuer <DID>` | Filter SCITT entries by issuer | - |
| `--framework <NAME>` | Filter SCITT entries by framework | - |
| `--json` | Output structured JSON | false |

#### register

```
corsair log register --file <CPOE.jwt> --scitt <URL> [--proof-only] [--json]
corsair log register --file <CPOE.jwt> --domain <DOMAIN> [--proof-only]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --file <PATH>` | CPOE JWT file path | Required |
| `--scitt <URL>` | SCITT log endpoint (POST /scitt/entries) | - |
| `--domain <DOMAIN>` | Resolve trust.txt for SCITT endpoint | - |
| `--proof-only` | Register hash commitment only | false |
| `--json` | Output structured JSON | false |

### corsair trust-txt

Compliance proof discovery via `/.well-known/trust.txt`.

**Subcommands:**

#### generate
```
corsair trust-txt generate [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--did <DID>` | DID:web identity | Required |
| `--cpoes <DIR>` | Directory to scan for .jwt files | - |
| `--cpoe-url <URL>` | Add CPOE URL (repeatable) | - |
| `--base-url <URL>` | Base URL prefix for scanned CPOEs | - |
| `--scitt <URL>` | SCITT log endpoint | - |
| `--catalog <URL>` | Catalog snapshot with per-CPOE metadata | - |
| `--policy <URL>` | Policy artifact URL | - |
| `--flagship <URL>` | FLAGSHIP signal stream | - |
| `--frameworks <LIST>` | Comma-separated framework names | - |
| `--contact <EMAIL>` | Compliance contact | - |
| `--expiry-days <N>` | Validity in days | 365 |
| `-o, --output <PATH>` | Output file | stdout |

#### validate
```
corsair trust-txt validate <DOMAIN> [--json]
```

Exit codes: 0 = valid, 1 = invalid

#### discover
```
corsair trust-txt discover <DOMAIN> [--json] [--verify] [--scitt-limit <N>]
```

Exit codes: 0 = found, 1 = not found or failed

### corsair mappings

List, validate, add, and package evidence mappings.

```
corsair mappings list [--mapping <PATH>] [--json]
corsair mappings validate [--mapping <PATH>] [--sample <PATH>] [--strict] [--json]
corsair mappings add --url <URL> [--dir <DIR>]
corsair mappings add --file <PATH> [--dir <DIR>]
corsair mappings pack --id <ID> --version <VER> --mapping <PATH> [--issued-at <ISO>] [--output <PATH>]
corsair mappings sign --file <PACK.json> --key <KEY.pem> [--output <PATH>]
```

Signed packs are verified when `CORSAIR_MAPPING_PACK_PUBKEY` is set.

### corsair signal

Generate and verify FLAGSHIP real-time compliance change notifications (SETs).

#### generate
```
corsair signal generate --event <PATH> --issuer <DID> --audience <DID> [--key-dir <DIR>] [--output <PATH>] [--json]
```

#### verify
```
corsair signal verify --file <PATH> [--key-dir <DIR>] [--json]
```

FLAGSHIP delivers SSF/CAEP events as Ed25519-signed SETs:
- `FLEET_ALERT` (compliance-change) — Drift detected
- `PAPERS_CHANGED` (credential-change) — CPOE issued/renewed/revoked
- `MARQUE_REVOKED` (session-revoked) — Emergency revocation

### corsair keygen

Generate Ed25519 signing keypair.

```
corsair keygen [-o <DIR>]
```

Creates `corsair-signing.key` (private) and `corsair-signing.pub` (public).

### corsair init

Initialize Corsair in current directory.

```
corsair init [--key-dir <DIR>]
```

Creates keys + example evidence file.

### corsair renew

Re-sign a CPOE with fresh dates.

```
corsair renew [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --file <PATH>` | Existing CPOE JWT | Required |
| `-e, --evidence <PATH>` | New evidence JSON | - |
| `-o, --output <PATH>` | Output file | stdout |
| `--key-dir <DIR>` | Key directory | ./keys |
| `--json` | Structured JSON output | false |

## Evidence Format Detection

Corsair auto-detects evidence format from JSON structure:

| Format | Detection Signal |
|--------|-----------------|
| prowler | Array with `StatusCode` + `FindingInfo` fields |
| securityhub | Object with `Findings` array (ASFF format) |
| inspec | Object with `profiles[].controls` |
| trivy | Object with `SchemaVersion` + `Results` |
| gitlab | Object with `scan` + `vulnerabilities` |
| ciso-assistant-api | Object with `count` + `results` |
| ciso-assistant-export | Object with `meta` + `requirement_assessments` |
| generic | Object with `controls` array |

## trust.txt Format

```
# Corsair Trust Discovery
DID: did:web:example.com
SCITT: https://example.com/scitt/entries?issuer=did:web:example.com
CATALOG: https://example.com/compliance/catalog.json
FLAGSHIP: https://example.com/api/ssf/stream
Frameworks: SOC2, ISO27001
Contact: compliance@example.com
Expires: 2027-01-01T00:00:00Z
```

Hosted at `https://<domain>/.well-known/trust.txt`
