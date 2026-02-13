# CORSAIR

Compliance proof infrastructure — cryptographic trust layer for GRC. Parley protocol (JWT-VC + SCITT + SSF/CAEP) for machine-readable, verifiable compliance attestations (CPOEs).

## Tech Stack
- **Runtime**: Bun (NOT Node.js) — TypeScript runs directly, no build step
- **Language**: TypeScript (strict mode, ESM modules)
- **Test Runner**: `bun test` (NOT jest, vitest, or mocha)
- **Package Manager**: `bun install` (NOT npm, yarn, or pnpm)
- **Crypto**: Node.js built-in `crypto` module + `jose` for JWT-VC (Ed25519)
- **AI SDK**: @anthropic-ai/sdk (devDep — optional Quartermaster enrichment)
- **Database**: Railway Postgres via Bun.sql (zero-dep driver)
- **Web**: Next.js 15 + Tailwind 4 + shadcn/ui (apps/web/)

## Commands
```bash
bun install                          # Install dependencies
bun test                             # Run all tests (1820 tests, 73 files)
bun test tests/parley/               # Parley protocol tests (cert chain, CAA, SCITT, etc.)
bun test tests/flagship/             # FLAGSHIP SSF/CAEP tests
bun test tests/ingestion/            # Evidence parsing + classification tests
bun test tests/sign/                 # Sign engine + batch tests
bun test tests/mcp/                  # MCP server tests
bun test tests/normalize/            # Evidence normalization engine
bun test tests/scoring/              # 7-dimension evidence quality scoring
bun test tests/audit/                # Audit engine + orchestrator
bun test tests/benchmark/            # Scoring benchmark corpus
bun test tests/billing/              # Billing + subscriptions
bun test tests/certification/        # Continuous certification
bun test tests/tprm/                 # Third-party risk management
bun test tests/webhooks/             # Webhook delivery
bun test tests/api/                  # Versioned /v1/ API endpoint tests
bun test tests/distribution/         # Dockerfile, npm, wrappers
bun run corsair.ts sign --file <path>  # Sign evidence as CPOE
bun run corsair.ts sign --file - < data.json  # Sign from stdin
bun run corsair.ts sign --file <path> --format prowler --json  # Force format, JSON output
bun run corsair.ts sign --file <path> --dry-run  # Preview without signing
bun run corsair.ts sign --file <path> --score    # Include 7-dimension evidence quality score
bun run corsair.ts verify cpoe.jwt   # Verify a CPOE
bun run corsair.ts audit --files <paths> --scope <name>  # Run compliance audit
bun run corsair.ts audit --files <paths> --scope <name> --score --governance --json  # Full audit with scoring + governance
bun run corsair.ts cert create --scope <name> --policy <path>  # Create continuous certification
bun run corsair.ts cert check|list|renew|suspend|revoke|history|expiring  # Manage certifications
bun run corsair.ts keygen            # Generate Ed25519 keypair
bun run bin/corsair-mcp.ts           # Start MCP server (stdio)
```

## Pipeline (v0.5.0 — Provenance-first)
```
EVIDENCE → SIGN → LOG → VERIFY → DIFF (default, fully deterministic)
Optional enrichment (--enrich): CLASSIFY + CHART + QUARTER
```

## Five Protocol Primitives

| Primitive | CLI Command | What It Does |
|-----------|-------------|--------------|
| **SIGN** | `corsair sign` | Parse evidence, record provenance, sign JWT-VC (Ed25519) |
| **VERIFY** | `corsair verify` | Verify Ed25519 signature via DID:web resolution |
| **DIFF** | `corsair diff` | Compare two CPOEs, detect compliance regressions |
| **LOG** | `corsair log` | Query SCITT transparency log |
| **SIGNAL** | FLAGSHIP | Real-time compliance change notifications (SSF/CAEP) |

