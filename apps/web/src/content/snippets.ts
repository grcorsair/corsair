export const CORSAIR_VERSION = "1.0.0";

export const VERIFY_4_LINES = [
  "header, payload = decode_jwt(cpoe)",
  "did_doc = fetch_did(payload[\"iss\"])",
  "key = did_doc[\"verificationMethod\"][0][\"publicKeyJwk\"]",
  "verify_ed25519(cpoe, key)",
];

export const TRUST_TXT_SNIPPET = [
  "# /.well-known/trust.txt",
  "DID: did:web:acme.com",
  "SCITT: https://acme.com/scitt/entries?issuer=did:web:acme.com",
  "CATALOG: https://acme.com/compliance/catalog.json",
];

export const DIFF_SNIPPET_LINES = [
  "+ CC7.2 Audit logging fixed",
  "- CC6.6 Network segmentation regressed",
  "Score: 68% -> 58%",
];

export const QUICK_START_SNIPPET = `# Install (pick one)
npm install -g @grcorsair/cli                  # npm
brew install grcorsair/corsair/corsair         # homebrew
npx skills add grcorsair/corsair               # AI agent skill

# Runtime
# Bun is required to run the CLI. Homebrew installs Bun automatically; npm does not.

# Initialize (generates keys + example evidence)
corsair init

# Sign tool output into a CPOE (like git commit)
# Keys are auto-generated on first use — no setup needed
corsair sign --file evidence.json

# Verify any CPOE (always free, no account needed)
corsair verify --file evidence.cpoe.jwt

# Compare two CPOEs (like git diff)
corsair diff --current new.jwt --previous old.jwt

# Query the SCITT transparency log (like git log)
corsair log --last 10`;
