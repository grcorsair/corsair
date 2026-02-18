"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const COMMON_FRAMEWORKS = [
  "SOC2",
  "ISO27001",
  "NIST-800-53",
  "PCI-DSS",
  "HIPAA",
  "FedRAMP",
  "SOC1",
  "GDPR",
  "CCPA",
  "CIS",
];

interface FormState {
  did: string;
  cpoes: string[];
  scitt: string;
  catalog: string;
  flagship: string;
  frameworks: string[];
  contact: string;
  expiryDays: string;
}

const INITIAL_STATE: FormState = {
  did: "",
  cpoes: [""],
  scitt: "",
  catalog: "",
  flagship: "",
  frameworks: [],
  contact: "",
  expiryDays: "365",
};

function computeExpiry(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function TrustTxtGenerator() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [copied, setCopied] = useState(false);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleFramework = useCallback((fw: string) => {
    setForm((prev) => ({
      ...prev,
      frameworks: prev.frameworks.includes(fw)
        ? prev.frameworks.filter((f) => f !== fw)
        : [...prev.frameworks, fw],
    }));
  }, []);

  const addCpoeSlot = useCallback(() => {
    setForm((prev) => ({ ...prev, cpoes: [...prev.cpoes, ""] }));
  }, []);

  const updateCpoe = useCallback((index: number, value: string) => {
    setForm((prev) => {
      const cpoes = [...prev.cpoes];
      cpoes[index] = value;
      return { ...prev, cpoes };
    });
  }, []);

  const removeCpoe = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      cpoes: prev.cpoes.length > 1 ? prev.cpoes.filter((_, i) => i !== index) : [""],
    }));
  }, []);

  // Generate trust.txt output
  const output = useMemo(() => {
    const lines: string[] = [
      "# Corsair Trust Discovery",
      "# Spec: https://grcorsair.com/spec/trust-txt",
      "",
    ];

    if (form.did.trim()) {
      lines.push(`DID: ${form.did.trim()}`);
    }

    for (const cpoe of form.cpoes) {
      if (cpoe.trim()) {
        lines.push(`CPOE: ${cpoe.trim()}`);
      }
    }

    if (form.scitt.trim()) {
      lines.push(`SCITT: ${form.scitt.trim()}`);
    }

    if (form.catalog.trim()) {
      lines.push(`CATALOG: ${form.catalog.trim()}`);
    }

    if (form.flagship.trim()) {
      lines.push(`FLAGSHIP: ${form.flagship.trim()}`);
    }

    if (form.frameworks.length > 0) {
      lines.push(`Frameworks: ${form.frameworks.join(", ")}`);
    }

    if (form.contact.trim()) {
      lines.push(`Contact: ${form.contact.trim()}`);
    }

    const days = parseInt(form.expiryDays, 10);
    if (days > 0) {
      lines.push(`Expires: ${computeExpiry(days)}`);
    }

    lines.push("");
    return lines.join("\n");
  }, [form]);

  const hasContent = form.did.trim().length > 0;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trust.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [output]);

  const handleReset = useCallback(() => {
    setForm(INITIAL_STATE);
    setCopied(false);
  }, []);

  const handleLoadExample = useCallback(() => {
    setForm({
      did: "did:web:acme.com",
      cpoes: [
        "https://acme.com/compliance/soc2-2026-q1.jwt",
        "https://acme.com/compliance/iso27001-2026.jwt",
      ],
      scitt: "https://log.grcorsair.com/v1/entries?issuer=did:web:acme.com",
      catalog: "https://acme.com/compliance/catalog.json",
      flagship: "https://signals.grcorsair.com/v1/streams/acme",
      frameworks: ["SOC2", "ISO27001", "NIST-800-53"],
      contact: "compliance@acme.com",
      expiryDays: "365",
    });
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Form */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="font-pixel text-[7px] tracking-wider text-corsair-gold/60">
            CONFIGURE
          </p>
          <button
            onClick={handleLoadExample}
            className="font-mono text-[10px] text-corsair-gold/60 transition-colors hover:text-corsair-gold"
          >
            Load example
          </button>
        </div>

        {/* DID */}
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            DID <span className="text-corsair-crimson">*</span>
          </label>
          <input
            type="text"
            value={form.did}
            onChange={(e) => updateField("did", e.target.value)}
            placeholder="did:web:your-domain.com"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Your organization&apos;s DID:web identity for signature verification
          </p>
        </div>

        {/* CPOEs */}
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            CPOE URLs
          </label>
          <div className="space-y-2">
            {form.cpoes.map((cpoe, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={cpoe}
                  onChange={(e) => updateCpoe(i, e.target.value)}
                  placeholder="https://your-domain.com/compliance/soc2.jwt"
                  className="flex-1 rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                {form.cpoes.length > 1 && (
                  <button
                    onClick={() => removeCpoe(i)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:border-corsair-crimson/40 hover:text-corsair-crimson"
                    aria-label="Remove CPOE"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addCpoeSlot}
            className="mt-2 font-mono text-[10px] text-corsair-gold/60 transition-colors hover:text-corsair-gold"
          >
            + Add another CPOE
          </button>
        </div>

        <Separator className="bg-corsair-border/50" />

        {/* Frameworks */}
        <div>
          <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Frameworks
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_FRAMEWORKS.map((fw) => (
              <button
                key={fw}
                onClick={() => toggleFramework(fw)}
                className={`rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                  form.frameworks.includes(fw)
                    ? "border-corsair-gold/50 bg-corsair-gold/10 text-corsair-gold"
                    : "border-corsair-border text-corsair-text-dim hover:border-corsair-gold/30 hover:text-corsair-gold/80"
                }`}
              >
                {fw}
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-corsair-border/50" />

        {/* SCITT + CATALOG + FLAGSHIP */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              SCITT Endpoint
            </label>
            <input
              type="url"
              value={form.scitt}
              onChange={(e) => updateField("scitt", e.target.value)}
              placeholder="https://log.example.com/v1/entries"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Catalog Snapshot
            </label>
            <input
              type="url"
              value={form.catalog}
              onChange={(e) => updateField("catalog", e.target.value)}
              placeholder="https://your-domain.com/compliance/catalog.json"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              FLAGSHIP Endpoint
            </label>
            <input
              type="url"
              value={form.flagship}
              onChange={(e) => updateField("flagship", e.target.value)}
              placeholder="https://signals.example.com/v1/streams"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>
        </div>

        {/* Contact + Expiry */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Contact Email
            </label>
            <input
              type="email"
              value={form.contact}
              onChange={(e) => updateField("contact", e.target.value)}
              placeholder="compliance@your-domain.com"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Expires In (days)
            </label>
            <input
              type="number"
              value={form.expiryDays}
              onChange={(e) => updateField("expiryDays", e.target.value)}
              min="1"
              max="730"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="font-mono text-[10px] text-muted-foreground hover:border-corsair-crimson/40 hover:text-corsair-crimson"
        >
          Reset
        </Button>
      </div>

      {/* Right: Live Preview */}
      <div className="space-y-4">
        <p className="font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
          PREVIEW
        </p>

        <Card className="overflow-hidden border-corsair-border bg-[#0A0A0A]">
          <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-corsair-gold/60" />
            <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">
              .WELL-KNOWN/TRUST.TXT
            </span>
          </div>
          <CardContent className="p-0">
            <pre className="max-h-[400px] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-corsair-cyan/80">
              {output}
            </pre>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleCopy}
            disabled={!hasContent}
            className="font-display font-semibold"
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={!hasContent}
            className="font-display font-semibold hover:border-corsair-gold hover:text-corsair-gold"
          >
            Download File
          </Button>
        </div>

        {/* Deployment instructions */}
        {hasContent && (
          <Card className="border-corsair-green/20 bg-corsair-green/5">
            <CardContent className="space-y-3 p-4">
              <p className="font-mono text-xs font-bold uppercase text-corsair-green">
                Deploy It
              </p>
              <p className="text-xs leading-relaxed text-corsair-text-dim">
                Place this file at{" "}
                <code className="rounded bg-corsair-surface px-1.5 py-0.5 text-corsair-cyan">
                  /.well-known/trust.txt
                </code>{" "}
                on your domain. Anyone can then discover your compliance proofs:
              </p>
              <div className="overflow-x-auto rounded-lg bg-corsair-surface p-3">
                <code className="font-mono text-[11px] text-corsair-gold">
                  curl https://{form.did.replace("did:web:", "") || "your-domain.com"}/.well-known/trust.txt
                </code>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Like{" "}
                <code className="text-corsair-text-dim">security.txt</code>
                {" "}for compliance proofs. Agents and tools can auto-discover your CPOEs.
              </p>
            </CardContent>
          </Card>
        )}

        {/* CLI alternative */}
        <Card className="border-corsair-border bg-corsair-surface">
          <CardContent className="p-4">
            <p className="mb-2 font-mono text-xs font-bold uppercase text-muted-foreground">
              Or use the CLI
            </p>
            <div className="overflow-x-auto rounded-lg bg-[#0A0A0A] p-3">
              <code className="font-mono text-[11px] text-corsair-text-dim">
                corsair trust-txt generate --did {form.did || "did:web:your-domain.com"}
                {form.frameworks.length > 0 && ` \\\n  --frameworks ${form.frameworks.join(",")}`}
                {form.scitt && ` \\\n  --scitt ${form.scitt}`}
                {form.catalog && ` \\\n  --catalog ${form.catalog}`}
                {form.contact && ` \\\n  --contact ${form.contact}`}
                {" \\\n  --base-url https://your-domain.com/compliance/"}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