## Architecture Patterns
- **Protocol**: Parley = JWT-VC (proof) + SCITT (log) + SSF/CAEP (signal) + in-toto/SLSA (provenance)
- **Three layers**: L1=Infrastructure (sign/verify/diff/log), L2=Intelligence (normalize/score), L3=Decision (agentic audit)
- **Provenance model**: Records WHO produced evidence (self/tool/auditor), lets buyers decide sufficiency
- **Evidence quality**: 7-dimension scoring engine (5 deterministic, 2 model-assisted) via `--score`
- **Certificate chain**: Root key → org key attestation → CPOE signing (src/parley/key-attestation.ts)
- **CAA-in-DID**: Scope constraints per signing key in DID documents (src/parley/caa-did.ts)
- **Normalization**: 8 parser formats → CanonicalControlEvidence canonical type (src/normalize/)
- **Scoring**: 7-dimension evidence quality assessment (FICO model) — 5 deterministic, 2 model-assisted (src/scoring/)
- **Audit**: Multi-file compliance audit orchestrator (normalize → score → govern) (src/audit/)
- **Quartermaster**: Governance checks with deterministic rules + LLM review (src/quartermaster/)
- **Certification**: Policy-based continuous compliance monitoring (src/certification/)
- **TPRM**: Automated third-party vendor assessment from CPOEs (src/tprm/)
- **Webhooks**: HMAC-SHA256 signed event delivery (src/webhooks/)
- **Billing**: Free/Pro/Platform tier management with rate limits (src/billing/)
- **API platform**: Versioned /v1/ routes with APIEnvelope<T> responses (src/api/)
- **SDK**: @corsair/sdk TypeScript client for sign/verify/score/query (packages/sdk/)
- **Assurance levels** (optional enrichment): L0=Documented, L1=Configured, L2=Demonstrated, L3=Observed, L4=Attested
- **Type-only imports**: Use `import type { }` to avoid circular dependencies
- **Bun-native**: Prefer `Bun.env`, `Bun.file()`, `Bun.write()` over Node.js equivalents

## Shelved Modules
Enrichment modules (quartermaster, chart, data, output) were shelved from the repo in v0.5.0 to keep the codebase focused on protocol primitives. They are fully recoverable via git:
```bash
git show v0.5.0-with-enrichment:src/quartermaster/quartermaster-agent.ts  # View any file
git diff v0.5.0-with-enrichment..HEAD -- src/                              # See what was removed
```

## TDD Workflow (MANDATORY)
1. Write test FIRST in `tests/` mirroring `src/` structure
2. Run test — verify it FAILS (red)
3. Write minimum implementation to pass
4. Run test — verify it PASSES (green)
5. Refactor if needed, tests stay green
6. NEVER claim work complete without running `bun test` and showing green output

## Testing Conventions
- Test files: `*.test.ts` in `tests/` directory (mirrors src/ structure)
- Imports: `import { describe, test, expect } from "bun:test"`
- Pattern: `describe("Feature") > test("should X when Y")`
- Run specific test file first (`bun test tests/path/file.test.ts`), not the full suite

## Security Rules
- Ed25519 for CPOE signing (Node.js crypto + jose for JWT-VC)
- SHA-256 hash chain for evidence integrity
- CPOE sanitization strips: ARNs, IPs, file paths, account IDs, API keys
- NEVER commit .env files, AWS credentials, or private keys

## Boundaries

### Always
- Run `bun test` before claiming any task complete
- Write tests for every new feature or bug fix
- Use pirate terminology for new pipeline concepts
- Use `import type` for type-only imports
- When shipping a backend feature, audit all user-facing content (docs + blog) in the same pass

### Ask First
- Before adding new dependencies (keep deps minimal — currently only 1 runtime dep: jose)
- Before modifying Ed25519 signing or hash chain logic
- Before changing CPOE/Parley type schemas

### Never
- Never use Node.js/npm/yarn — this is a Bun project
- Never use jest/vitest/mocha — use `bun test`
- Never commit secrets, credentials, or private keys
- Never skip the test-first TDD workflow
- Never use `any` — use `unknown` with type guards instead

## References
- @README.md — Full project documentation
- @CONTRIBUTING.md — Contribution rules
- @SECURITY.md — Vulnerability reporting
- @CPOE_SPEC.md — CPOE one-page specification
- @L0-L4_ISSUANCE_SPEC.md — Assurance level specification (historical reference)
