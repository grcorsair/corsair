export const VERIFY_4_LINES = [
  "header, payload = decode_jwt(cpoe)",
  "did_doc = fetch_did(payload[\"iss\"])",
  "key = did_doc[\"verificationMethod\"][0][\"publicKeyJwk\"]",
  "verify_ed25519(cpoe, key)",
];

export const COMPLIANCE_TXT_SNIPPET = [
  "# /.well-known/compliance.txt",
  "DID: did:web:acme.com",
  "CPOE: https://acme.com/compliance/q1.jwt",
  "SCITT: https://acme.com/scitt",
];

export const DIFF_SNIPPET_LINES = [
  "+ CC7.2 Audit logging fixed",
  "- CC6.6 Network segmentation regressed",
  "Score: 68% -> 58%",
];

export const QUICK_START_SNIPPET = `# Install Bun (if you don't have it)
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone https://github.com/grcorsair/corsair.git
cd corsair && bun install

# Initialize a project (generates keys + example evidence)
bun run corsair.ts init

# Sign tool output into a CPOE (like git commit)
# Keys are auto-generated on first use — no setup needed
prowler scan --output-format json | bun run corsair.ts sign

# Or sign a file directly
bun run corsair.ts sign --file prowler-findings.json

# Verify any CPOE (always free, no account needed)
bun run corsair.ts verify --file prowler-findings.cpoe.jwt

# Compare two CPOEs (like git diff)
bun run corsair.ts diff --current new.jwt --previous old.jwt --verify

# Query the SCITT transparency log (like git log)
bun run corsair.ts log --last 10

# View FLAGSHIP signal info (like git webhooks)
bun run corsair.ts signal --help`;
