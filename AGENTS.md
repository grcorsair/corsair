# AGENTS.md — Corsair

This file defines how agents should work in this repo. Keep it short, accurate, and actionable. If it conflicts with README, this file wins for agent behavior.

## Quick Commands (Bun)
```bash
bun install
bun test
bun test tests/cli/
bun test tests/parley/
bun test tests/flagship/
bun test tests/ingestion/
bun test tests/sign/
bun test tests/mcp/
bun test tests/api/
bun test tests/functions/
bun test tests/distribution/
bun test packages/sdk/tests/

bun run lint:web
bun run build:web
bun run dev:web

bun run corsair.ts sign --file <path>
bun run corsair.ts verify --file <cpoe.jwt>
bun run corsair.ts diff --current <new> --previous <old>
bun run corsair.ts compliance-txt generate --did did:web:acme.com
bun run corsair.ts compliance-txt validate <domain>
bun run corsair.ts compliance-txt discover <domain>
bun run corsair.ts keygen
```

## Tech Stack
- **Runtime**: Bun (default for scripts/tests)
- **Language**: TypeScript (strict, ESM)
- **Web**: Next.js 15 + Tailwind CSS v4 + shadcn/ui (`apps/web/`)
- **Crypto**: `jose` + platform crypto (Ed25519 JWT-VC)
- **Database**: Railway Postgres via `Bun.sql`
- **Deployment**: Railway (`railway.json`)

## TDD Workflow (Required)
1. Write the test first in `tests/` (mirrors `src/` structure)
2. Run the test and confirm it fails (red)
3. Implement the minimum fix/feature
4. Run the test and confirm it passes (green)
5. Refactor if needed; keep tests green
6. Run `bun test` before declaring work complete

## Testing Conventions
- Test files: `*.test.ts`
- Use `import { describe, test, expect } from "bun:test"`
- Prefer a targeted test file first, then the full suite

## Commit Messages (Conventional Commits)
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` tooling/maintenance
- `refactor:` code change without behavior change
- `test:` tests only
- `style:` formatting/no logic change

Scope is optional, e.g. `feat(web): add compliance.txt generator page`.

## Guardrails
- Default to Bun; use Node/npm/yarn only if explicitly requested
- Ask before adding new dependencies
- Use `import type` for type-only imports
- Never commit secrets, `.env` files, or private keys
- Avoid destructive git commands unless explicitly requested

## Repo Notes
- Protocol primitives: SIGN, VERIFY, DIFF, LOG, SIGNAL (FLAGSHIP), DISCOVERY (compliance.txt)
- compliance.txt lives at `/.well-known/compliance.txt`

## Monorepo
If you add a nested `AGENTS.md` in a subdirectory, it overrides this file for that subtree.
