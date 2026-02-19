/**
 * CLI Reference — Corsair commands and flags.
 *
 * This module is documentation-first. Update it alongside CLI behavior changes
 * to keep generated reference docs accurate.
 */

export interface CLICommandOption {
  /** Flag name, including shorthand if applicable (e.g., "-f, --file <PATH>"). */
  flag: string;
  /** Human-readable meaning of the flag. */
  description: string;
  /** Default value if the flag is omitted. */
  defaultValue?: string;
}

export interface CLICommandReference {
  /** Command name or subcommand path (e.g., "trust-txt generate"). */
  command: string;
  /** One-line summary. */
  summary: string;
  /** Usage strings. */
  usage: string[];
  /** Supported options for the command. */
  options: CLICommandOption[];
  /** Example invocations. */
  examples?: string[];
}

/**
 * Canonical CLI reference used for doc generation.
 */
export const CLI_REFERENCE: CLICommandReference[] = [
  {
    command: "sign",
    summary: "Sign evidence as a CPOE (JWT-VC).",
    usage: [
      "corsair sign --file <path> [options]",
      "corsair sign --file - [options]",
      "cat evidence.json | corsair sign",
    ],
    options: [
      { flag: "-f, --file <PATH>", description: "Path to evidence JSON file (or '-' for stdin)." },
      { flag: "-o, --output <PATH>", description: "Write JWT-VC to file." },
      { flag: "-F, --format <NAME>", description: "Force generic format (bypass mapping registry)." },
      { flag: "--key-dir <DIR>", description: "Ed25519 key directory.", defaultValue: "./keys" },
      { flag: "--did <DID>", description: "Issuer DID (did:web:...)." },
      { flag: "--scope <SCOPE>", description: "Override scope string." },
      { flag: "--expiry-days <N>", description: "CPOE validity in days.", defaultValue: "90" },
      { flag: "--sd-jwt", description: "Enable SD-JWT selective disclosure." },
      { flag: "--sd-fields <CSV>", description: "Fields in credentialSubject to make disclosable." },
      { flag: "--mapping <PATH>", description: "Mapping pack file or directory (repeatable)." },
      { flag: "--dependency <PATH>", description: "Dependency CPOE path or URL (repeatable)." },
      { flag: "--dry-run", description: "Parse and classify without signing." },
      { flag: "--json", description: "Machine-readable output." },
    ],
    examples: [
      "corsair sign --file evidence.json --format generic",
      "corsair sign --file evidence.json --sd-jwt --sd-fields scope,summary",
    ],
  },
  {
    command: "verify",
    summary: "Verify a CPOE signature and structure.",
    usage: ["corsair verify --file <cpoe.jwt> [options]"],
    options: [
      { flag: "-f, --file <PATH>", description: "Path to CPOE JWT." },
      { flag: "--pubkey <PATH>", description: "Override public key for verification." },
      { flag: "--did", description: "Verify via DID:web resolution." },
      { flag: "--policy <PATH>", description: "Apply policy artifact JSON." },
      { flag: "--require-issuer <DID>", description: "Require issuer DID." },
      { flag: "--require-framework <CSV>", description: "Comma-separated required frameworks." },
      { flag: "--max-age <DAYS>", description: "Max evidence age (provenance.sourceDate)." },
      { flag: "--min-score <N>", description: "Minimum overallScore." },
      { flag: "--require-source <TYPE>", description: "Require provenance source (self|tool|auditor)." },
      { flag: "--require-source-identity <CSV>", description: "Allowed source identities." },
      { flag: "--require-tool-attestation", description: "Require tool attestation in receipts." },
      { flag: "--require-input-binding", description: "Require provenance.sourceDocument binding." },
      { flag: "--require-evidence-chain", description: "Require evidence chain verification." },
      { flag: "--require-receipts", description: "Require verified process receipts." },
      { flag: "--require-scitt", description: "Require SCITT entry IDs for receipts." },
      { flag: "--dependencies", description: "Verify dependency CPOEs (trust graph)." },
      { flag: "--dependency-depth <N>", description: "Dependency verification depth." },
      { flag: "--receipts <PATH>", description: "Process receipts JSON array." },
      { flag: "--evidence <PATH>", description: "Evidence JSONL path (repeatable)." },
      { flag: "--source-document <PATH>", description: "Raw evidence JSON for input binding." },
      { flag: "--json", description: "Machine-readable output." },
    ],
  },
  {
    command: "diff",
    summary: "Compare two CPOEs to detect drift.",
    usage: ["corsair diff --current <new.jwt> --previous <old.jwt> [options]"],
    options: [
      { flag: "--current <PATH>", description: "Newer CPOE JWT." },
      { flag: "--previous <PATH>", description: "Older CPOE JWT." },
      { flag: "--verify", description: "Verify both CPOEs before diffing." },
      { flag: "--json", description: "Machine-readable output." },
    ],
  },
  {
    command: "log",
    summary: "List CPOEs from local files or a SCITT log.",
    usage: ["corsair log [options]"],
    options: [
      { flag: "--last <N>", description: "Limit number of entries." },
      { flag: "--dir <DIR>", description: "Directory containing local CPOEs." },
      { flag: "--scitt <URL>", description: "SCITT log endpoint to query." },
      { flag: "--domain <DOMAIN>", description: "Domain for trust.txt discovery." },
      { flag: "--issuer <DID>", description: "Filter SCITT entries by issuer." },
      { flag: "--framework <NAME>", description: "Filter SCITT entries by framework." },
      { flag: "--json", description: "Machine-readable output." },
    ],
  },
  {
    command: "log register",
    summary: "Register a CPOE in a SCITT transparency log.",
    usage: [
      "corsair log register --file <cpoe.jwt> --scitt <URL> [options]",
      "corsair log register --file <cpoe.jwt> --domain <DOMAIN> [options]",
    ],
    options: [
      { flag: "--file <PATH>", description: "CPOE JWT file path." },
      { flag: "--scitt <URL>", description: "SCITT log endpoint (POST /scitt/entries)." },
      { flag: "--domain <DOMAIN>", description: "Resolve trust.txt for SCITT endpoint." },
      { flag: "--proof-only", description: "Register hash commitment only (no statement stored)." },
      { flag: "--json", description: "Machine-readable output." },
    ],
  },
  {
    command: "trust-txt generate",
    summary: "Generate a trust.txt discovery file.",
    usage: ["corsair trust-txt generate --did <DID> [options]"],
    options: [
      { flag: "--did <DID>", description: "Issuer DID (did:web:...)." },
      { flag: "--cpoe-url <URL>", description: "Direct CPOE URL (repeatable)." },
      { flag: "--scitt <URL>", description: "SCITT log endpoint." },
      { flag: "--catalog <URL>", description: "Catalog snapshot URL." },
      { flag: "--policy <URL>", description: "Policy artifact URL." },
      { flag: "--flagship <URL>", description: "FLAGSHIP stream endpoint." },
      { flag: "--frameworks <CSV>", description: "Framework list." },
      { flag: "-o, --output <PATH>", description: "Output file path.", defaultValue: ".well-known/trust.txt" },
    ],
  },
  {
    command: "trust-txt discover",
    summary: "Discover trust.txt for a domain.",
    usage: ["corsair trust-txt discover <domain> [options]"],
    options: [
      { flag: "--verify", description: "Verify discovered CPOEs." },
    ],
  },
  {
    command: "mappings",
    summary: "Manage evidence mapping packs.",
    usage: [
      "corsair mappings list [--json]",
      "corsair mappings validate [--json]",
      "corsair mappings add <URL_OR_PATH>",
    ],
    options: [
      { flag: "--json", description: "Machine-readable output." },
    ],
  },
  {
    command: "mappings pack",
    summary: "Bundle mappings into a pack for distribution.",
    usage: [
      "corsair mappings pack --id <ID> --version <SEMVER> --mapping <PATH>",
    ],
    options: [
      { flag: "--id <ID>", description: "Mapping pack id." },
      { flag: "--version <VER>", description: "Mapping pack version." },
      { flag: "--issued-at <ISO>", description: "Pack issuance timestamp (default: now)." },
      { flag: "--mapping <PATH>", description: "Mapping file or directory (repeatable)." },
      { flag: "-o, --output <PATH>", description: "Write pack JSON to file." },
      { flag: "--json", description: "Machine-readable output." },
    ],
  },
  {
    command: "mappings sign",
    summary: "Sign a mapping pack with Ed25519.",
    usage: [
      "corsair mappings sign --file <PACK.json> --key <KEY.pem>",
    ],
    options: [
      { flag: "--file <PATH>", description: "Mapping pack JSON file." },
      { flag: "--key <PATH>", description: "Ed25519 private key (PKCS8 PEM)." },
      { flag: "-o, --output <PATH>", description: "Write signed pack JSON to file." },
      { flag: "--json", description: "Machine-readable output." },
    ],
  },
  {
    command: "signal generate",
    summary: "Generate FLAGSHIP SET events.",
    usage: ["corsair signal generate --event <event.json> --issuer <did> --audience <did>"],
    options: [
      { flag: "--event <PATH>", description: "Event payload JSON file." },
      { flag: "--issuer <DID>", description: "Issuer DID." },
      { flag: "--audience <DID>", description: "Audience DID." },
    ],
  },
  {
    command: "keygen",
    summary: "Generate Ed25519 signing keys.",
    usage: ["corsair keygen [--output <dir>]"],
    options: [
      { flag: "--output <DIR>", description: "Key output directory.", defaultValue: "./keys" },
    ],
  },
  {
    command: "receipts generate",
    summary: "Generate COSE receipts for evidence items.",
    usage: ["corsair receipts generate --evidence <jsonl> --index <N>"],
    options: [
      { flag: "--evidence <PATH>", description: "Evidence JSONL file." },
      { flag: "--index <N>", description: "Evidence index to generate a receipt for." },
    ],
  },
  {
    command: "policy validate",
    summary: "Validate a policy artifact JSON file.",
    usage: ["corsair policy validate --file <policy.json>"],
    options: [
      { flag: "--file <PATH>", description: "Policy artifact JSON file." },
      { flag: "--json", description: "Machine-readable output." },
    ],
    examples: [
      "corsair policy validate --file policy.json",
    ],
  },
];
