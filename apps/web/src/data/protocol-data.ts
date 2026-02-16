/**
 * Static data for the /protocol deep-dive page.
 * All structures mirror real backend types from src/parley/vc-types.ts.
 */

/* ─── DID Resolution Flow ────────────────────────── */

export const DID_RESOLUTION_STEPS = [
  {
    step: 1,
    label: "Parse DID",
    input: "did:web:grcorsair.com",
    output: "domain = grcorsair.com",
    detail: "Extract domain from DID method-specific identifier",
  },
  {
    step: 2,
    label: "Construct URL",
    input: "grcorsair.com",
    output: "https://grcorsair.com/.well-known/did.json",
    detail: "Map domain to HTTPS well-known path per W3C DID:web spec",
  },
  {
    step: 3,
    label: "Fetch Document",
    input: "GET /.well-known/did.json",
    output: '{ "verificationMethod": [...] }',
    detail: "HTTP GET retrieves the DID document with public keys",
  },
  {
    step: 4,
    label: "Match Key ID",
    input: 'kid: "did:web:grcorsair.com#key-1"',
    output: '{ "crv": "Ed25519", "x": "..." }',
    detail: "Find the JWK matching the JWT header kid claim",
  },
];

export const DID_DOCUMENT_EXAMPLE = `{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1"
  ],
  "id": "did:web:grcorsair.com",
  "verificationMethod": [{
    "id": "did:web:grcorsair.com#key-1",
    "type": "JsonWebKey2020",
    "controller": "did:web:grcorsair.com",
    "publicKeyJwk": {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "dGhpcyBpcyBhIHNhbXBsZSBwdWJsaWMga2V5"
    }
  }],
  "authentication": ["did:web:grcorsair.com#key-1"],
  "assertionMethod": ["did:web:grcorsair.com#key-1"]
}`;

/* ─── JWT-VC Anatomy ─────────────────────────────── */

export const JWT_VC_LAYERS = [
  {
    name: "Header",
    color: "corsair-gold",
    fields: [
      { key: "alg", value: "EdDSA", note: "Ed25519 curve — 128-bit security, 64-byte signatures" },
      { key: "typ", value: "vc+jwt", note: "W3C VC-JOSE-COSE media type" },
      { key: "kid", value: "did:web:grcorsair.com#key-1", note: "DID URL pointing to signing key" },
    ],
  },
  {
    name: "Payload",
    color: "corsair-turquoise",
    fields: [
      { key: "iss", value: "did:web:grcorsair.com", note: "Issuer identity — resolvable DID" },
      { key: "sub", value: "marque-a1b2c3d4...", note: "Unique CPOE identifier" },
      { key: "iat", value: "1739059200", note: "Issued-at timestamp (Unix epoch)" },
      { key: "exp", value: "1739664000", note: "Expiry — 7 days default" },
      { key: "parley", value: "2.0", note: "Protocol version for forward compatibility" },
      { key: "vc", value: "{ ... }", note: "W3C Verifiable Credential envelope" },
    ],
  },
  {
    name: "Signature",
    color: "corsair-green",
    fields: [
      { key: "algorithm", value: "Ed25519", note: "Elliptic curve — no key size choice paralysis" },
      { key: "size", value: "64 bytes", note: "Compact signature, fast verification" },
      { key: "verify", value: "Any JWT library", note: "jose, PyJWT, go-jose — standard tooling" },
    ],
  },
];

/* ─── Binary Checks (CIS-Style) ──────────────────── */

export interface BinaryCheck {
  id: string;
  name: string;
  category: "evidence" | "provenance" | "integrity" | "scope";
  passed: boolean;
  detail: string;
}

