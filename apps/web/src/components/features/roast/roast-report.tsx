import { Badge } from "@/components/ui/badge";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import {
  ROAST_CATEGORY_LABEL,
  scoreTone,
  verdictTone,
  type RoastResult,
} from "@/lib/roast";

interface RoastReportProps {
  result: RoastResult;
  compact?: boolean;
}

export function RoastReport({ result, compact = false }: RoastReportProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-corsair-text-dim">
              {result.domain}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-corsair-text">
              Roast Report
            </h2>
            <p className="mt-1 text-xs text-corsair-text-dim/70">
              Generated {new Date(result.createdAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="outline" className={`font-mono text-[10px] ${verdictTone(result.verdict)}`}>
            {result.verdict}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-corsair-border/60 bg-corsair-deep/40 p-3">
            <p className="font-pixel text-[7px] tracking-wider text-corsair-gold/60">COMPOSITE</p>
            <p className="mt-1 font-mono text-2xl font-bold text-corsair-text">
              {result.compositeScore.toFixed(1)}
              <span className="text-sm text-corsair-text-dim"> / 10</span>
            </p>
          </div>
          <div className="rounded-lg border border-corsair-border/60 bg-corsair-deep/40 p-3">
            <p className="font-pixel text-[7px] tracking-wider text-corsair-cyan/60">NEXT MOVE</p>
            <p className="mt-1 text-sm text-corsair-text-dim">{result.fixPreview}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-corsair-text-dim">{result.summaryRoast}</p>
      </section>

      {!compact && <PixelDivider variant="diamond" />}

      <section className="grid gap-3">
        {result.checks.map((check) => (
          <article
            key={check.category}
            className="rounded-xl border border-corsair-border bg-corsair-surface p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-lg font-semibold text-corsair-text">
                {ROAST_CATEGORY_LABEL[check.category]}
              </p>
              <span className="font-mono text-xs text-corsair-text-dim">
                {check.score.toFixed(1)}/10
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-corsair-deep">
              <div
                className={`h-full rounded-full ${scoreTone(check.score)}`}
                style={{ width: `${Math.max(0, Math.min(100, check.score * 10))}%` }}
              />
            </div>

            <p className="mt-3 text-sm leading-relaxed text-corsair-text-dim">{check.roast}</p>

            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-corsair-text-dim/80">
              {check.findings.map((finding, idx) => (
                <li key={`${check.category}-${idx}`}>{finding}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-4">
        <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-green/60">
          TRUST.TXT PREVIEW
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-corsair-text-dim">
          {result.trustTxtExample}
        </pre>
      </section>
    </div>
  );
}
