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

/* ─── Seven-Dimension Assurance Model ────────────── */

export interface DimensionData {
  name: string;
  key: string;
  score: number;
  maxScore: number;
  source: string;
  description: string;
  thresholds: { L1: number; L2: number; L3: number };
}

export const ASSURANCE_DIMENSIONS: DimensionData[] = [
  {
    name: "Capability",
    key: "capability",
    score: 93,
    maxScore: 100,
    source: "COSO Design Effectiveness",
    description: "Control strength as designed — does the control address the risk?",
    thresholds: { L1: 40, L2: 60, L3: 80 },
  },
  {
    name: "Coverage",
    key: "coverage",
    score: 100,
    maxScore: 100,
    source: "FAIR-CAM Coverage",
    description: "Percentage of in-scope assets protected by the control",
    thresholds: { L1: 30, L2: 50, L3: 80 },
  },
  {
    name: "Reliability",
    key: "reliability",
    score: 56,
    maxScore: 100,
    source: "COSO Operating Effectiveness",
    description: "Consistency of control operation over the observation period",
    thresholds: { L1: 30, L2: 50, L3: 70 },
  },
  {
    name: "Methodology",
    key: "methodology",
    score: 50,
    maxScore: 100,
    source: "GRADE Risk of Bias + NIST 800-53A",
    description: "Assessment rigor — reperformance > CAAT > inspection > inquiry",
    thresholds: { L1: 20, L2: 40, L3: 60 },
  },
  {
    name: "Freshness",
    key: "freshness",
    score: 0,
    maxScore: 100,
    source: "ISO 27004 Timing",
    description: "Recency of evidence — decays linearly from 100 to 0 over 365 days",
    thresholds: { L1: 20, L2: 40, L3: 60 },
  },
  {
    name: "Independence",
    key: "independence",
    score: 85,
    maxScore: 100,
    source: "Three Lines Model",
    description: "Separation between assessor and assessed — 1st line (self) to 4th line (external)",
    thresholds: { L1: 20, L2: 40, L3: 70 },
  },
  {
    name: "Consistency",
    key: "consistency",
    score: 100,
    maxScore: 100,
    source: "GRADE Inconsistency",
    description: "Do multiple evidence sources agree? Penalizes contradictory findings",
    thresholds: { L1: 30, L2: 50, L3: 70 },
  },
];

/* ─── Anti-Gaming Safeguards ─────────────────────── */

export interface SafeguardData {
  id: string;
  name: string;
  description: string;
  trigger: string;
  result: string;
  triggered: boolean;
}

export const SAFEGUARDS: SafeguardData[] = [
  {
    id: "sampling-opacity",
    name: "Sampling Opacity",
    description: "Less than 50% of controls have substantive evidence",
    trigger: "38 of 82 controls lack evidence",
    result: "Capped at L0",
    triggered: false,
  },
  {
    id: "freshness-decay",
    name: "Freshness Decay",
    description: "Evidence older than 180 days triggers staleness penalty",
    trigger: "Evidence is 468 days old",
    result: "Capped at L1",
    triggered: true,
  },
  {
    id: "independence-check",
    name: "Independence Check",
    description: "Self-assessed evidence cannot claim L2+ assurance",
    trigger: "provenance.source = 'self' with declared > L2",
    result: "Capped at L1",
    triggered: false,
  },
  {
    id: "severity-asymmetry",
    name: "Severity Asymmetry",
    description: "HIGH-risk controls weaker than LOW-risk controls",
    trigger: "Critical controls at L0 while minor controls at L2",
    result: "Capped at min(critical controls)",
    triggered: false,
  },
  {
    id: "all-pass-bias",
    name: "All-Pass Bias",
    description: "100% pass rate with 10+ controls triggers GRADE skepticism flag",
    trigger: "82 controls, 76 effective (93%) — below threshold",
    result: "No cap — failure rate is realistic",
    triggered: false,
  },
];

/* ─── Rule Trace Example ─────────────────────────── */

export interface RuleTraceEntry {
  type: "RULE" | "OVERRIDE" | "SAFEGUARD" | "ENFORCED" | "RESULT";
  text: string;
  detail?: string;
}

export const RULE_TRACE_EXAMPLE: RuleTraceEntry[] = [
  { type: "RULE", text: "82 controls checked across SOC 2 Type II scope" },
  { type: "RULE", text: 'Source "prowler" ceiling = L1 (automated config scan)', detail: "Prowler outputs confirm settings are enabled, not test results" },
  { type: "RULE", text: "3 controls have test evidence (pentest, InSpec profiles)", detail: "CC7.1, CC7.2, CC5.1 — these qualify for L2" },
  { type: "OVERRIDE", text: "Test evidence elevates 3 controls: L1 → L2" },
  { type: "RULE", text: 'Breakdown = { "L0": 6, "L1": 73, "L2": 3 }' },
  { type: "RULE", text: "Minimum of in-scope controls = L0 (6 controls at Documented)" },
  { type: "RULE", text: "Freshness checked — evidence is 468 days old (stale)" },
  { type: "SAFEGUARD", text: "Freshness decay: evidence >180 days — dimension capped at 0/100" },
  { type: "RULE", text: "Observation period: 365 days (sufficient for continuous scan)" },
  { type: "RULE", text: "DORA band: methodology=low, specificity=medium — overall band: low" },
  { type: "ENFORCED", text: "Declared L0 matches floor — no cap enforced" },
  { type: "RESULT", text: "CPOE issued at L0 (Documented) — self-assessed, verified=true" },
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
  { id: "assurance-verified", name: "Assurance Verified", category: "scope", passed: true, detail: "Declared L0 matches min of controls" },
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
    description: "CPOE issued — L0 Documented, 82 controls assessed",
    severity: "info",
  },
  {
    time: "2026-02-12T09:15:00Z",
    pirateName: "COLORS_CHANGED",
    caepType: "assurance-level-change",
    description: "Assurance upgraded L0 → L1 after config evidence submitted",
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
    time: "2026-03-01T17:10:00Z",
    pirateName: "COLORS_CHANGED",
    caepType: "assurance-level-change",
    description: "Assurance downgraded L1 → L0 due to compliance drift",
    severity: "critical",
  },
  {
    time: "2026-03-02T08:30:00Z",
    pirateName: "FLEET_ALERT",
    caepType: "compliance-change",
    description: "Drift resolved — MFA re-enabled, evidence refreshed",
    severity: "info",
  },
  {
    time: "2026-03-02T08:45:00Z",
    pirateName: "COLORS_CHANGED",
    caepType: "assurance-level-change",
    description: "Assurance restored L0 → L1 after drift resolution",
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
    what: "Push/poll delivery of compliance state changes — drift, revocation, level changes",
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
    why: "Advanced layer for high-assurance workflows. Proves the pipeline ran correctly, not just that the output looks right",
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

/* ─── DORA Metrics ───────────────────────────────── */

export const DORA_METRICS = {
  freshness: { value: 0, pair: "reproducibility", pairValue: 45, divergence: 45, flagged: true },
  specificity: { value: 62, pair: "independence", pairValue: 85, divergence: 23, flagged: false },
  independence: { value: 85, pair: "specificity", pairValue: 62, divergence: 23, flagged: false },
  reproducibility: { value: 45, pair: "freshness", pairValue: 0, divergence: 45, flagged: true },
  band: "low" as const,
};
