"use client";

import { TRUST_TXT_SNIPPET, VERIFY_4_LINES } from "@/content/snippets";

export function HeroProofSnippet() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-corsair-border bg-corsair-surface shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <span className="ml-2 font-mono text-[11px] text-corsair-text-dim">
            verify in 4 lines
          </span>
        </div>
        <pre className="p-4 font-mono text-[12px] leading-relaxed text-corsair-cyan sm:p-5 sm:text-[13px]">
          {VERIFY_4_LINES.map((line) => (
            <div key={line} className="text-corsair-cyan">
              {line}
            </div>
          ))}
        </pre>
      </div>

      <div className="overflow-hidden rounded-lg border border-corsair-border/60 bg-[#0A0A0A]">
        <div className="flex items-center gap-2 border-b border-corsair-border/60 px-4 py-2">
          <span className="font-pixel text-[7px] tracking-wider text-corsair-gold/80">
            TRUST.TXT
          </span>
        </div>
        <pre className="p-4 font-mono text-[11px] leading-relaxed text-corsair-text-dim">
          {TRUST_TXT_SNIPPET.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}
