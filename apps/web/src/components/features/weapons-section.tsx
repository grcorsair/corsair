"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  COMPLIANCE_TXT_SNIPPET,
  DIFF_SNIPPET_LINES,
  VERIFY_4_LINES,
} from "@/content/snippets";

const weapons = [
  {
    id: "compliance",
    title: "compliance.txt",
    subtitle: "Discovery layer for compliance proofs.",
    accent: "border-corsair-gold/40",
    snippet: COMPLIANCE_TXT_SNIPPET,
    cta: { label: "Generate yours", href: "/generate" },
  },
  {
    id: "verify",
    title: "Verify in 4 lines",
    subtitle: "No account. Any JWT library.",
    accent: "border-corsair-green/40",
    snippet: VERIFY_4_LINES,
    cta: { label: "Verify a CPOE", href: "/marque" },
  },
  {
    id: "diff",
    title: "Diff compliance",
    subtitle: "Git diff for posture changes.",
    accent: "border-corsair-crimson/40",
    snippet: DIFF_SNIPPET_LINES,
    cta: { label: "See diff demo", href: "#diff-demo" },
  },
];

export function WeaponsSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {weapons.map((weapon) => (
        <Card
          key={weapon.id}
          className={`border ${weapon.accent} bg-corsair-surface shadow-2xl shadow-black/40`}
        >
          <CardHeader>
            <CardTitle className="font-display text-xl text-corsair-text">
              {weapon.title}
            </CardTitle>
            <p className="text-sm text-corsair-text-dim">{weapon.subtitle}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="rounded-lg border border-corsair-border/60 bg-[#0A0A0A] p-4 font-mono text-[11px] leading-relaxed text-corsair-text-dim">
              {weapon.snippet.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="w-full font-display text-xs font-semibold"
              asChild
            >
              <Link href={weapon.cta.href}>{weapon.cta.label}</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
