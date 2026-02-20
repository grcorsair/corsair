"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, CopyIcon } from "lucide-react";

const TABS = [
  {
    id: "publish",
    label: "trust.txt",
    lines: [
      { text: "corsair trust-txt generate --did did:web:acme.com", color: "text-corsair-gold" },
      { text: "# host at /.well-known/trust.txt", color: "text-corsair-text-dim" },
    ],
    copyText: "corsair trust-txt generate --did did:web:acme.com",
    cta: null,
  },
  {
    id: "verify",
    label: "Verify",
    lines: [
      { text: "# No install needed.", color: "text-corsair-text-dim" },
      { text: "grcorsair.com/verify", color: "text-corsair-cyan", href: "/verify" },
      { text: "# or: curl vendor.com/.well-known/trust.txt", color: "text-corsair-text-dim" },
    ],
    copyText: "https://grcorsair.com/verify",
    cta: { label: "Open verify →", href: "/verify" },
  },
  {
    id: "ai-agent",
    label: "AI Agent",
    lines: [
      { text: "npx skills add grcorsair/corsair", color: "text-corsair-gold" },
      { text: "# Works in Claude Code, Cursor, and 25+ AI tools", color: "text-corsair-text-dim" },
    ],
    copyText: "npx skills add grcorsair/corsair",
    cta: null,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function HeroRouteSelector() {
  const [active, setActive] = useState<TabId>("publish");
  const [copied, setCopied] = useState(false);

  const tab = TABS.find((t) => t.id === active)!;

  async function handleCopy() {
    await navigator.clipboard.writeText(tab.copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="w-full max-w-lg">
      {/* Label */}
      <p className="mb-2 text-xs font-medium tracking-widest text-corsair-text-dim/60 uppercase">
        How do you want to use Corsair?
      </p>

      {/* Tab strip */}
      <div className="mb-3 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`rounded px-3 py-1 font-display text-xs font-semibold transition-all ${
              active === t.id
                ? "bg-corsair-gold/10 text-corsair-gold border border-corsair-gold/30"
                : "text-corsair-text-dim/60 border border-transparent hover:text-corsair-text-dim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Snippet */}
      <div className="relative overflow-hidden rounded-lg border border-corsair-border bg-[#0A0A0A]">
        <div className="flex items-center justify-between border-b border-corsair-border/60 px-3 py-2">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-corsair-border" />
            <div className="h-2 w-2 rounded-full bg-corsair-border" />
            <div className="h-2 w-2 rounded-full bg-corsair-border" />
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 font-mono text-[10px] text-corsair-text-dim/60 transition-colors hover:text-corsair-text-dim"
          >
            {copied ? (
              <><CheckIcon className="h-3 w-3 text-corsair-green" /> copied</>
            ) : (
              <><CopyIcon className="h-3 w-3" /> copy</>
            )}
          </button>
        </div>

        <div className="px-4 py-3">
          {tab.lines.map((line, i) => (
            "href" in line && line.href ? (
              <Link
                key={i}
                href={line.href}
                className={`block font-mono text-[12px] leading-relaxed underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80 ${line.color}`}
              >
                {line.text}
              </Link>
            ) : (
              <div key={i} className={`font-mono text-[12px] leading-relaxed ${line.color}`}>
                {line.text}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
