# CPOE Format Specification v1.0

**Certificate of Proof of Operational Effectiveness**

> This specification is licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
> You are free to implement, extend, and build upon this specification. Attribution required.
> Copyright 2026 Corsair (grcorsair.com)

## 1. Overview

A CPOE is a signed compliance attestation in W3C Verifiable Credential format (JWT-VC). It asserts that a specific set of controls was assessed, with cryptographic proof of who made the assertion and when. Anyone can verify a CPOE using standard JWT libraries and the issuer's public key, resolved via DID:web.

## 2. Format

A CPOE is a standard JWT with three base64url-encoded segments: `header.payload.signature`.

### Header

```json
{ "alg": "EdDSA", "typ": "vc+jwt", "kid": "did:web:grcorsair.com#key-1" }
```

- `alg` is always `EdDSA` (Ed25519 curve).
- `typ` is always `vc+jwt` per the W3C VC-JOSE-COSE specification.
- `kid` is a DID URL pointing to the signing key in the issuer's DID document.

### Payload

```json
{
  "iss": "did:web:grcorsair.com",
  "sub": "marque-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "jti": "marque-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "iat": 1739059200,
  "exp": 1739664000,
  "parley": "2.0",
  "vc": {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://grcorsair.com/credentials/v1"
    ],
    "type": ["VerifiableCredential", "CorsairCPOE"],
    "issuer": { "id": "did:web:grcorsair.com", "name": "Corsair" },
    "validFrom": "2026-02-09T00:00:00.000Z",
    "validUntil": "2026-02-16T00:00:00.000Z",
    "credentialSubject": {
      "type": "CorsairCPOE",
      "schemaVersion": "1.0",
      "scope": "SOC 2 Type II - Cloud Infrastructure Controls",
      "provenance": {
        "source": "tool",
        "sourceIdentity": "Prowler v3.1",
        "sourceDate": "2026-01-15T00:00:00Z"
      },
      "summary": {
        "controlsTested": 22,
        "controlsPassed": 20,
        "controlsFailed": 2,
        "overallScore": 91
      },
      "extensions": {
        "mapping": { "id": "toolx-evidence-only", "evidenceOnly": true },
        "passthrough": { "summary": { "passed": 12, "failed": 2 } }
      }
    }
  }
}
```

## 3. Required Claims

All claims live under `vc.credentialSubject`. The provenance-first model (v0.5.0+) requires only provenance and summary. Assurance scoring is optional enrichment.

| Claim | Type | Description |
|-------|------|-------------|
| `type` | `"CorsairCPOE"` | Credential subject discriminator. Always this value. |
| `scope` | string | Human-readable assessment scope (e.g., "SOC 2 Type II - AWS Production") |
| `provenance.source` | string | Who produced the evidence: `"self"`, `"tool"`, or `"auditor"` |
| `summary.controlsTested` | number | Total controls assessed |
| `summary.controlsPassed` | number | Controls that passed |
| `summary.controlsFailed` | number | Controls that failed |
| `summary.overallScore` | number | Pass rate as percentage (0-100) |

**Summary derivation:** When control-level results are present, `summary.*` MUST be derived from the control statuses (effective/ineffective/not-tested). Framework mappings are optional and must not override control-derived summary totals.

### Optional Claims

| Claim | Type | Description |
|-------|------|-------------|
| `provenance.sourceIdentity` | string | Who produced the evidence (e.g., "Deloitte LLP", "Prowler v3.1") |
| `provenance.sourceDocument` | string | SHA-256 hash of the source document |
| `provenance.sourceDate` | string | ISO 8601 date of the source assessment |
| `evidenceChain` | object | Evidence chain metadata: `{ chainType, algorithm, canonicalization, recordCount, chainVerified, chainDigest, chainStartHash?, chainHeadHash?, chains? }` |
| `frameworks` | object | Per-framework results (keyed by framework name) |
| `processProvenance` | object | Pipeline receipt chain: `{ chainDigest, receiptCount, chainVerified, format, reproducibleSteps, attestedSteps, scittEntryIds? }` — in-toto/SLSA provenance trail |
| `schemaVersion` | string | CPOE schema version (current: `"1.0"`) |
| `extensions` | object | Optional passthrough fields and mapping metadata (namespaced keys only) |

**Evidence chain fields:**

- `chainType` — `"hash-linked"` (JSONL records linked by SHA-256)
- `algorithm` — `"sha256"`
- `canonicalization` — `"sorted-json-v1"` (keys sorted before hashing)
- `chainDigest` — Merkle root of record hashes (or `"none"` if empty)
- `chainStartHash` / `chainHeadHash` — First/last record hash (only when a single chain is included)
- `chains` — Optional array of per-file summaries when multiple evidence files are included

**Evidence receipts (optional):** Receipts are separate JSON artifacts that prove a specific evidence
record exists in the chain without disclosing the record. Receipts verify against
`evidenceChain.chainDigest`.

**Extensions namespace rules:** `extensions` keys must be `mapping`, `passthrough`, or namespaced with
`x-` / `ext.`. Unknown un-namespaced keys are invalid.

