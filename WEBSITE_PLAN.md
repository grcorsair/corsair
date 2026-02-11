# grcorsair.com — Master Build Plan

**Date:** 2026-02-06
**Status:** Draft — Awaiting Approval
**Author:** Arudjreis + Ayoub

---

## Executive Summary

Build grcorsair.com as a separate private repository, deployed via Firebase App Hosting, using Next.js 15 + Tailwind 4 + shadcn/ui + Motion. The website's visual identity is rooted in the **pixel art Barbary corsair logo** — a retro-tech aesthetic that fuses 16-bit pixel art with terminal/hacker culture. The site serves as both a product showcase and the **Marque exchange surface** for TPRM disruption.

---

## Part 1: Repository Architecture

### Why Separate Repos

The website is a **marketing and protocol surface**, not part of the CLI tool. Keeping them separate means:

1. **Independent deploy cycles** — Ship website changes without touching CLI tests
2. **Different runtimes** — CLI uses Bun natively; website uses Next.js (Node.js on Cloud Run)
3. **Security boundary** — Website repo never touches AWS SDK, private keys, or attack code
4. **Team scaling** — Future contributors can work on website without CLI context
5. **Firebase coupling** — Firebase config lives in the website repo, not polluting the CLI

### Repository Structure

```
GitHub Organization: Arudjreis (or grcorsair)
├── corsair              (public)   — CLI tool, Apache-2.0 license
└── grcorsair.com        (private)  — Website, proprietary
```

### Integration Points Between Repos

| Data Flow | Direction | Mechanism |
|-----------|-----------|-----------|
| Demo output (fixture data) | CLI → Website | JSON fixtures exported from CLI, committed to website repo as static data |
| Logo + brand assets | Shared | Logo PNG lives in both repos (CLI: `assets/`, Website: `public/assets/`) |
| Marque verification logic | CLI → Website | Port `MarqueVerifier` to Web Crypto API (TypeScript, ~200 lines) |
| Framework coverage data | CLI → Website | Export CTID/SCF mapping counts as static JSON |
| CLI version/test stats | CLI → Website | GitHub Actions badge or static JSON updated on CLI release |
| OSCAL schema | CLI → Website | OSCAL type definitions shared (copy, not npm link) |

### What Gets Ported to Website

From `src/parley/marque-verifier.ts`:
- Ed25519 signature verification → Web Crypto API (`crypto.subtle.verify`)
- SHA-256 hash chain validation → Web Crypto API (`crypto.subtle.digest`)
- Marque document parsing → Direct JSON parse (same TypeScript types)

**Critical**: The Marque verifier runs **entirely client-side**. No server needed. No data leaves the browser. This is a trust property — users must believe their Marque data stays private.

### Shared Types Package (Lightweight)

Rather than a monorepo, use a minimal approach:

```
grcorsair.com/src/types/
  marque.ts        — Copy of MarqueDocument, MarqueScope, etc.
  frameworks.ts    — Framework ID enums and display names
  demo-data.ts     — Static fixture data for terminal animation
```

These types are manually synced. When the CLI's Marque format changes, update the website types. This is acceptable at current scale (pre-product-market-fit). A shared npm package or monorepo adds complexity not yet justified.

---

## Part 2: Brand Identity System (From the Pixel Art Logo)

### Logo Analysis

The Corsair logo establishes a unique visual language:

```
┌─────────────────────────────────────────────────────────┐
│  PIXEL ART BARBARY CORSAIR                               │
│                                                           │
│  Character:                                               │
│  - Dark indigo turban with gold/turquoise gem             │
│  - Ornate navy robes with gold embroidery                 │
│  - Red sash at waist                                      │
│  - Keyboard in right hand (tech fusion)                   │
│  - Brown skin, dark beard (North African/Mediterranean)   │
│                                                           │
│  Typography:                                              │
│  - "CORSAIR" in bold blocky pixel letters                 │
│  - Letter fill: cyan matrix/code texture                  │
│  - Letter outline: dark navy                              │
│                                                           │
│  Emblem:                                                  │
│  - Crossed scimitars below text                           │
│  - Cyan blades + red handles (pixel art)                  │
│  - Hexagonal background shape (turquoise)                 │
│                                                           │
│  Aesthetic = Pixel Art + Terminal Code + Barbary History   │
└─────────────────────────────────────────────────────────┘
```

### Color Palette (Extracted from Logo)

```css
/* PRIMARY — The dominant brand colors */
--corsair-navy:        #1B2A4A;  /* Turban, robes, text outline — THE brand color */
--corsair-cyan:        #00CFFF;  /* Code texture, blade glow, terminal output */
--corsair-gold:        #D4A853;  /* Gem, embroidery, decorative accents */

/* SEMANTIC — Functional colors */
--corsair-crimson:     #C0392B;  /* CRITICAL findings, RAID results, sword handles */
--corsair-green:       #2ECC71;  /* Controls HELD, SATISFIED, success states */

/* NEUTRAL — Backgrounds and text */
--corsair-deep:        #0B1022;  /* Page background (deeper than navy) */
--corsair-surface:     #111833;  /* Card/section backgrounds */
--corsair-border:      #1E3055;  /* Borders, dividers */
--corsair-text:        #E2DFD6;  /* Primary text (warm parchment, not cold white) */
--corsair-text-dim:    #8B92A8;  /* Secondary text */

/* ACCENT — Supporting colors from the logo */
--corsair-turquoise:   #7FDBCA;  /* Hex background, section accents */
--corsair-desert:      #C4A882;  /* Sand/stone tones, subtle backgrounds */
--corsair-red-dark:    #8B2232;  /* Sword handles, deep accent */
```

