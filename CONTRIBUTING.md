# Contributing to Corsair

**Welcome aboard, future crew member!**

## The Pirate's Code

1. **Scout Before You Raid** - Check existing issues/PRs before starting work
2. **Chart Your Course** - Open an issue to discuss significant changes
3. **Sign Your Work** - Every CPOE must be cryptographically verifiable
4. **Test With Proof** - All changes need test coverage
5. **Respect the Protocol** - Never break Parley verification or CPOE format

## Getting Started

```bash
# Clone the ship
git clone https://github.com/arudjreis/corsair.git
cd corsair

# Provision the crew
bun install

# Test the cannons
bun test
```

## Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-parser`
3. Write tests first (TDD approach)
4. Implement the feature
5. Ensure all tests pass: `bun test`
6. Ensure typecheck passes: `bun run typecheck`
7. Update documentation if needed
8. Submit PR with clear description

## Repo Guardrails (Must Follow)

- **Follow `AGENTS.md`** — it is the source of truth for workflow and commands.
- **Bun only** for scripts/tests unless explicitly requested otherwise.
- **No new dependencies** without asking first.
- **Never commit secrets** or `.env` files.
- **Use `import type`** for type-only imports.
- **Avoid destructive git commands** unless explicitly requested.

## Commit Messages (Conventional Commits)

Use one of:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` tooling/maintenance
- `refactor:` code change without behavior change
- `test:` tests only
- `style:` formatting/no logic change

Scope is optional, e.g. `feat(web): add trust.txt generator page`.

## Code Style

- **TypeScript strict mode** - No implicit any
- **Explicit types** over inference where it improves clarity
- **Protocol terminology** in spec-aligned concepts (MARQUE, CHART, QUARTER, FLAGSHIP)
- **Professional terminology** in code internals (functions, variables, types)
- **Comprehensive tests** - favor clear, targeted tests over blanket coverage goals

## Adding Document Parsers

Corsair uses an ingestion pipeline and mapping registry to extract compliance data from documents. See `src/ingestion/` for reference implementations.

**Parser Requirements:**
1. Implement `IngestedDocument` output format
2. Add your source to the `DocumentSource` type
3. Add a mapping pack or mapping rule in `src/ingestion/mapping-registry.ts`
4. Map extracted controls to framework identifiers
5. Write comprehensive tests

## Testing Guidelines

- **Unit tests**: Test individual modules (parley, ingestion, flagship)
- **Integration tests**: Test full ingestion-to-CPOE pipeline
- **Protocol tests**: Test Parley exchange, SCITT registration, FLAGSHIP signals
- **Evidence validation**: Verify Ed25519 signatures and hash chain integrity

Run targeted tests first, then the full suite:
```bash
bun test
```

## Full-Codebase Sync Rule (Mandatory)

When you change **any command, flag, format, or terminology**, you must update all references across the repo.

1. Grep the whole repo for the old term.
2. Update every hit (docs, marketing, specs, tests, CLI, web).
3. Re‑grep to confirm zero stale references.

This prevents drift between CLI, docs, marketing pages, and specs.

## Reporting Issues

- **Bugs**: Use bug report template
- **Feature requests**: Use feature request template
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md)

## Questions?

Open a discussion in GitHub Discussions. The crew is friendly and helpful.

**Fair winds on your contribution voyage!**
