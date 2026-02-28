import type { Metadata } from "next";
import { IntelligenceEventsDashboard } from "@/components/features/intelligence-events-dashboard";

export const metadata: Metadata = {
  title: "Intelligence — Event Journal Dashboard",
  description:
    "Query Corsair's event_journal with authenticated, actor-scoped filters. Operational telemetry for sign, issue, verify, SCITT, SSF, and hosted trust.txt.",
};

export default function IntelligencePage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <p className="font-pixel text-[7px] tracking-wider text-corsair-gold/60">INTELLIGENCE</p>
          <h1 className="font-display text-4xl font-bold text-corsair-text">Operational telemetry, queryable now</h1>
          <p className="max-w-3xl text-corsair-text-dim">
            Read authenticated protocol events from the append-only journal. Start with actor-scoped visibility now,
            then expand to team/org analytics as a paid tier.
          </p>
        </header>

        <IntelligenceEventsDashboard />
      </div>
    </main>
  );
}