### Design Language: "Pixel Art Meets Terminal"

**The Rule**: Pixel art aesthetic lives in **accents and micro-interactions**, not in the layout itself. The layout is modern and clean (Next.js + shadcn/ui). The pixel art surfaces through:

1. **Section dividers** — Pixel art wave or geometric divider between sections (SVG, not images)
2. **Loading states** — Pixel art sword spinning, or pixel corsair walking animation
3. **Hover effects** — Subtle pixelation effect on card hover (CSS filter)
4. **Icons** — Pipeline stage icons in pixel art style (RECON telescope, RAID sword, etc.)
5. **Code blocks** — Terminal text with the cyan matrix texture from the logo letters
6. **404 page** — Full pixel art scene (corsair on empty island)
7. **Favicon** — Pixel art corsair head from the logo

**What NOT to do:**
- Do NOT make the whole UI pixel art (that's a game, not a tool)
- Do NOT use pixel art fonts for body text (readability kills conversion)
- Do NOT overuse the character illustration (use it in hero + about, then let the brand colors carry)
- Do NOT add sound effects or game-like interactions (credibility risk)

### Typography

| Use | Font | Rationale |
|-----|------|-----------|
| Headlines | **Space Grotesk** or **Geist** | Geometric, slightly blocky — echoes pixel art angularity without being a pixel font |
| Body text | **Inter** | Clean, professional, proven readability |
| Code/terminal | **JetBrains Mono** or **Geist Mono** | Industry standard for developer tools |
| Pixel art accents | **Press Start 2P** (Google Fonts) | ONLY for decorative micro-text (version numbers, badge labels), never body text |

### Pixel Art Asset Pipeline

For custom pixel art elements (icons, dividers, animations):

```
Tool:     Aseprite (industry standard pixel art editor)
Format:   PNG sprite sheets → CSS background-image or <Image />
Sizes:    16x16, 32x32, 64x64 (standard pixel art grids)
Style:    Match the logo's palette and level of detail
```

Pipeline stage icons (for the animated pipeline visualization):
```
RECON     → Pixel art telescope/spyglass
SPYGLASS  → Pixel art compass with threat indicators
MARK      → Pixel art anchor (drift = anchor dragging)
RAID      → Pixel art crossed swords (from logo)
PLUNDER   → Pixel art treasure chest
CHART     → Pixel art map/scroll
QUARTER   → Pixel art ship's wheel
MARQUE    → Pixel art wax seal with signature
```

---

## Part 3: Tech Stack (Justified)

### Core Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 15 (App Router) | SSR for SEO, static export for most pages, Firebase App Hosting native support |
| **Styling** | Tailwind CSS 4 | CSS-first config (`@theme`), automatic content detection, 5x faster builds |
| **Components** | shadcn/ui | Copy-paste ownership, Tailwind-native, dark theme built-in, Terminal from Magic UI |
| **Animation** | Motion (formerly Framer Motion) | `motion/react` import, scroll-driven animations, stagger reveals |
| **Hosting** | Firebase App Hosting | Native Next.js SSR on Cloud Run, auto-deploy from GitHub, scale-to-zero ($0-2/mo) |
| **Package Manager** | Bun | Consistent with CLI repo, faster installs |
| **Analytics** | Plausible or PostHog | Privacy-first, no cookie banner needed (Plausible), or full product analytics (PostHog) |

### Why NOT Alternatives

| Alternative | Why Not |
|-------------|---------|
| Astro | Great for content sites, but Next.js has better SSR/ISR for future dynamic features (playground, auth) |
| Vercel | Firebase keeps billing unified on GCP. App Hosting is comparable for our needs. Custom domain already on GCP. |
| Remix | Smaller ecosystem, less Firebase integration, no clear advantage over Next.js App Router |
| Static HTML | No component reuse, no SSR, harder to maintain as site grows |
| Tailwind 3 | v4 is stable, CSS-first config is cleaner, performance is dramatically better |

### Tailwind 4 Configuration (CSS-First)

```css
/* app/globals.css */
@import "tailwindcss";

/* Dark mode via class (for next-themes) */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Corsair palette from logo */
  --color-corsair-navy: #1B2A4A;
  --color-corsair-cyan: #00CFFF;
  --color-corsair-gold: #D4A853;
  --color-corsair-crimson: #C0392B;
  --color-corsair-green: #2ECC71;
  --color-corsair-deep: #0B1022;
  --color-corsair-surface: #111833;
  --color-corsair-border: #1E3055;
  --color-corsair-text: #E2DFD6;
  --color-corsair-text-dim: #8B92A8;
  --color-corsair-turquoise: #7FDBCA;
  --color-corsair-desert: #C4A882;

  /* Typography */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Space Grotesk", "Geist", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Geist Mono", monospace;
  --font-pixel: "Press Start 2P", monospace;
}
```

This generates utility classes like `bg-corsair-deep`, `text-corsair-cyan`, `border-corsair-border`, `font-pixel`, etc.

### Next.js 15 Configuration (Firebase-Optimized)

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",          // Required for Firebase App Hosting
  reactStrictMode: true,
  images: {
    unoptimized: true,           // Firebase handles CDN caching
  },
};