## 4. Verification Flow

Verifying a CPOE takes four steps.

```
1. Decode the JWT header and payload (base64url, no crypto needed yet)
2. Resolve the issuer's DID document via HTTP
3. Extract the public key matching header.kid
4. Verify the Ed25519 signature
```

### TypeScript (using jose)

```typescript
import { jwtVerify, importJWK } from "jose";

const didUrl = "https://grcorsair.com/.well-known/did.json";
const didDoc = await fetch(didUrl).then(r => r.json());
const jwk = didDoc.verificationMethod[0].publicKeyJwk;
const key = await importJWK(jwk, "EdDSA");
const { payload } = await jwtVerify(cpoeJwt, key);
console.log(payload.vc.credentialSubject.summary.overallScore); // 91
```

### Python (using PyJWT + cryptography)

```python
import jwt, requests
from jwt.algorithms import OKPAlgorithm

did_url = "https://grcorsair.com/.well-known/did.json"
did_doc = requests.get(did_url).json()
jwk = did_doc["verificationMethod"][0]["publicKeyJwk"]
key = OKPAlgorithm.from_jwk(jwk)
payload = jwt.decode(cpoe_jwt, key, algorithms=["EdDSA"])
print(payload["vc"]["credentialSubject"]["summary"]["overallScore"])  # 91
```

### DID Resolution

The `iss` claim is a `did:web` DID. To resolve it to a URL:

- `did:web:grcorsair.com` resolves to `https://grcorsair.com/.well-known/did.json`
- `did:web:example.com:dept:security` resolves to `https://example.com/dept/security/did.json`
- Percent-encoded colons in the domain are decoded: `did:web:localhost%3A3000` resolves to `https://localhost:3000/.well-known/did.json`

The DID document contains a `verificationMethod` array. Match the `kid` from the JWT header to find the correct public key (JWK format, `"crv": "Ed25519"`).

## 5. Discovery (trust.txt)

CPOEs are meant to be discoverable without a prior relationship. Organizations should publish
`/.well-known/trust.txt` (modeled after `security.txt`) to advertise their DID identity,
SCITT log endpoint, optional catalog snapshot, and FLAGSHIP stream. For scale, keep
trust.txt tiny and point to SCITT + catalog instead of listing many CPOEs.

trust.txt is a plain-text file with `KEY: value` pairs (keys are case-insensitive). The
`CPOE` key is repeatable.
For large sets of proofs, keep trust.txt minimal and link to a catalog snapshot.

Example:

```
# Corsair Trust Discovery
# Spec: https://grcorsair.com/spec/trust-txt

DID: did:web:acme.com

CPOE: https://acme.com/compliance/soc2.jwt
CPOE: https://acme.com/compliance/iso27001.jwt

SCITT: https://scitt.acme.com/v1/entries?issuer=did:web:acme.com
CATALOG: https://acme.com/compliance/catalog.json
FLAGSHIP: https://acme.com/.well-known/flagship
Frameworks: SOC2, ISO27001
Contact: security@acme.com
Expires: 2026-06-01
```

## 6. Issuer Identity (DID:web)

CPOE issuers are identified by `did:web` DIDs, which map directly to HTTPS domains. The DID document hosted at the resolved URL contains the Ed25519 public key in JWK format. Example at `https://grcorsair.com/.well-known/did.json`:

```json
{
  "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
  "id": "did:web:grcorsair.com",
  "verificationMethod": [{
    "id": "did:web:grcorsair.com#key-1",
    "type": "JsonWebKey2020",
    "controller": "did:web:grcorsair.com",
    "publicKeyJwk": { "kty": "OKP", "crv": "Ed25519", "x": "base64url-encoded-public-key" }
  }],
  "authentication": ["did:web:grcorsair.com#key-1"],
  "assertionMethod": ["did:web:grcorsair.com#key-1"]
}
```

## 7. Trust Tiers (Verification Display)

When a verifier checks a CPOE, the result falls into one of four display tiers:

| Display | Condition |
|---------|-----------|
| **Corsair Verified** | Signed by `did:web:grcorsair.com`, valid Ed25519 signature |
| **Self-Signed Valid** | Valid Ed25519 signature, issuer DID resolves, not Corsair |
| **Unverifiable** | DID resolution failed (issuer unreachable, not invalid) |
| **Invalid** | Signature verification failed, JWT malformed, or credential expired |

## 8. Extensions (Optional)

These are not required for verification but enable advanced trust workflows.

- **SCITT**: Register CPOEs in an IETF SCITT transparency log for tamper-evident auditability.
- **FLAGSHIP**: Real-time compliance change signals via OpenID SSF/CAEP (drift, revocation, tier changes).
- **SD-JWT**: Selective disclosure -- prove compliance without exposing the full assessment.
- **Verifiable Presentations**: Bundle multiple VCs for third-party attestations.

---

CPOE is an open format. Implement it, extend it, build on it.

This specification is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The reference implementation is licensed under [Apache 2.0](LICENSE).

Specification source: [github.com/arudjreis/corsair](https://github.com/arudjreis/corsair)
