# CORSAIR

Compliance proof infrastructure — cryptographic trust layer for GRC. Parley protocol (JWT-VC + SCITT + SSF/CAEP) for machine-readable, verifiable compliance attestations (CPOEs).

## Tech Stack
- **Runtime**: Bun (NOT Node.js) — TypeScript runs directly, no build step
- **Language**: TypeScript (strict mode, ESM modules)
- **Test Runner**: `bun test` (NOT jest, vitest, or mocha)
- **Package Manager**: `bun install` (NOT npm, yarn, or pnpm)
- **Crypto**: Node.js built-in `crypto` module + `jose` for JWT-VC (Ed25519)
- **AI SDK**: @anthropic-ai/sdk (SOC 2 ingestion)
- **Database**: Railway Postgres via Bun.sql (zero-dep driver)
- **Web**: Next.js 15 + Tailwind 4 + shadcn/ui (apps/web/)

## Commands
```bash
bun install                          # Install dependencies
bun test                             # Run all tests (806 tests, 49 files)
bun test tests/parley/               # Parley protocol tests (21 files)
bun test tests/flagship/             # FLAGSHIP SSF/CAEP tests
bun test tests/ingestion/            # Ingestion pipeline tests
bun test tests/quartermaster/        # Governance tests
bun run corsair.ts ingest --file report.pdf --type soc2  # Ingest SOC 2
bun run corsair.ts verify cpoe.jwt   # Verify a CPOE
bun run corsair.ts keygen            # Generate Ed25519 keypair
```

## Pipeline (v0.3.0)
```
INGEST → CHART → QUARTER → MARQUE (+ FLAGSHIP for real-time signals)
```

## Pirate Naming Convention

| Stage | Meaning | Code Pattern |
|---|---|---|
| INGEST | Document ingestion | `parseSOC2()`, `mapToMarqueInput()` |
| CHART | Framework mapping | `ChartEngine`, `chart()` |
| QUARTER | Governance verification | `QuartermasterAgent` |
| MARQUE | Signed CPOE (Ed25519 JWT-VC) | `MarqueGenerator`, `MarqueVerifier` |
| FLAGSHIP | Real-time compliance signals | `SETGenerator`, `SSFStream` |

## Architecture Patterns
- **Ingestion pipeline**: PDF → Claude extraction → IngestedDocument → MarqueGeneratorInput → JWT-VC
- **Protocol**: Parley = JWT-VC (proof) + SCITT (log) + SSF/CAEP (signal)
- **Assurance levels**: L0=Documented, L1=Configured, L2=Demonstrated, L3=Observed, L4=Attested
- **Barrel exports**: Each module has `index.ts` re-exporting everything
- **Type-only imports**: Use `import type { }` to avoid circular dependencies
- **Bun-native**: Prefer `Bun.env`, `Bun.file()`, `Bun.write()` over Node.js equivalents

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
- 31 Postgres tests fail due to pre-existing tenant_id constraint (005_multi_tenancy.sql)

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
- Before adding new dependencies (keep deps minimal — currently only 2)
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
- @L0-L4_ISSUANCE_SPEC.md — Assurance level specification
