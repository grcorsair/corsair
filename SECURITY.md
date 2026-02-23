# Security Policy — Corsair

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Ahoy, Security Researcher!**

If you've discovered a vulnerability in Corsair, we want to hear from you.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: security@grcorsair.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Status update within 7 days
- Credit in release notes (unless you prefer anonymity)

## Scope

Corsair is a compliance trust exchange protocol with multiple surfaces:

**In scope**
- CLI (`corsair.ts`) and related libraries in `src/`
- API server (`server.ts`, `functions/`)
- Web UI (`apps/web/`)
- SDK (`packages/sdk/`) and any published npm artifacts

**Out of scope**
- Third‑party scanners or evidence sources
- Customer‑managed infrastructure and hosting configuration
- Vendor trust centers or external GRC platforms

The following are **not** vulnerabilities:
- Test CPOEs containing synthetic compliance data (expected — examples are synthetic)
- The tool generates Ed25519 keypairs for signing (by design)
- Evidence files from ingestion contain extracted text (expected behavior)

## Network Access Notice

Corsair performs outbound HTTPS requests when you use:
- `trust.txt` discovery and validation
- DID:web resolution
- SCITT list/registration
- SSF/CAEP (FLAGSHIP) endpoints

This network access is intentional and required for verification workflows. Offline usage is possible by providing local CPOEs and public keys and avoiding discovery calls.

## Cryptography and Keys

- CPOEs are signed with Ed25519 via `jose`.
- Server‑side signing keys are encrypted at rest (AES‑256‑GCM).
- Public keys are exposed via `/.well-known/did.json` and `/.well-known/jwks.json`.

## Data Handling

Evidence can contain sensitive data. Treat input evidence as confidential and avoid committing real customer evidence to the repo. Use synthetic examples in tests and docs.

**Fair winds and following seas, security researcher.**
