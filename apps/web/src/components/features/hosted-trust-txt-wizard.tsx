"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  hostTrustTxtViaAPI,
  verifyHostedTrustTxtViaAPI,
  type APIHostedTrustTxtResponse,
} from "@/lib/corsair-api";

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
  domain: string;
  did: string;
  cpoes: string[];
  scitt: string;
  catalog: string;
  policy: string;
  flagship: string;
  frameworks: string[];
  contact: string;
  expiryDays: string;
  includeDefaults: boolean;
}

const INITIAL_STATE: FormState = {
  domain: "",
  did: "",
  cpoes: [""],
  scitt: "",
  catalog: "",
  policy: "",
  flagship: "",
  frameworks: [],
  contact: "",
  expiryDays: "365",
  includeDefaults: true,
};

function domainToDid(domain: string): string {
  const trimmed = domain.trim();
  if (!trimmed) return "";
  return `did:web:${trimmed}`;
}

export function HostedTrustTxtWizard() {
  const [authToken, setAuthToken] = useState("");
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [result, setResult] = useState<APIHostedTrustTxtResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const handleCopy = useCallback(async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleHost = useCallback(async () => {
    setError(null);
    setStatus("working");

    const payload = {
      domain: form.domain.trim(),
      did: form.did.trim() || undefined,
      cpoes: form.cpoes.map((cpoe) => cpoe.trim()).filter(Boolean),
      scitt: form.scitt.trim() || undefined,
      catalog: form.catalog.trim() || undefined,
      policy: form.policy.trim() || undefined,
      flagship: form.flagship.trim() || undefined,
      frameworks: form.frameworks,
      contact: form.contact.trim() || undefined,
      expiryDays: parseInt(form.expiryDays, 10),
      includeDefaults: form.includeDefaults,
    };

    const response = await hostTrustTxtViaAPI(payload, authToken.trim());
    if (!response.ok) {
      setError(response.error.message);
      setStatus("idle");
      return;
    }

    setResult(response.data);
    setStatus("idle");
  }, [authToken, form]);

  const handleVerify = useCallback(async () => {
    if (!result) return;
    setError(null);
    setStatus("verifying");

    const response = await verifyHostedTrustTxtViaAPI(result.domain, authToken.trim());
    if (!response.ok) {
      setError(response.error.message);
      setStatus("idle");
      return;
    }

    setResult((prev) => prev
      ? { ...prev, status: response.data.status, verifiedAt: response.data.verifiedAt }
      : prev);
    setStatus("idle");
  }, [authToken, result]);

  const suggestedDid = useMemo(() => domainToDid(form.domain), [form.domain]);
  const hasAuth = authToken.trim().length > 0;
  const canHost = hasAuth && form.domain.trim().length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: form */}
      <Card className="border-corsair-border bg-corsair-surface">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between">
            <p className="font-pixel text-[7px] tracking-wider text-corsair-gold/60">HOSTED SETUP</p>
            <Badge variant="outline" className="border-corsair-border text-[10px] text-corsair-text-dim">
              no CLI
            </Badge>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Auth Token
            </label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="API key or OIDC token"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Required to create hosted trust.txt. Stored only in this session.
            </p>
          </div>

          <Separator className="bg-corsair-border" />

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Domain <span className="text-corsair-crimson">*</span>
            </label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => updateField("domain", e.target.value)}
              placeholder="acme.com"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              DID (optional)
            </label>
            <input
              type="text"
              value={form.did}
              onChange={(e) => updateField("did", e.target.value)}
              placeholder={suggestedDid || "did:web:acme.com"}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Defaults to {suggestedDid || "did:web:your-domain"}
            </p>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              CPOE URLs
            </label>
            <div className="space-y-2">
              {form.cpoes.map((cpoe, i) => (
                <div key={`cpoe-${i}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cpoe}
                    onChange={(e) => updateCpoe(i, e.target.value)}
                    placeholder="https://acme.com/compliance/soc2.jwt"
                    className="flex-1 rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCpoe(i)}
                    className="h-8 w-8 text-muted-foreground hover:text-corsair-crimson"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={addCpoeSlot}
            >
              Add CPOE
            </Button>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              SCITT / Catalog / Policy
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={form.scitt}
                onChange={(e) => updateField("scitt", e.target.value)}
                placeholder={`https://${form.domain || "acme.com"}/scitt/entries`}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
              <input
                type="text"
                value={form.catalog}
                onChange={(e) => updateField("catalog", e.target.value)}
                placeholder="https://acme.com/compliance/catalog.json"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
              <input
                type="text"
                value={form.policy}
                onChange={(e) => updateField("policy", e.target.value)}
                placeholder="https://acme.com/.well-known/policy.json"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              FLAGSHIP Stream
            </label>
            <input
              type="text"
              value={form.flagship}
              onChange={(e) => updateField("flagship", e.target.value)}
              placeholder={`https://${form.domain || "acme.com"}/ssf/streams`}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Frameworks
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_FRAMEWORKS.map((fw) => (
                <button
                  key={fw}
                  type="button"
                  onClick={() => toggleFramework(fw)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-mono transition-colors ${
                    form.frameworks.includes(fw)
                      ? "border-corsair-gold text-corsair-gold"
                      : "border-corsair-border text-corsair-text-dim hover:border-corsair-gold/40"
                  }`}
                >
                  {fw}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Contact
              </label>
              <input
                type="email"
                value={form.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                placeholder="compliance@acme.com"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Expiry (days)
              </label>
              <input
                type="number"
                value={form.expiryDays}
                onChange={(e) => updateField("expiryDays", e.target.value)}
                min={1}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.includeDefaults}
              onChange={(e) => updateField("includeDefaults", e.target.checked)}
              className="h-4 w-4 rounded border border-corsair-border"
            />
            Auto-populate default SCITT + FLAGSHIP URLs
          </label>

          {error && (
            <div className="rounded-lg border border-corsair-crimson/40 bg-corsair-surface px-3 py-2 text-xs text-corsair-crimson">
              {error}
            </div>
          )}

          <Button
            onClick={handleHost}
            disabled={!canHost || status !== "idle"}
            className="w-full"
          >
            {status === "working" ? "Creating hosted trust.txt..." : "Create hosted trust.txt"}
          </Button>
        </CardContent>
      </Card>

      {/* Right: output */}
      <div className="space-y-4">
        <Card className="border-corsair-border bg-[#0A0A0A]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <p className="font-pixel text-[7px] tracking-wider text-corsair-cyan/60">DNS DELEGATION</p>
              <Badge variant="outline" className="border-corsair-border text-[10px] text-corsair-text-dim">
                {result?.status || "pending"}
              </Badge>
            </div>

            {result ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Hosted URL</p>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-corsair-border bg-corsair-surface px-3 py-2">
                    <code className="text-[11px] text-corsair-text-dim">{result.urls.hosted}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(result.urls.hosted, "hosted")}
                    >
                      {copied === "hosted" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">DNS TXT</p>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-corsair-border bg-corsair-surface px-3 py-2">
                    <code className="text-[11px] text-corsair-text-dim">{result.dns.txt}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(result.dns.txt, "dns")}
                    >
                      {copied === "dns" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">DNS TXT (hash pin)</p>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-corsair-border bg-corsair-surface px-3 py-2">
                    <code className="text-[11px] text-corsair-text-dim">{result.dns.hashTxt}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(result.dns.hashTxt, "hash")}
                    >
                      {copied === "hash" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Status:</span>
                  <span className={result.status === "active" ? "text-corsair-green" : "text-corsair-gold"}>
                    {result.status}
                  </span>
                  {result.verifiedAt && (
                    <span>· Verified {new Date(result.verifiedAt).toLocaleDateString()}</span>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={handleVerify}
                  disabled={status !== "idle"}
                >
                  {status === "verifying" ? "Verifying DNS..." : "Verify DNS"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-corsair-text-dim">
                Create a hosted trust.txt to receive DNS delegation records and a hosted URL.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-corsair-border bg-corsair-surface">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <p className="font-pixel text-[7px] tracking-wider text-corsair-gold/60">TRUST.TXT PREVIEW</p>
              {result?.trustTxt?.hash && (
                <Badge variant="outline" className="border-corsair-border text-[10px] text-corsair-text-dim">
                  {result.trustTxt.hash.slice(0, 10)}…
                </Badge>
              )}
            </div>
            <div className="rounded-lg border border-corsair-border bg-[#0A0A0A] px-4 py-3 font-mono text-[11px] text-corsair-text-dim whitespace-pre-wrap">
              {result?.trustTxt.content || "trust.txt will appear here after hosting."}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
