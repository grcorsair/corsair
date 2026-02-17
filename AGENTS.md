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
- **Always commit `bun.lock`** — Whenever a dependency changes (add/remove/update), run `bun install` and commit the updated `bun.lock` before pushing. Railway's Nixpacks build uses `--frozen-lockfile` and will reject any drift.
- Use `import type` for type-only imports
- Never commit secrets, `.env` files, or private keys
- Avoid destructive git commands unless explicitly requested

## Full-Codebase Sync Rule (MANDATORY)

When ANY change is made to the codebase — new command, renamed primitive, new flag, changed behavior, updated terminology, modified format — you MUST ensure **every reference across the entire repo** is updated before declaring work complete.

### Process (non-negotiable)

1. **GREP FIRST.** Before closing any change, grep the entire repo for the old name/term/value:
   ```bash
   grep -r "OLD_TERM" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.mdx" --include="*.json" . | grep -v node_modules | grep -v .next
   ```
2. **UPDATE EVERY HIT.** Every single file that references the changed thing must be updated. Zero exceptions.
3. **VERIFY WITH GREP.** After updating, re-run the grep. The old term should return zero results (outside node_modules/.next).

### Surface areas that MUST be checked

| Area | Path | Examples of what lives here |
|------|------|-----------------------------|
| **SKILL.md** | `skills/corsair/SKILL.md` | Workflows, commands, options, examples, supported formats |
| **README.md** | `README.md` | Quick Start, CLI table, feature descriptions, architecture |
| **AGENTS.md** | `AGENTS.md` | Quick commands, repo notes, primitive names |
| **Web docs (MDX)** | `apps/web/content/docs/**/*.mdx` | Getting started, concepts, integrations, API docs |
| **Blog posts** | `apps/web/content/blog/**/*.mdx` | Any blog post referencing the changed term |
| **Marketing pages** | `apps/web/src/app/(marketing)/**` | Every route: sign, verify, diff, log, signal, publish, how-it-works, etc. |
| **Navbar** | `apps/web/src/components/layout/header.tsx` | Primitive names, labels, descriptions, dropdown items |
| **Footer** | `apps/web/src/components/layout/footer.tsx` | Product links, resource links, primitive names |
| **Shared components** | `apps/web/src/components/**` | Hero section, weapons section, quick start, any component with hardcoded text |
| **Config/constants** | `apps/web/src/content/snippets.ts` and similar | Version numbers, shared strings, content config |
| **CLI source** | `corsair.ts`, `src/**` | The implementation itself |
| **Tests** | `tests/**` | Test descriptions, fixture data, CLI output assertions |
| **Package metadata** | `package.json`, `skills/corsair/SKILL.md` frontmatter | Version, description, keywords |
| **Spec docs** | `CPOE_SPEC.md`, `CONTRIBUTING.md`, `SECURITY.md` | Any spec that references primitives or behavior |

### Why this matters

This repo has pages and docs from different periods. Names drift (e.g. "Discovery" vs "Publish" vs "compliance.txt"). The only way to prevent this is: **grep the entire repo on every change, update every hit, verify with grep again.** No shortcuts.

## Repo Notes
- Protocol primitives (6): SIGN, LOG, PUBLISH (compliance.txt), VERIFY, DIFF, SIGNAL (FLAGSHIP)
- compliance.txt lives at `/.well-known/compliance.txt`

## Monorepo
If you add a nested `AGENTS.md` in a subdirectory, it overrides this file for that subtree.