export default nextConfig;
```

### Key Dependencies

```json
{
  "dependencies": {
    "next": "^15.2",
    "react": "^19.0",
    "react-dom": "^19.0",
    "motion": "^11.15",
    "next-themes": "^0.4",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1",
    "tailwind-merge": "^2.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0",
    "tailwindcss": "^4.0",
    "typescript": "^5.7",
    "@types/react": "^19.0",
    "@types/react-dom": "^19.0"
  }
}
```

---

## Part 4: Firebase App Hosting Setup

### Why App Hosting (Not Classic Hosting)

Firebase App Hosting is GA since April 2025 and is the recommended path for Next.js SSR. Classic Firebase Hosting is designed for static/SPA sites.

| Feature | Classic Hosting | App Hosting |
|---------|----------------|-------------|
| Next.js SSR | Experimental (Cloud Functions) | Native (Cloud Run) |
| Auto-build from GitHub | No (needs Actions) | Yes (built-in) |
| CDN + SSR unified | No | Yes |
| Scale-to-zero | N/A | Yes |

### Setup Sequence

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Create the website project (or use existing GCP project)
firebase projects:create grcorsair-com --display-name "grcorsair.com"

# 4. Initialize App Hosting
cd grcorsair.com/
firebase init apphosting

# 5. Create backend (connects to GitHub repo)
firebase apphosting:backends:create \
  --project grcorsair-com \
  --location us-central1

# This will prompt for:
#   - GitHub repo: Arudjreis/grcorsair.com
#   - Live branch: main
#   - App root: . (where package.json is)
#   - Backend name: production
```

### Configuration Files

**`apphosting.yaml`** (website repo root):
```yaml
runConfig:
  minInstances: 0          # Scale to zero ($0 when idle)
  maxInstances: 10         # Startup budget cap
  concurrency: 80
  cpu: 1
  memoryMiB: 512

env:
  - variable: NEXT_PUBLIC_SITE_URL
    value: https://grcorsair.com
  - variable: NEXT_PUBLIC_SITE_NAME
    value: CORSAIR
  - variable: NEXT_PUBLIC_GA_ID
    value: G-XXXXXXXXXX
```

**`firebase.json`**:
```json
{
  "hosting": {
    "source": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|avif|ico)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  }
}
```

### Domain Configuration (grcorsair.com)

```
# DNS records at your registrar:

# 1. Domain verification
TXT   @     firebase-verification=XXXXXXXX

# 2. Point to Firebase
A     @     199.36.158.100
A     @     199.36.158.101

# 3. www redirect
CNAME www   grcorsair.com
```

Firebase auto-provisions SSL via Let's Encrypt (24-48 hours after DNS propagation).

### CI/CD

Firebase App Hosting has **native GitHub integration** — no GitHub Actions workflow needed for the primary deployment. Every push to `main` triggers:
1. Cloud Build builds the Next.js app
2. Static assets deployed to Cloud CDN
3. SSR routes deployed to Cloud Run
4. Automatic rollout

For staging, create a second backend pointing to a `staging` branch:
```bash
firebase apphosting:backends:create \
  --project grcorsair-com \
  --location us-central1 \
  --branch staging \
  --app-hosting-config apphosting.staging.yaml
```

### Cost Estimate