export const BINARY_CHECKS: BinaryCheck[] = [
  { id: "evidence-exists", name: "Evidence Exists", category: "evidence", passed: true, detail: "Every control has evidence text" },
  { id: "evidence-date-present", name: "Evidence Date Valid", category: "evidence", passed: true, detail: "ISO-8601 date present and parseable" },
  { id: "no-future-dates", name: "No Future Dates", category: "evidence", passed: true, detail: "All dates are in the past" },
  { id: "no-expired-evidence", name: "No Expired Evidence", category: "evidence", passed: false, detail: "Evidence is 468 days old (>365 day limit)" },
  { id: "source-identified", name: "Source Identified", category: "provenance", passed: true, detail: "Provenance source is 'auditor'" },
  { id: "source-identity-present", name: "Source Identity Named", category: "provenance", passed: true, detail: "Example Audit Firm LLP" },
  { id: "document-hash-valid", name: "Source Hash Valid", category: "provenance", passed: true, detail: "SHA-256 hash of source evidence present" },
  { id: "no-duplicate-evidence", name: "No Duplicate Evidence", category: "provenance", passed: true, detail: "<3 controls share identical evidence" },
  { id: "methodology-present", name: "Methodology Detected", category: "integrity", passed: true, detail: "3 controls have CAAT methodology" },
  { id: "sample-size-adequate", name: "Sample Size Adequate", category: "integrity", passed: true, detail: "No INADEQUATE sample sizes found" },
  { id: "anti-gaming-pass", name: "Anti-Gaming Pass", category: "integrity", passed: false, detail: "Freshness decay safeguard triggered" },
  { id: "signature-valid", name: "Signature Valid", category: "integrity", passed: true, detail: "Ed25519 signature verified against DID key" },
  { id: "framework-mapped", name: "Framework Mapped", category: "scope", passed: true, detail: "7 frameworks mapped via CTID/SCF" },
  { id: "scope-non-empty", name: "Scope Defined", category: "scope", passed: true, detail: "Scope: 'SOC 2 Type II — Cloud Platform'" },
  { id: "exclusion-rationale", name: "Exclusion Rationale", category: "scope", passed: true, detail: "No excluded controls in this CPOE" },
];

/* ─── SCITT / Merkle Tree ────────────────────────── */

export const MERKLE_TREE_EXAMPLE = {
  leafCount: 8,
  treeHeight: 3,
  targetLeaf: 2,
  leafLabels: [
    "CPOE #1", "CPOE #2", "CPOE #3*", "CPOE #4",
    "CPOE #5", "CPOE #6", "CPOE #7", "CPOE #8",
  ],
  proofPath: [3, 1], // indices of sibling nodes needed for proof
  rootHash: "a7f3c9b2...d1e8f4a6",
};

export const SCITT_RECEIPT_EXAMPLE = `{
  "entryId": "scitt-entry-a7f3c9b2",
  "registrationTime": "2026-02-09T14:30:00Z",
  "logId": "corsair-transparency-log-v1",
  "proof": "COSE_Sign1(Merkle inclusion proof)",
  "leafHash": "SHA-256(CPOE JWT)",
  "treeSize": 1247,
  "leafIndex": 1246
}`;

export const COSE_RECEIPT_STRUCTURE = [
  { field: "Protected Header", value: "{ alg: EdDSA, content_type: application/cose }", note: "CBOR-encoded, same Ed25519" },
  { field: "Unprotected Header", value: "{ kid: log-key-1 }", note: "Log signing key identifier" },
  { field: "Payload", value: "Merkle inclusion proof", note: "Leaf index + sibling hashes" },
  { field: "Signature", value: "Ed25519(protected || payload)", note: "Log operator signs the receipt" },
];

/* ─── FLAGSHIP / SSF / CAEP Events ───────────────── */

