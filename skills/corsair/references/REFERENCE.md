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
| `--dry-run` | Parse + classify without signing | false |
| `--json` | Output structured JSON | false |
| `--sd-jwt` | Enable SD-JWT selective disclosure | false |
| `--sd-fields <FIELDS>` | Comma-separated fields to disclose | summary,frameworks |
| `-v, --verbose` | Step-by-step progress to stderr | false |
| `-q, --quiet` | Suppress all stderr | false |

**JSON output structure:**
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
  "warnings": []
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

**Exit codes:** 0 = VERIFIED, 1 = FAILED

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

### corsair log

List signed CPOEs in a directory.

```
corsair log [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --last <N>` | Show last N entries | 10 |
| `-d, --dir <DIR>` | Directory to scan | . |

### corsair compliance-txt

Compliance proof discovery via `/.well-known/compliance.txt`.

**Subcommands:**

#### generate
```
corsair compliance-txt generate [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--did <DID>` | DID:web identity | Required |
| `--cpoes <DIR>` | Directory to scan for .jwt files | - |
| `--cpoe-url <URL>` | Add CPOE URL (repeatable) | - |
| `--base-url <URL>` | Base URL prefix for scanned CPOEs | - |
| `--scitt <URL>` | SCITT log endpoint | - |
| `--flagship <URL>` | FLAGSHIP signal stream | - |
| `--frameworks <LIST>` | Comma-separated framework names | - |
| `--contact <EMAIL>` | Compliance contact | - |
| `--expiry-days <N>` | Validity in days | 365 |
| `-o, --output <PATH>` | Output file | stdout |

#### validate
```
corsair compliance-txt validate <DOMAIN> [--json]
```

Exit codes: 0 = valid, 1 = invalid

#### discover
```
corsair compliance-txt discover <DOMAIN> [--json] [--verify]
```

Exit codes: 0 = found, 1 = not found or failed

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

## compliance.txt Format

```
# Corsair Compliance Discovery
DID: did:web:example.com
CPOE: https://example.com/soc2-2025.jwt
CPOE: https://example.com/iso27001-2025.jwt
SCITT: https://example.com/api/scitt
FLAGSHIP: https://example.com/api/ssf/stream
Frameworks: SOC2, ISO27001
Contact: compliance@example.com
Expires: 2027-01-01T00:00:00Z
```

Hosted at `https://<domain>/.well-known/compliance.txt`