| Item | Monthly Cost |
|------|-------------|
| App Hosting bandwidth (under 10 GiB free) | $0.00 |
| Cloud Run (scale-to-zero, ~5K visits/mo) | $0.00 - $2.00 |
| Cloud Build (~5 deploys/week) | $0.00 (free tier) |
| SSL certificate | $0.00 (auto Let's Encrypt) |
| **Total** | **$0.00 - $2.00/month** |

Plus $300 GCP credit for new Blaze plan signups.

**Cost risk**: Setting `minInstances: 1` jumps cost to ~$10-15/mo. Keep at 0 and accept ~2s cold start on first request after idle period.

---

## Part 5: Terminal Animation Strategy (4 Tiers)

### Tier 1 — Hero Section (shadcn/Magic UI Terminal)

**Purpose**: First impression. Instant load. Choreographed narrative.
**Load**: ~3KB component, 0ms WASM, SSR-compatible.

```tsx
// components/features/corsair-terminal-demo.tsx
"use client";

import { Terminal, TypingAnimation, AnimatedSpan } from "@/components/ui/terminal";

export function CorsairTerminalDemo() {
  return (
    <Terminal className="max-w-2xl border-corsair-border bg-corsair-deep">
      <TypingAnimation delay={0} className="text-corsair-gold">
        {"$ corsair --target us-west-2_ABC123 --service cognito"}
      </TypingAnimation>

      <AnimatedSpan delay={2000} className="text-corsair-cyan">
        [RECON] Scanning Cognito User Pool... 847 users found
      </AnimatedSpan>

      <AnimatedSpan delay={3000} className="text-corsair-turquoise">
        [SPYGLASS] STRIDE threat model: 4 threats, 2 CRITICAL
      </AnimatedSpan>

      <AnimatedSpan delay={4000} className="text-corsair-crimson">
        [MARK] DRIFT: MFA not enforced (expected: ON, actual: OPTIONAL)
      </AnimatedSpan>

      <AnimatedSpan delay={5000} className="text-corsair-crimson">
        [RAID] MFA bypass: SUCCEEDED (DryRun=true)
      </AnimatedSpan>

      <AnimatedSpan delay={6000} className="text-corsair-cyan">
        [PLUNDER] Evidence chain: 12 records, SHA-256 verified
      </AnimatedSpan>

      <AnimatedSpan delay={7000} className="text-corsair-turquoise">
        [CHART] NIST 800-53 (AC-3, IA-2), SOC2 (CC6.1), ISO 27001 (A.9.4.2)
      </AnimatedSpan>

      <AnimatedSpan delay={8000} className="text-corsair-gold">
        [QUARTER] Governance: AI-VERIFIED (82%) | methodology: 0.85
      </AnimatedSpan>

      <AnimatedSpan delay={9000} className="text-corsair-green font-bold">
        [MARQUE] Ed25519 signed. 5/7 ISC SATISFIED. 2 CRITICAL findings.
      </AnimatedSpan>
    </Terminal>
  );
}
```

**Customization from logo aesthetic**: The terminal window chrome should use the navy + cyan accent colors. Traffic light dots could be replaced with pixel art dots. The terminal background uses `--corsair-deep`.

### Tier 2 — Demo Page (asciinema-player)

**Purpose**: Deep dive for engineers. Real output, scrubable, copy-able.
**Load**: ~250KB WASM, lazy loaded on `/demo` route.

```tsx
// app/(marketing)/demo/page.tsx
import dynamic from "next/dynamic";

const AsciinemaPlayer = dynamic(
  () => import("@/components/features/asciinema-demo"),
  { ssr: false, loading: () => <TerminalSkeleton /> }
);

export default function DemoPage() {
  return (
    <section>
      <h1>Watch Corsair in Action</h1>
      <p>Full autonomous mission against a demo Cognito user pool.</p>
      <AsciinemaPlayer castFile="/demo/corsair-full-demo.cast" />
    </section>
  );
}
```

Record the `.cast` file by running:
```bash
cd corsair/
asciinema rec --cols 120 --rows 35 corsair-full-demo.cast
bun run corsair.ts --target demo --service cognito --format html
# Ctrl+D to stop recording
```

### Tier 3 — Social Media (VHS by Charmbracelet)

**Purpose**: Twitter/LinkedIn cards, Discord embeds, OG images.

```tape
# social/corsair-demo.tape
Output social/corsair-demo.gif
Output social/corsair-demo.mp4

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 600
Set Theme "Dracula"
Set FontFamily "JetBrains Mono"
Set Padding 20

Type "bun corsair.ts --target demo --service cognito"
Sleep 500ms
Enter
Sleep 2s
# ... (real output appears)
Sleep 5s
```

Version-control the `.tape` file. Regenerate on CLI changes.

### Tier 4 — GitHub README (svg-term-cli)

**Purpose**: Sharp SVG animation in README, works on GitHub/npm.

```bash
# Convert a 10-second asciinema clip to SVG
svg-term --cast corsair-quick.cast --out assets/corsair-demo.svg \
  --window --no-cursor --padding 18
```

Embed in README:
```markdown
![Corsair Demo](assets/corsair-demo.svg)
```

---

## Part 6: Page Architecture

### Site Map

```
grcorsair.com/
├── /                    Landing (hero + pipeline + value props)
├── /demo                Deep demo (asciinema-player + VHS gallery)
├── /docs                Documentation (getting started, plugins, API)
├── /playground          Interactive SPYGLASS rule editor (future)
├── /marque              Marque verifier (Web Crypto, client-side)
├── /community           GitHub + Discord + contributing guide
└── /blog                Thought leadership + release notes
```

### Page-by-Page Specification

#### `/` — Landing Page

```
┌──────────────────────────────────────────────────────────┐
│  [Nav: Logo | Docs | Demo | Marque | GitHub ★]           │
│                                                            │
│  ┌─ HERO ────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │  [Pixel art corsair logo — centered, large]        │   │
│  │                                                    │   │
│  │  "Your controls say they work.                     │   │
│  │   We make them prove it."                          │   │
│  │                                                    │   │
│  │  Agentic GRC chaos engineering.                    │   │
│  │  Attack first. Discover reality. Evidence emerges. │   │
│  │                                                    │   │
│  │  [Get Started]  [Watch Demo]  [GitHub ★]           │   │
│  │                                                    │   │
│  │  ┌── Terminal Demo ──────────────────────────┐    │   │
│  │  │  $ corsair --target demo --service cognito│    │   │
│  │  │  [animated pipeline output]               │    │   │
│  │  └───────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ PIPELINE VISUALIZATION (scroll-triggered) ───────┐   │
│  │                                                    │   │
│  │  RECON → SPYGLASS → MARK → RAID → PLUNDER →       │   │
│  │  CHART → QUARTER → MARQUE                          │   │
│  │                                                    │   │
│  │  Each stage: pixel art icon + brief description    │   │
│  │  Lights up as user scrolls, with sample output     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ VALUE PROPS (3 columns) ─────────────────────────┐   │
│  │                                                    │   │
│  │  Prove It Works    Not Just Exists    Signed Proof │   │
│  │  RAID attacks      MARK detects       MARQUE signs │   │
│  │  your controls     actual drift       Ed25519 proof│   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ FRAMEWORK GRID ──────────────────────────────────┐   │
│  │  13+ compliance frameworks mapped automatically    │   │
│  │  [NIST] [SOC2] [ISO] [PCI] [HIPAA] [GDPR] ...   │   │
│  │  Hex-grid layout (echoing logo's hexagonal shape)  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ QUICK START ─────────────────────────────────────┐   │
│  │  bun install && bun corsair.ts --target demo       │   │
│  │  (No API keys needed for demo mode)                │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ THE DISRUPTION ──────────────────────────────────┐   │
│  │  Old: "Are you compliant?" (checkbox theater)      │   │
│  │  New: "Prove it works." (adversarial evidence)     │   │
│  │                                                    │   │
│  │  Visual: Side-by-side comparison of questionnaire  │   │
│  │  vs. Corsair output with signed Marque             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  [Footer: GitHub | Discord | grcengineer.com | Apache-2.0] │
└──────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Hero terminal auto-plays on load, restarts on click
- Pipeline stages light up with scroll-driven animation (Motion `whileInView`)
- Framework badges use hex-grid layout (CSS Grid or SVG)
- Quick start code block has copy button

#### `/demo` — Deep Demo Page

- asciinema-player with full Corsair mission recording
- Side-by-side: terminal output (left) + annotated explanation (right)
- Multiple recordings: Cognito, S3, IAM, Lambda, RDS
- Download links for demo JSONL, HTML report, OSCAL output, Marque document

#### `/docs` — Documentation

Options:
1. **Starlight** (Astro-based) — Best docs framework, but separate build. Deploy as subdomain (`docs.grcorsair.com`)
2. **Fumadocs** (Next.js-based) — Stays in same Next.js app, uses MDX. Single deployment.
3. **Mintlify** — Hosted docs, API reference generation. External service, cost.

**Recommendation**: Start with **Fumadocs** (Next.js native) to keep a single deployment. Migrate to Starlight if docs grow beyond 50+ pages.

Sections:
```
/docs
  /getting-started
  /concepts
    /pipeline
    /isc-system
    /evidence-chain
    /marque-signing
  /plugins
    /aws-cognito
    /aws-s3
    /aws-iam
    /aws-lambda
    /aws-rds
    /gitlab
    /creating-plugins
  /integrations
    /mcp-server
    /oscal
    /ci-cd
  /api-reference
```

#### `/marque` — Marque Verifier (TPRM Exchange Surface)

This is the most strategically important page. It's where the TPRM disruption happens.

```
┌──────────────────────────────────────────────────────────┐
│  MARQUE VERIFIER                                          │
│  "Verify any Corsair attestation. No data leaves          │
│   your browser."                                          │
│                                                            │
│  ┌─ INPUT ───────────────────────────────────────────┐   │
│  │                                                    │   │
│  │  [Paste Marque JSON]    OR    [Upload .marque.json]│   │
│  │                                                    │   │
│  │  [Paste Public Key]     OR    [Upload .pub key]    │   │
│  │                                                    │   │
│  │              [ Verify Marque ]                      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ RESULT (after verification) ─────────────────────┐   │
│  │                                                    │   │
│  │  Signature:     VALID / INVALID / EXPIRED          │   │
│  │  Document ID:   mrq_2026-02-06_abc123              │   │
│  │  Issuer:        Security Engineering Team          │   │
│  │  Generated:     2026-02-06T10:30:00Z               │   │
│  │  Expires:       2026-02-13T10:30:00Z               │   │
│  │                                                    │   │
│  │  Trust Tier:    AI-VERIFIED (82%)                   │   │
│  │  Score:         75/100 (18/24 controls)             │   │
│  │                                                    │   │
│  │  Frameworks:    [NIST] [SOC2] [ISO27001] [PCI]    │   │
│  │                                                    │   │
│  │  Hash Chain:    12 records, integrity VERIFIED      │   │
│  │                                                    │   │
│  │  ┌─ Detailed Findings ──────────────────────┐     │   │
│  │  │  SATISFIED (18):                          │     │   │
│  │  │    "Encryption at rest enabled"           │     │   │
│  │  │    "Access logging configured"            │     │   │
│  │  │    ...                                    │     │   │
│  │  │  FAILED (6):                              │     │   │
│  │  │    "MFA not enforced for all accounts"    │     │   │
│  │  │    "Password policy below 14 characters"  │     │   │
│  │  │    ...                                    │     │   │
│  │  └──────────────────────────────────────────┘     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ TRUST EXPLANATION ───────────────────────────────┐   │
│  │  What is a Marque?                                 │   │
│  │  How verification works (Ed25519 explainer)        │   │
│  │  Why this replaces questionnaires                  │   │
│  │  [Try with sample Marque]                          │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Technical implementation:**
- Web Crypto API: `crypto.subtle.verify("Ed25519", publicKey, signature, data)`
- SHA-256 chain validation: `crypto.subtle.digest("SHA-256", record)`
- Zero server calls. 100% client-side JavaScript.
- Include a "Try with sample" button that loads a pre-generated demo Marque

**Why this matters for TPRM:**
1. Vendor runs Corsair → generates Marque
2. Vendor sends Marque JSON + public key to requesting org
3. Requestor visits grcorsair.com/marque → pastes JSON → verifies signature
4. Result: Cryptographic proof replaces questionnaire theater
5. All happens without Corsair having access to anyone's data

#### `/playground` — Interactive Editor (Phase 2, Not MVP)

Future: In-browser SPYGLASS rule editor where users can:
- Write threat model rules
- Test them against sample snapshots
- See STRIDE categorization
- Share rules with community

Tech: Monaco Editor + fixture-mode execution. Defer this to after launch.

#### `/community` — Community Hub

- GitHub repo link with contribution guide
- Discord/Slack invite
- Template gallery (SPYGLASS rules, plugin manifests)
- Contributors wall

#### `/blog` — Content Hub

- MDX-powered blog posts
- Categories: releases, thought leadership, GRC industry analysis, tutorials
- RSS feed
- OG image generation (pixel art themed)

---

## Part 7: CPOE/Parley/Marque Web Surfaces

### The Marque Verifier (Core Web Component)

Port from `src/parley/marque-verifier.ts`:

```typescript
// lib/marque-web-verifier.ts (website repo)

export interface MarqueVerificationResult {
  valid: boolean;
  reason: string;
  document?: {
    id: string;
    issuer: { name: string; organization?: string };
    generatedAt: string;
    expiresAt: string;
    scope: { providers: string[]; frameworksCovered: string[] };
    summary: { controlsTested: number; controlsPassed: number; overallScore: number };
    evidenceChain: { hashChainRoot: string; recordCount: number; chainVerified: boolean };
    quartermasterAttestation?: { confidenceScore: number; trustTier: string };
  };
}

export async function verifyMarqueInBrowser(
  marqueJson: string,
  publicKeyPem: string
): Promise<MarqueVerificationResult> {
  const marque = JSON.parse(marqueJson);

  // 1. Import public key via Web Crypto API
  const publicKey = await crypto.subtle.importKey(
    "spki",
    pemToBuffer(publicKeyPem),
    { name: "Ed25519" },
    false,
    ["verify"]
  );

  // 2. Extract signature and signed content
  const { signature, ...signedContent } = marque;
  const signatureBuffer = base64ToBuffer(signature);
  const dataBuffer = new TextEncoder().encode(JSON.stringify(signedContent));

  // 3. Verify Ed25519 signature
  const valid = await crypto.subtle.verify(
    "Ed25519",
    publicKey,
    signatureBuffer,
    dataBuffer
  );

  // 4. Check expiry
  const expired = new Date(marque.marque.expiresAt) < new Date();

  if (!valid) return { valid: false, reason: "Signature verification failed" };
  if (expired) return { valid: false, reason: "Marque has expired" };

  return {
    valid: true,
    reason: "Signature valid, document not expired",
    document: marque.marque,
  };
}
```

### Parley Protocol Future Surface

The Parley client (`src/parley/parley-client.ts`) is an HTTP client for publishing/subscribing to Marques. The website could host a Parley endpoint:

```
grcorsair.com/api/parley/
  POST /publish     — Vendor publishes Marque
  GET  /latest      — Requestor fetches latest Marque for a vendor
  GET  /verify      — Server-side verification (optional)
  POST /subscribe   — Webhook subscription for new Marques
```

This is Phase 2+ — not MVP. The client-side verifier is sufficient for launch.

### CPOE Display Component

A React component that renders a Marque document as a beautiful, printable "Certificate of Proof of Operational Effectiveness":

```
┌──────────────────────────────────────────────┐
│  ☠️  CERTIFICATE OF PROOF                     │
│      OF OPERATIONAL EFFECTIVENESS             │
│                                                │
│  Issued by: Security Engineering Team          │
│  Date: 2026-02-06                              │
│  Expires: 2026-02-13                           │
│                                                │
│  Scope: AWS Cognito (us-west-2_ABC123)         │
│  Frameworks: NIST 800-53, SOC2, ISO 27001      │
│                                                │
│  ┌─ Results ─────────────────────────────┐    │
│  │  Controls Tested:  24                  │    │
│  │  Controls Passed:  18                  │    │
│  │  Overall Score:    75%                 │    │
│  │  Trust Tier:       AI-VERIFIED (82%)   │    │
│  └────────────────────────────────────────┘    │
│                                                │
│  Evidence Chain: SHA-256 verified (12 records)  │
│  Signature: Ed25519 ████████...████████        │
│                                                │
│  [Verify this Marque at grcorsair.com/marque]  │
└──────────────────────────────────────────────┘
```

This could be:
- Rendered in HTML/PDF for email distribution
- Embedded in the HTML report output
- Displayed on the `/marque` page after verification

---

## Part 8: Project File Structure

```
grcorsair.com/
├── app/
│   ├── layout.tsx                    # Root layout (ThemeProvider, fonts, metadata)
│   ├── page.tsx                      # Redirect to /(marketing)
│   ├── globals.css                   # Tailwind 4 @theme with Corsair palette
│   ├── (marketing)/
│   │   ├── layout.tsx                # Nav + Footer wrapper
│   │   ├── page.tsx                  # Landing page (hero + pipeline + value props)
│   │   ├── demo/page.tsx             # Deep demo (asciinema-player)
│   │   ├── community/page.tsx        # GitHub + Discord + templates
│   │   └── blog/
│   │       ├── page.tsx              # Blog listing
│   │       └── [slug]/page.tsx       # Blog post (MDX)
│   ├── (verify)/
│   │   └── marque/page.tsx           # Marque verifier (client-side)
│   └── docs/
│       └── [...slug]/page.tsx        # Documentation (Fumadocs)
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── terminal.tsx              # Magic UI Terminal component
│   │   ├── badge.tsx
│   │   └── ...
│   ├── motion/                       # Motion wrapper components
│   │   ├── fade-in.tsx
│   │   ├── scroll-reveal.tsx
│   │   ├── scroll-progress.tsx
│   │   └── stagger-children.tsx
│   ├── layout/                       # Structural components
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── nav.tsx
│   │   └── mobile-menu.tsx
│   └── features/                     # Feature-specific components
│       ├── corsair-terminal-demo.tsx  # Hero terminal animation
│       ├── pipeline-visualization.tsx # Scroll-driven pipeline
│       ├── framework-grid.tsx        # Hex-grid framework badges
│       ├── marque-verifier.tsx       # Client-side verifier UI
│       ├── cpoe-display.tsx          # Certificate renderer
│       ├── asciinema-demo.tsx        # asciinema-player wrapper
│       ├── value-props.tsx           # 3-column value proposition
│       └── quick-start.tsx           # Code block with copy
├── lib/
│   ├── utils.ts                      # cn() utility
│   ├── marque-web-verifier.ts        # Web Crypto API verification
│   └── demo-data.ts                  # Static fixture data for animations
├── public/
│   ├── assets/
│   │   ├── corsair-logo.png          # Pixel art logo
│   │   ├── corsair-icon.png          # Favicon source
│   │   └── pixel-art/               # Pipeline stage icons (16x16, 32x32)
│   ├── demo/
│   │   ├── corsair-full-demo.cast    # asciinema recording
│   │   └── sample-marque.json        # Sample Marque for "Try it" button
│   └── fonts/                        # Self-hosted fonts
├── content/                          # MDX content
│   ├── blog/                         # Blog posts
│   └── docs/                         # Documentation pages
├── social/                           # VHS tape files + generated assets
│   ├── corsair-demo.tape
│   ├── corsair-demo.gif
│   └── corsair-demo.mp4
├── apphosting.yaml                   # Firebase App Hosting config
├── apphosting.staging.yaml           # Staging overrides
├── firebase.json                     # Firebase project config
├── next.config.ts                    # Next.js config
├── postcss.config.mjs                # Tailwind 4 PostCSS
├── components.json                   # shadcn/ui config
├── tsconfig.json
├── package.json
└── README.md
```

---

## Part 9: Implementation Phases

### Phase 0 — Foundation (Day 1)

**Goal**: Private repo created, Firebase connected, bare Next.js deployed.

```
Tasks:
1. Create private GitHub repo: Arudjreis/grcorsair.com
2. Initialize Next.js 15 with Bun: bunx create-next-app@latest
3. Install Tailwind 4 + shadcn/ui + Motion
4. Set up Corsair palette in globals.css (@theme)
5. Install Firebase CLI, create project, init App Hosting
6. Connect GitHub repo → Firebase App Hosting
7. Configure grcorsair.com domain DNS records
8. First deploy: "Coming Soon" page with logo
```

**Deliverable**: grcorsair.com shows a placeholder page with the pixel art logo.

### Phase 1 — Landing Page MVP (Days 2-5)

**Goal**: Hero with terminal animation, pipeline visualization, value props.

```
Tasks:
1. Build nav component (Logo | Docs | Demo | Marque | GitHub)
2. Build hero section (logo + tagline + CTA buttons + terminal demo)
3. Port Magic UI Terminal component, style with Corsair palette
4. Build pipeline visualization with scroll-driven Motion animations
5. Create pixel art icons for each pipeline stage (or placeholder)
6. Build value props section (3 columns)
7. Build framework coverage hex-grid
8. Build quick start code block with copy button
9. Build footer
10. Mobile responsive pass
```

**Deliverable**: grcorsair.com landing page is live and beautiful.

### Phase 2 — Marque Verifier (Days 6-8)

**Goal**: `/marque` page functional with client-side Ed25519 verification.

```
Tasks:
1. Port MarqueVerifier to Web Crypto API
2. Build paste/upload UI for Marque JSON + public key
3. Build verification result display component
4. Build CPOE display component (certificate renderer)
5. Generate sample Marque from CLI demo mode
6. Add "Try with sample" button
7. Write "What is a Marque?" explainer section
8. Test across browsers (Chrome, Firefox, Safari — Ed25519 support)
```

**Deliverable**: Anyone can verify a Corsair Marque at grcorsair.com/marque.

### Phase 3 — Demo Page (Days 9-11)

**Goal**: `/demo` page with asciinema recordings of full Corsair missions.

```
Tasks:
1. Install asciinema, record demo missions (Cognito, S3, IAM)
2. Build asciinema-player React wrapper
3. Create annotated side-by-side layout
4. Add download links for demo artifacts (JSONL, HTML, OSCAL, Marque)
5. Create VHS tape files for social media assets
6. Generate SVG for GitHub README
```

**Deliverable**: Engineers can watch full Corsair missions on the website.

### Phase 4 — Documentation (Days 12-16)

**Goal**: `/docs` with getting started, concepts, plugin guides.

```
Tasks:
1. Set up Fumadocs in the Next.js app
2. Write getting started guide (mirrors README quick start)
3. Write concept pages (pipeline, ISC, evidence chain, Marque signing)
4. Write plugin documentation (per provider)
5. Write integration guides (MCP, OSCAL, CI/CD)
6. Style docs pages with Corsair palette
```

**Deliverable**: Comprehensive documentation at grcorsair.com/docs.

### Phase 5 — Community + Blog (Days 17-20)

**Goal**: `/community` and `/blog` pages live.

```
Tasks:
1. Build community page (GitHub, Discord invite, contributors)
2. Set up MDX blog pipeline
3. Write launch blog post
4. Write "Why GRC Needs Chaos Engineering" thought piece
5. Set up RSS feed
6. Configure OG image generation
```

**Deliverable**: Content pipeline is operational.

### Phase 6 — Polish + Launch (Days 21-25)

**Goal**: Production-ready, SEO optimized, socials prepared.

```
Tasks:
1. Lighthouse audit (target: 95+ performance, 100 accessibility)
2. SEO: metadata, structured data, sitemap.xml, robots.txt
3. Social: OG images, Twitter card, LinkedIn preview
4. Error pages: 404 (pixel art corsair on empty island), 500
5. Loading states: pixel art animations
6. Analytics: Plausible or PostHog setup
7. Final mobile responsive QA
8. Generate social media launch assets (VHS GIFs, MP4s)
9. Update CLI README with website links + SVG demo
```

**Deliverable**: grcorsair.com is launched.

---

## Part 10: Dependencies Between Phases

```
Phase 0 (Foundation)
  └── Phase 1 (Landing Page) ─── blocks nothing downstream
  └── Phase 2 (Marque Verifier) ─── needs sample Marque from Phase 1 terminal data
  └── Phase 3 (Demo Page) ─── needs asciinema recordings (can generate independently)
       └── Phase 4 (Documentation) ─── references demo page content
            └── Phase 5 (Community + Blog) ─── references docs
                 └── Phase 6 (Polish + Launch) ─── needs all prior phases
```

Phases 1, 2, and 3 can run in **parallel** after Phase 0. Phase 4 depends on having real content to document. Phase 6 is the integration/polish pass.

---

## Part 11: Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ed25519 Web Crypto support varies by browser | Marque verifier broken on Safari | Test early. Fallback: noble/ed25519 npm package (pure JS) |
| Tailwind 4 breaking changes | CSS doesn't compile | Pin to 4.0.x, test upgrade path |
| Firebase App Hosting cold start | 2-3s delay on first request | Accept for MVP. Set minInstances=1 if traffic justifies $15/mo |
| Pixel art asset creation bottleneck | Landing page looks generic | Use placeholder icons first, commission pixel art in parallel |
| asciinema recordings get stale after CLI changes | Demo shows old output | Automate: GitHub Action in CLI repo that re-records on release |
| Fumadocs may not scale | Docs get slow with 100+ pages | Migration path to Starlight on docs.grcorsair.com subdomain |

---

## Appendix A: Pixel Art Inspiration from the Logo

The logo establishes these pixel art principles:

1. **Detail level**: Medium-high resolution pixel art (not 8-bit chunky, not photorealistic)
2. **Color depth**: Rich palette with highlights and shadows (not flat/minimalist)
3. **Character design**: Historically rooted Barbary corsair, culturally authentic
4. **Tech integration**: The keyboard is the bridge between pirate and hacker
5. **Text treatment**: Bold blocky letters with code/matrix texture INSIDE the letter forms
6. **Emblem**: Crossed scimitars are the recurring symbol (not skull and crossbones)
7. **Geometry**: Hexagonal framing (for backgrounds, grids, section shapes)

These principles should guide all future visual assets: website graphics, social media, documentation illustrations, and the eventual pixel art icon set for the pipeline stages.

---

## Appendix B: The Disruption Surface Map

```
                    ┌─────────────────────────┐
                    │     grcorsair.com        │
                    └──────────┬──────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
    ┌─────▼─────┐      ┌──────▼──────┐      ┌──────▼──────┐
    │  ADOPTION  │      │  EXCHANGE   │      │  ECOSYSTEM  │
    │  Surface   │      │  Surface    │      │  Surface    │
    └─────┬─────┘      └──────┬──────┘      └──────┬──────┘
          │                    │                     │
    Landing Page         /marque page          /community
    Terminal Demo        Marque Verifier       Template Gallery
    Quick Start          CPOE Display          Plugin Marketplace
    /docs                Parley API (future)   SPYGLASS Rules
    /demo                                      Discord/Slack
          │                    │                     │
          ▼                    ▼                     ▼
    Engineers find        Vendors exchange      Community grows
    and use Corsair       signed proofs         templates/plugins
                               │
                               ▼
                    Questionnaire theater
                    replaced by crypto proof
                               │
                               ▼
                    TPRM market disrupted
                    ($8.57B → verification)
```

The website isn't just marketing — it IS the disruption platform. The `/marque` verifier is where trust exchange happens. The community templates are where the moat builds. The blog is where the narrative shifts from "are you compliant?" to "prove it works."