export interface FlagshipEvent {
  time: string;
  pirateName: string;
  caepType: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

export const FLAGSHIP_TIMELINE: FlagshipEvent[] = [
  {
    time: "2026-02-09T14:30:00Z",
    pirateName: "PAPERS_CHANGED",
    caepType: "credential-change",
    description: "CPOE issued — provenance: auditor, 82 controls assessed",
    severity: "info",
  },
  {
    time: "2026-03-01T16:42:00Z",
    pirateName: "FLEET_ALERT",
    caepType: "compliance-change",
    description: "Drift detected — MFA disabled on admin accounts (CC6.1)",
    severity: "warning",
  },
  {
    time: "2026-03-02T08:30:00Z",
    pirateName: "FLEET_ALERT",
    caepType: "compliance-change",
    description: "Drift resolved — MFA re-enabled, evidence refreshed",
    severity: "info",
  },
  {
    time: "2026-03-05T10:05:00Z",
    pirateName: "PAPERS_CHANGED",
    caepType: "credential-change",
    description: "CPOE renewed after drift resolution — updated evidence attached",
    severity: "info",
  },
];

/* ─── Protocol Standards Composition ─────────────── */

export const PROTOCOL_STANDARDS = [
  {
    name: "JWT-VC",
    fullName: "W3C Verifiable Credentials (JWT)",
    role: "Attestation envelope",
    spec: "W3C VC Data Model 2.0",
    what: "The CPOE itself — a signed JSON Web Token carrying compliance claims",
    why: "Industry standard, any JWT library can verify, no vendor lock-in",
  },
  {
    name: "DID:web",
    fullName: "Decentralized Identifier (Web)",
    role: "Issuer identity",
    spec: "W3C DID Core 1.0",
    what: "Maps organizations to HTTPS domains — did:web:grcorsair.com → grcorsair.com/.well-known/did.json",
    why: "No blockchain, no registry, just DNS + HTTPS you already control",
  },
  {
    name: "SCITT",
    fullName: "Supply Chain Integrity, Transparency & Trust",
    role: "Transparency log",
    spec: "IETF draft-ietf-scitt-architecture",
    what: "Append-only log with Merkle proofs — once registered, a CPOE cannot be silently removed",
    why: "Same concept as Certificate Transparency but for compliance artifacts",
  },
  {
    name: "SSF/CAEP",
    fullName: "Shared Signals Framework / CAEP",
    role: "Real-time notifications",
    spec: "OpenID SSF 1.0 (Final, Sept 2025)",
    what: "Push/poll delivery of compliance state changes — drift, revocation, scope updates",
    why: "Compliance is continuous, not annual. FLAGSHIP makes that visible",
  },
  {
    name: "Ed25519",
    fullName: "Edwards-curve Digital Signature Algorithm",
    role: "Cryptographic signature",
    spec: "RFC 8032",
    what: "128-bit security, 64-byte signatures, deterministic — no random number generator risk",
    why: "Fast, compact, no configuration choices. One curve, one key size, no footguns",
  },
  {
    name: "in-toto/SLSA",
    fullName: "in-toto Attestation + SLSA Provenance",
    role: "Process provenance (advanced)",
    spec: "in-toto v1 + SLSA v1.0",
    what: "Optional COSE-signed receipts for each pipeline step — hash-linked chain proving how the CPOE was built",
    why: "Advanced layer for high-trust workflows. Proves the pipeline ran correctly, not just that the output looks right",
  },
];

/* ─── Verification Flow ──────────────────────────── */

export const VERIFICATION_STEPS = [
  {
    step: 1,
    action: "Decode JWT",
    detail: "Base64url decode header + payload. No crypto yet — anyone can read the claims.",
    code: "const [header, payload] = jwt.split('.').slice(0,2).map(base64urlDecode)",
  },
  {
    step: 2,
    action: "Resolve DID",
    detail: "Convert issuer DID to HTTPS URL. Fetch the DID document containing the public key.",
    code: "const didDoc = await fetch('https://grcorsair.com/.well-known/did.json')",
  },
  {
    step: 3,
    action: "Extract Key",
    detail: "Find the JWK in the DID document matching the JWT header's kid claim.",
    code: "const jwk = didDoc.verificationMethod.find(m => m.id === header.kid).publicKeyJwk",
  },
  {
    step: 4,
    action: "Verify Signature",
    detail: "Ed25519 verification — 64-byte signature checked against the public key.",
    code: "const { payload } = await jwtVerify(cpoeJwt, await importJWK(jwk, 'EdDSA'))",
  },
];
