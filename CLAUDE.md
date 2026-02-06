# CORSAIR

Agentic GRC chaos engineering platform. Pirate-themed offensive security tool that validates compliance through adversarial testing.

## Tech Stack
- **Runtime**: Bun (NOT Node.js) — TypeScript runs directly, no build step
- **Language**: TypeScript (strict mode, ESM modules)
- **Test Runner**: `bun test` (NOT jest, vitest, or mocha)
- **Package Manager**: `bun install` (NOT npm, yarn, or pnpm)
- **Crypto**: Node.js built-in `crypto` module (zero external deps for Ed25519/SHA-256)
- **AI SDK**: @anthropic-ai/sdk, @modelcontextprotocol/sdk

## Commands
```bash
bun install                          # Install dependencies
bun test                             # Run all tests (790 tests, 64 files)
bun test tests/threat-model/         # SPYGLASS engine tests
bun test tests/parley/               # Marque/Parley tests
bun test tests/quartermaster/        # Quartermaster tests
bun test tests/integration/          # E2E pipeline tests
bun test --coverage                  # With coverage (target: >80%)
bun run corsair.ts --help            # CLI help
bun run corsair.ts --target X --service cognito  # Run mission
```

## TDD Workflow (MANDATORY)
1. Write test FIRST in `tests/` mirroring `src/` structure
2. Run test — verify it FAILS (red)
3. Write minimum implementation to pass
4. Run test — verify it PASSES (green)
5. Refactor if needed, tests stay green
6. NEVER claim work complete without running `bun test` and showing green output

## PAI Integration
- The PAI Algorithm ALWAYS runs. Use ISC criteria to define and verify every change.
- Every feature/fix should have verifiable ISC criteria (8 words, binary testable).
- Use OBSERVE phase to understand existing patterns before modifying code.
- VERIFY phase = `bun test` passing + README updated if public API changed.

## Pirate Naming Convention (CRITICAL)

| Pipeline Stage | Meaning | Code Pattern |
|---|---|---|
| RECON | Reconnaissance (read-only) | `ReconEngine`, `recon()` |
| SPYGLASS | Threat modeling (STRIDE) | `SpyglassEngine`, `spyglassAnalyze()` |
| MARK | Drift detection | `MarkEngine`, `mark()` |
| RAID | Attack execution | `RaidEngine`, `raid()` |
| PLUNDER | Evidence extraction | `EvidenceEngine`, `plunder()` |
| CHART | Framework mapping | `ChartEngine`, `chart()` |
| QUARTER | Governance verification | `QuartermasterAgent` |
| MARQUE | Signed proof (Ed25519) | `MarqueGenerator`, `MarqueVerifier` |
| ESCAPE | Cleanup/rollback | `EscapeEngine`, `withScopeGuard()` |

- Pipeline stages: ALL CAPS in user-facing output (RECON, RAID, PLUNDER)
- Class names: PascalCase pirate metaphors (SpyglassEngine, QuartermasterAgent)
- STRIDE methodology: kept as-is internally (STRIDECategory type)
- New features MUST use pirate terminology, not generic terms

## Architecture Patterns
- **Facade**: `Corsair` class delegates to engine modules (src/engine/)
- **Shared event store**: `CorsairEvent[]` passed by reference to all engines
- **Barrel exports**: `src/engine/index.ts` re-exports everything
- **Plugin discovery**: `*.plugin.json` manifests auto-discovered in `plugins/`
- **Type centralization**: Core types in `src/types.ts`, plugin types re-exported from there
- **Type-only imports**: Use `import type { }` to avoid circular dependencies

## Testing Conventions
- Test files: `*.test.ts` in `tests/` directory (mirrors src/ structure)
- Imports: `import { describe, test, expect } from "bun:test"`
- Fixtures: `tests/fixtures/mock-snapshots.ts` — reuse existing mock data
- Pattern: `describe("Feature") > test("should X when Y")`
- Run specific test file first (`bun test tests/path/file.test.ts`), not the full suite

## Security Rules
- Ed25519 for Marque signing (Node.js crypto, zero external deps)
- SHA-256 hash chain for evidence integrity — NEVER break the chain
- Marque sanitization strips: ARNs, IPs, file paths, account IDs, API keys
- DryRun=true by default for all RAIDs
- NEVER commit .env files, AWS credentials, or private keys
- NEVER disable sanitization in Marque generation

## Boundaries

### Always
- Run `bun test` before claiming any task complete
- Write tests for every new feature or bug fix
- Use pirate terminology for new pipeline concepts
- Use `import type` for type-only imports
- Update README.md when public interfaces change

### Ask First
- Before adding new dependencies (keep deps minimal)
- Before modifying Ed25519 signing or hash chain logic
- Before changing plugin manifest schema
- Before modifying the Corsair facade delegation pattern

### Never
- Never use Node.js/npm/yarn — this is a Bun project
- Never use jest/vitest/mocha — use `bun test`
- Never commit secrets, credentials, or private keys
- Never skip the test-first TDD workflow
- Never use `any` — use `unknown` with type guards instead

## References
- @README.md — Full project documentation, CLI usage, architecture diagrams
- @CONTRIBUTING.md — The Pirate's Code (contribution rules)
- @PLUGIN_ARCHITECTURE.md — Plugin development guide
- @SECURITY.md — Vulnerability reporting
