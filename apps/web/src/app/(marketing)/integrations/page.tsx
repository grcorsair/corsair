import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { IntegrationCategory } from "@/components/features/integrations/integration-category";
import {
  CATEGORIES,
  INTEGRATIONS,
  getIntegrationsByCategory,
  countByStatus,
} from "@/data/integrations-data";

export const metadata: Metadata = {
  title: "Integrations — Corsair",
  description:
    "Every way to use Corsair. 40+ integrations across evidence sources, CI/CD, AI assistants, automation platforms, and more.",
};

export default function IntegrationsPage() {
  const available = countByStatus("available");
  const beta = countByStatus("beta");
  const total = INTEGRATIONS.length;

  return (
    <main className="pb-20">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative flex min-h-[50dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.02] blur-[120px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            INTEGRATIONS
          </p>
          <h1 className="mb-4 text-center font-display text-4xl font-bold text-corsair-text sm:text-5xl">
            Every way to use Corsair
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim">
            CLI, API, SDK, CI/CD, AI agents, automation platforms.
            Sign compliance evidence however your team already works.
          </p>
        </FadeIn>

        {/* Stats strip */}
        <FadeIn delay={0.2}>
          <div className="mt-8 flex items-center gap-6 text-center">
            <div>
              <p className="font-pixel-display text-2xl font-bold text-corsair-gold">
                {available}
              </p>
              <p className="text-xs text-corsair-text-dim">available now</p>
            </div>
            <div className="h-8 w-px bg-corsair-border" />
            <div>
              <p className="font-pixel-display text-2xl font-bold text-corsair-text-dim">
                {beta}
              </p>
              <p className="text-xs text-corsair-text-dim">in beta</p>
            </div>
            <div className="h-8 w-px bg-corsair-border" />
            <div>
              <p className="font-pixel-display text-2xl font-bold text-corsair-text-dim/60">
                {total}
              </p>
              <p className="text-xs text-corsair-text-dim">total</p>
            </div>
          </div>
        </FadeIn>

        {/* Category quick-nav */}
        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="rounded-lg border border-corsair-border/30 bg-corsair-surface px-3 py-1.5 font-mono text-[11px] text-corsair-text-dim transition-colors hover:border-corsair-gold/30 hover:text-corsair-gold"
              >
                {cat.name}
              </a>
            ))}
          </div>
        </FadeIn>
      </section>

      <PixelDivider className="my-4" />

      {/* ── Status Legend ─────────────────────────────────────── */}
      <section className="px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-corsair-text-dim">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-corsair-green" />
                <span>Available — works today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-corsair-gold" />
                <span>Beta — early access</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-corsair-text-dim/40" />
                <span>Coming — on roadmap</span>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Category Sections ─────────────────────────────────── */}
      <section className="space-y-16 px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-16">
          {CATEGORIES.map((category) => (
            <IntegrationCategory
              key={category.id}
              category={category}
              integrations={getIntegrationsByCategory(category.id)}
            />
          ))}
        </div>
      </section>

      <PixelDivider className="my-4" />

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              MISSING SOMETHING?
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold text-corsair-text">
              Request an integration
            </h2>
            <p className="mb-6 text-corsair-text-dim">
              Corsair is an open protocol. Any tool that produces JSON can be
              signed as a CPOE. Need a specific integration?
            </p>
            <a
              href="https://github.com/Arudjreis/corsair/issues/new?template=integration-request.md&title=Integration+request:+"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-corsair-gold/30 bg-corsair-gold/10 px-6 py-3 font-mono text-sm text-corsair-gold transition-colors hover:bg-corsair-gold/20"
            >
              Open GitHub Issue
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
