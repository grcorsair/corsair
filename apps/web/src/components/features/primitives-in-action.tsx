"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";

// ─── Layer definitions ───

const layers = [
  {
    id: "infrastructure",
    label: "L1 INFRASTRUCTURE",
    color: "text-corsair-gold",
    bg: "bg-corsair-gold",
    bgDim: "bg-corsair-gold/10",
    borderColor: "border-corsair-gold/30",
    desc: "Cryptographic trust primitives",
  },
  {
    id: "intelligence",
    label: "L2 INTELLIGENCE",
    color: "text-corsair-turquoise",
    bg: "bg-corsair-turquoise",
    bgDim: "bg-corsair-turquoise/10",
    borderColor: "border-corsair-turquoise/30",
    desc: "Evidence quality scoring",
  },
  {
    id: "decision",
    label: "L3 DECISION",
    color: "text-corsair-green",
    bg: "bg-corsair-green",
    bgDim: "bg-corsair-green/10",
    borderColor: "border-corsair-green/30",
    desc: "Automated compliance decisions",
  },
];

// ─── Tab definitions per layer ───

interface TabDef {
  id: string;
  label: string;
  color: string;
  bg: string;
  desc: string;
  layer: string;
}

const layerTabs: Record<string, TabDef[]> = {
  infrastructure: [
    { id: "sign", label: "SIGN", color: "text-corsair-crimson", bg: "bg-corsair-crimson", desc: "like git commit", layer: "infrastructure" },
    { id: "verify", label: "VERIFY", color: "text-corsair-gold", bg: "bg-corsair-gold", desc: "like HTTPS", layer: "infrastructure" },
    { id: "diff", label: "DIFF", color: "text-corsair-green", bg: "bg-corsair-green", desc: "like git diff", layer: "infrastructure" },
    { id: "log", label: "LOG", color: "text-corsair-turquoise", bg: "bg-corsair-turquoise", desc: "SCITT transparency log", layer: "infrastructure" },
    { id: "signal", label: "SIGNAL", color: "text-corsair-cyan", bg: "bg-corsair-cyan", desc: "FLAGSHIP events", layer: "infrastructure" },
  ],
  intelligence: [
    { id: "normalize", label: "NORMALIZE", color: "text-corsair-turquoise", bg: "bg-corsair-turquoise", desc: "canonical evidence format", layer: "intelligence" },
    { id: "score", label: "SCORE", color: "text-corsair-turquoise", bg: "bg-corsair-turquoise", desc: "FICO for compliance", layer: "intelligence" },
    { id: "query", label: "QUERY", color: "text-corsair-turquoise", bg: "bg-corsair-turquoise", desc: "evidence search + filter", layer: "intelligence" },
    { id: "quarter", label: "QUARTER", color: "text-corsair-turquoise", bg: "bg-corsair-turquoise", desc: "governance review", layer: "intelligence" },
  ],
  decision: [
    { id: "audit", label: "AUDIT", color: "text-corsair-green", bg: "bg-corsair-green", desc: "like git bisect", layer: "decision" },
    { id: "certify", label: "CERTIFY", color: "text-corsair-green", bg: "bg-corsair-green", desc: "continuous certification", layer: "decision" },
    { id: "tprm", label: "TPRM", color: "text-corsair-green", bg: "bg-corsair-green", desc: "vendor risk automation", layer: "decision" },
  ],
};

// ─── Main component ───

export function PrimitivesInAction() {
  const [activeLayer, setActiveLayer] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  const currentLayerKey = layers[activeLayer].id;
  const currentTabs = layerTabs[currentLayerKey];
  const currentTab = currentTabs[activeTab];

  function handleLayerChange(i: number) {
    setActiveLayer(i);
    setActiveTab(0);
  }

  return (
    <div>
      {/* Layer selector */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1 rounded-lg border border-corsair-border bg-corsair-surface p-1">
          {layers.map((layer, i) => (
            <button
              key={layer.id}
              onClick={() => handleLayerChange(i)}
              className={`relative rounded-md px-3 py-2 font-pixel text-[7px] tracking-wider transition-all sm:px-4 sm:text-[8px] ${
                activeLayer === i
                  ? `${layer.color} bg-corsair-bg`
                  : "text-corsair-text-dim hover:text-corsair-text"
              }`}
            >
              {layer.label}
              {activeLayer === i && (
                <motion.div
                  layoutId="layer-selector"
                  className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${layer.bg}`}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="mt-4 flex justify-center">
        <div className="inline-flex gap-1 rounded-lg border border-corsair-border bg-corsair-surface p-1">
          {currentTabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(i)}
              className={`relative rounded-md px-3 py-2 font-pixel text-[8px] tracking-wider transition-all sm:px-4 sm:text-[9px] ${
                activeTab === i
                  ? `${tab.color} bg-corsair-bg`
                  : "text-corsair-text-dim hover:text-corsair-text"
              }`}
            >
              {tab.label}
              {activeTab === i && (
                <motion.div
                  layoutId="primitives-tab"
                  className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${tab.bg}`}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Panel */}
      <div className="mt-6 overflow-hidden rounded-xl border border-corsair-border bg-corsair-surface shadow-2xl shadow-black/30">
        {/* Terminal chrome */}
        <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <span className="ml-2 font-mono text-[11px] text-corsair-text-dim">
            corsair {currentTab.id} — {currentTab.desc}
          </span>
          <Badge className={`ml-auto border-transparent font-pixel text-[7px] ${layers[activeLayer].bgDim} ${layers[activeLayer].color}`}>
            {layers[activeLayer].label}
          </Badge>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentLayerKey}-${activeTab}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {/* Layer 1 — Infrastructure */}
            {currentTab.id === "sign" && <SignPanel />}
            {currentTab.id === "verify" && <VerifyPanel />}
            {currentTab.id === "diff" && <DiffPanel />}
            {currentTab.id === "log" && <LogPanel />}
            {currentTab.id === "signal" && <SignalPanel />}

            {/* Layer 2 — Intelligence */}
            {currentTab.id === "normalize" && <NormalizePanel />}
            {currentTab.id === "score" && <ScorePanel />}
            {currentTab.id === "query" && <QueryPanel />}
            {currentTab.id === "quarter" && <QuarterPanel />}

            {/* Layer 3 — Decision */}
            {currentTab.id === "audit" && <AuditPanel />}
            {currentTab.id === "certify" && <CertifyPanel />}
            {currentTab.id === "tprm" && <TPRMPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// =============================================
// LAYER 1 — INFRASTRUCTURE PANELS
// =============================================

// ═══════════════════════════════════════════════
// SIGN — tool output → signed CPOE
// ═══════════════════════════════════════════════

function SignPanel() {
  return (
    <div className="grid gap-px bg-corsair-border md:grid-cols-2">
      {/* Left: Tool output */}
      <div className="bg-[#0A0A0A] p-5">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          INPUT — TOOL OUTPUT
        </p>
        <div className="font-mono text-[11px] leading-relaxed sm:text-[12px]">
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">prowler scan --output-format json</span>
          <div className="mt-2 text-corsair-text-dim">{"{"}</div>
          <Line k="provider" v={`"prowler"`} />
          <Line k="version" v={`"3.1.0"`} />
          <Line k="findings" v="[" />
          <div className="ml-6 text-corsair-text-dim">
            {"{ "}
            <span className="text-corsair-gold">&quot;id&quot;</span>
            {": "}
            <span className="text-corsair-green">&quot;CIS-1.1&quot;</span>
            {", "}
            <span className="text-corsair-gold">&quot;status&quot;</span>
            {": "}
            <span className="text-corsair-green">&quot;PASS&quot;</span>
            {" },"}
          </div>
          <div className="ml-6 text-corsair-text-dim">
            {"{ "}
            <span className="text-corsair-gold">&quot;id&quot;</span>
            {": "}
            <span className="text-corsair-green">&quot;CIS-2.1&quot;</span>
            {", "}
            <span className="text-corsair-gold">&quot;status&quot;</span>
            {": "}
            <span className="text-corsair-green">&quot;PASS&quot;</span>
            {" },"}
          </div>
          <div className="ml-6 text-corsair-text-dim">
            {"{ "}
            <span className="text-corsair-gold">&quot;id&quot;</span>
            {": "}
            <span className="text-corsair-green">&quot;CIS-3.4&quot;</span>
            {", "}
            <span className="text-corsair-gold">&quot;status&quot;</span>
            {": "}
            <span className="text-corsair-crimson">&quot;FAIL&quot;</span>
            {" },"}
          </div>
          <div className="ml-6 text-corsair-text-dim">...</div>
          <Line k="" v="]" raw />
          <div className="text-corsair-text-dim">{"}"}</div>
        </div>
      </div>

      {/* Right: Signed CPOE */}
      <div className="bg-[#0A0A0A] p-5">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          OUTPUT — SIGNED CPOE (JWT-VC)
        </p>
        <div className="font-mono text-[11px] leading-relaxed sm:text-[12px]">
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">prowler scan</span>{" "}
          <span className="text-corsair-text-dim">|</span>{" "}
          <span className="text-corsair-text">corsair sign</span>

          {/* Header */}
          <div className="mt-3 rounded border border-corsair-border/30 p-3">
            <p className="mb-1 text-[10px] text-corsair-text-dim">HEADER</p>
            <div className="ml-2">
              <span className="text-corsair-gold">alg</span>
              <span className="text-corsair-text-dim">: </span>
              <span className="text-corsair-text">EdDSA</span>
            </div>
            <div className="ml-2">
              <span className="text-corsair-gold">kid</span>
              <span className="text-corsair-text-dim">: </span>
              <span className="text-corsair-text">did:web:grcorsair.com#key-1</span>
            </div>
          </div>

          {/* Payload */}
          <div className="mt-2 rounded border border-corsair-border/30 p-3">
            <p className="mb-1 text-[10px] text-corsair-text-dim">PAYLOAD</p>
            <div className="ml-2">
              <span className="text-corsair-gold">provenance</span>
              <span className="text-corsair-text-dim">: </span>
              <span className="text-corsair-green">tool — Prowler v3.1</span>
            </div>
            <div className="ml-2">
              <span className="text-corsair-gold">controls</span>
              <span className="text-corsair-text-dim">: </span>
              <span className="text-corsair-text">22 tested, 20 passed, 2 failed</span>
            </div>
            <div className="ml-2">
              <span className="text-corsair-gold">scope</span>
              <span className="text-corsair-text-dim">: </span>
              <span className="text-corsair-text">AWS Production</span>
            </div>
          </div>

          {/* Signature */}
          <div className="mt-2 rounded border border-corsair-crimson/20 bg-corsair-crimson/5 p-3">
            <p className="mb-1 text-[10px] text-corsair-text-dim">SIGNATURE</p>
            <div className="ml-2 flex items-center gap-2">
              <span className="text-corsair-green">{"\u2713"} Ed25519</span>
              <Badge className="border-transparent bg-corsair-crimson/20 font-pixel text-[8px] text-corsair-crimson">
                SIGNED
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// VERIFY — 4-step verification flow
// ═══════════════════════════════════════════════

const verifySteps = [
  {
    step: 1,
    name: "Decode",
    detail: "Parse JWT header + payload",
    output: "alg: EdDSA, iss: did:web:grcorsair.com",
    color: "text-corsair-gold",
    bg: "bg-corsair-gold/10",
  },
  {
    step: 2,
    name: "Resolve",
    detail: "Fetch issuer DID document",
    output: "GET https://grcorsair.com/.well-known/did.json → 200",
    color: "text-corsair-turquoise",
    bg: "bg-corsair-turquoise/10",
  },
  {
    step: 3,
    name: "Extract",
    detail: "Find public key matching kid",
    output: "key-1: Ed25519 OKP (x: 7a3f...c2d1)",
    color: "text-corsair-cyan",
    bg: "bg-corsair-cyan/10",
  },
  {
    step: 4,
    name: "Verify",
    detail: "Check Ed25519 signature",
    output: "VALID — Corsair Verified",
    color: "text-corsair-green",
    bg: "bg-corsair-green/10",
  },
];

function VerifyPanel() {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div className="font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-gold">$</span>{" "}
        <span className="text-corsair-text">corsair verify</span>{" "}
        <span className="text-corsair-text-dim">cpoe-acme-v2.jwt</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {verifySteps.map((s) => (
          <div
            key={s.step}
            className="rounded-lg border border-corsair-border/30 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${s.bg} ${s.color}`}
              >
                {s.step}
              </span>
              <span className={`font-pixel text-[9px] tracking-wider ${s.color}`}>
                {s.name.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-corsair-text-dim">{s.detail}</p>
            <div className="mt-2 rounded bg-corsair-bg/50 px-2 py-1.5">
              <p className={`font-mono text-[10px] ${s.step === 4 ? "text-corsair-green font-bold" : "text-corsair-text-dim"}`}>
                {s.output}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 font-mono text-[12px]">
        <span className="text-corsair-green font-bold">{"\u2713"} VALID</span>
        <span className="text-corsair-text-dim">&mdash;</span>
        <span className="text-corsair-gold">Corsair Verified</span>
        <span className="text-corsair-text-dim ml-auto text-[10px]">
          No account needed. Free forever.
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DIFF — side-by-side control comparison
// ═══════════════════════════════════════════════

const diffControls = [
  { id: "CC6.1", name: "Access Control", before: "PASS", after: "PASS", change: "unchanged" as const },
  { id: "CC6.6", name: "Network Segmentation", before: "PASS", after: "FAIL", change: "regression" as const },
  { id: "CC7.1", name: "System Operations", before: "FAIL", after: "PASS", change: "fixed" as const },
  { id: "CC7.2", name: "Audit Logging", before: "FAIL", after: "PASS", change: "fixed" as const },
  { id: "CC8.1", name: "Change Management", before: "PASS", after: "PASS", change: "unchanged" as const },
  { id: "CC9.1", name: "Risk Mitigation", before: "PASS", after: "PASS", change: "unchanged" as const },
];

const changeStyles = {
  unchanged: { symbol: "=", color: "text-corsair-text-dim", bg: "" },
  regression: { symbol: "-", color: "text-corsair-crimson", bg: "bg-corsair-crimson/5" },
  fixed: { symbol: "+", color: "text-corsair-green", bg: "bg-corsair-green/5" },
} as const;

function DiffPanel() {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div className="font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-gold">$</span>{" "}
        <span className="text-corsair-text">corsair diff</span>{" "}
        <span className="text-corsair-text-dim">--current cpoe-v2.jwt --previous cpoe-v1.jwt</span>
      </div>

      {/* Column headers */}
      <div className="mt-4 grid grid-cols-[40px_1fr_60px_24px_60px_1fr] items-center gap-x-2 px-2 font-mono text-[10px] text-corsair-text-dim sm:grid-cols-[40px_1fr_70px_30px_70px_1fr]">
        <span />
        <span>Control</span>
        <span className="text-center">Jan 15</span>
        <span />
        <span className="text-center">Feb 12</span>
        <span className="hidden sm:block">Change</span>
      </div>

      {/* Rows */}
      <div className="mt-1 space-y-px">
        {diffControls.map((c) => {
          const style = changeStyles[c.change];
          return (
            <div
              key={c.id}
              className={`grid grid-cols-[40px_1fr_60px_24px_60px_1fr] items-center gap-x-2 rounded px-2 py-1.5 font-mono text-[11px] sm:grid-cols-[40px_1fr_70px_30px_70px_1fr] sm:text-[12px] ${style.bg}`}
            >
              <span className="text-corsair-text-dim">{c.id}</span>
              <span className="truncate text-corsair-text text-[10px] sm:text-[11px]">{c.name}</span>
              <StatusBadge status={c.before} />
              <span className={`text-center font-bold ${style.color}`}>{style.symbol}</span>
              <StatusBadge status={c.after} />
              <span className={`hidden text-[10px] sm:block ${style.color}`}>
                {c.change === "regression" && "REGRESSION"}
                {c.change === "fixed" && "FIXED"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-corsair-border/30 pt-3 font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-green">+2 fixed</span>
        <span className="text-corsair-crimson">-1 regression</span>
        <span className="text-corsair-text-dim">3 unchanged</span>
        <span className="ml-auto text-corsair-text-dim">
          Score: <span className="text-corsair-gold">86%</span> → <span className="text-corsair-green">91%</span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// LOG — SCITT append-only transparency chain
// ═══════════════════════════════════════════════

const scittEntries = [
  { id: 4, hash: "a7f3e2d1", date: "2026-02-12", cpoe: "cpoe-acme-v2.jwt", issuer: "did:web:grcorsair.com", type: "corsair" as const },
  { id: 3, hash: "c4d1b8f3", date: "2026-01-15", cpoe: "cpoe-acme-v1.jwt", issuer: "did:web:grcorsair.com", type: "corsair" as const },
  { id: 2, hash: "e9f2a1c7", date: "2025-12-01", cpoe: "cpoe-globex.jwt", issuer: "did:web:globex.com", type: "third-party" as const },
  { id: 1, hash: "b3c7d5e9", date: "2025-10-15", cpoe: "cpoe-acme-v0.jwt", issuer: "did:web:acme.com", type: "self-signed" as const },
];

function LogPanel() {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div className="font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-gold">$</span>{" "}
        <span className="text-corsair-text">corsair log</span>{" "}
        <span className="text-corsair-text-dim">--last 4</span>
      </div>

      {/* Merkle root */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-corsair-turquoise/20 bg-corsair-turquoise/5 px-3 py-2">
        <span className="font-pixel text-[8px] tracking-wider text-corsair-turquoise">MERKLE ROOT</span>
        <span className="font-mono text-[11px] text-corsair-turquoise">
          7a3fc2d1...8b4e
        </span>
        <span className="ml-auto font-mono text-[10px] text-corsair-text-dim">
          4 entries
        </span>
      </div>

      {/* Chain */}
      <div className="relative mt-4">
        {/* Vertical chain line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-corsair-turquoise/20 sm:left-[19px]" />

        <div className="space-y-2">
          {scittEntries.map((entry, i) => (
            <div key={entry.id} className="relative flex gap-3 sm:gap-4">
              {/* Chain node */}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`h-3 w-3 rounded-full border-2 sm:h-4 sm:w-4 ${
                    i === 0
                      ? "border-corsair-turquoise bg-corsair-turquoise"
                      : "border-corsair-turquoise/30 bg-corsair-bg"
                  }`}
                />
                {i < scittEntries.length - 1 && (
                  <div className="mt-1 font-mono text-[8px] text-corsair-turquoise/40">
                    |
                  </div>
                )}
              </div>

              {/* Entry card */}
              <div className={`flex-1 rounded-lg border p-3 ${
                i === 0
                  ? "border-corsair-turquoise/20 bg-corsair-turquoise/5"
                  : "border-corsair-border/30"
              }`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] sm:text-[12px]">
                  <span className="text-corsair-turquoise">#{entry.id}</span>
                  <span className="text-corsair-text-dim">{entry.date}</span>
                  <span className="text-corsair-text">{entry.cpoe}</span>
                  {i === 0 && (
                    <Badge className="border-transparent bg-corsair-turquoise/20 font-pixel text-[7px] text-corsair-turquoise">
                      LATEST
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
                  <span className="text-corsair-text-dim">
                    hash: <span className="text-corsair-turquoise/60">{entry.hash}</span>
                  </span>
                  <span className="text-corsair-text-dim">
                    issuer: {entry.issuer}
                  </span>
                  <span className="text-corsair-green text-[9px]">{"\u2713"} COSE receipt</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Properties */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-corsair-border/30 pt-3 font-mono text-[10px] text-corsair-text-dim">
        <span>Append-only</span>
        <span className="text-corsair-border">|</span>
        <span>Tamper-evident</span>
        <span className="text-corsair-border">|</span>
        <span>Merkle-proofed</span>
        <span className="text-corsair-border">|</span>
        <span>COSE receipts</span>
        <span className="ml-auto text-corsair-turquoise">Anyone can verify inclusion</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SIGNAL — FLAGSHIP event stream
// ═══════════════════════════════════════════════

const flagshipEvents = [
  {
    type: "FLEET_ALERT",
    caep: "compliance-change",
    trigger: "CC6.6 VPC config changed — network segmentation failed",
    severity: "high",
    color: "text-corsair-crimson",
    borderColor: "border-corsair-crimson/20",
    bgColor: "bg-corsair-crimson/5",
    dotColor: "bg-corsair-crimson",
    deliveredTo: ["Buyer A (webhook)", "Buyer B (webhook)"],
  },
  {
    type: "COLORS_CHANGED",
    caep: "assurance-level-change",
    trigger: "Prowler re-scan: compliance score improved 86% → 91%",
    severity: "info",
    color: "text-corsair-gold",
    borderColor: "border-corsair-gold/20",
    bgColor: "bg-corsair-gold/5",
    dotColor: "bg-corsair-gold",
    deliveredTo: ["All subscribers", "Dashboard update"],
  },
  {
    type: "PAPERS_CHANGED",
    caep: "credential-change",
    trigger: "New CPOE issued — cpoe-acme-v2.jwt replaces v1",
    severity: "info",
    color: "text-corsair-turquoise",
    borderColor: "border-corsair-turquoise/20",
    bgColor: "bg-corsair-turquoise/5",
    dotColor: "bg-corsair-turquoise",
    deliveredTo: ["Trust registry", "Buyer notifications"],
  },
  {
    type: "MARQUE_REVOKED",
    caep: "session-revoked",
    trigger: "Emergency: signing key compromised — all CPOEs from key revoked",
    severity: "critical",
    color: "text-corsair-crimson",
    borderColor: "border-corsair-crimson/30",
    bgColor: "bg-corsair-crimson/10",
    dotColor: "bg-corsair-crimson",
    deliveredTo: ["ALL subscribers (immediate)"],
  },
];

function SignalPanel() {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div className="font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-gold">$</span>{" "}
        <span className="text-corsair-text">corsair signal</span>
      </div>

      {/* Column headers */}
      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-start gap-x-4 gap-y-3 px-1 font-pixel text-[7px] tracking-wider text-corsair-text-dim sm:grid-cols-[140px_1fr_160px]">
        <span>EVENT</span>
        <span>TRIGGER</span>
        <span className="hidden sm:block">DELIVERY</span>
      </div>

      {/* Events */}
      <div className="mt-2 space-y-2">
        {flagshipEvents.map((evt) => (
          <div
            key={evt.type}
            className={`rounded-lg border p-3 ${evt.borderColor} ${evt.bgColor}`}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_160px] sm:gap-4">
              {/* Event type */}
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${evt.dotColor} ${evt.severity === "high" || evt.severity === "critical" ? "animate-pulse" : ""}`} />
                <div>
                  <p className={`font-mono text-[11px] font-bold sm:text-[12px] ${evt.color}`}>
                    {evt.type}
                  </p>
                  <p className="font-mono text-[9px] text-corsair-text-dim">
                    {evt.caep}
                  </p>
                </div>
              </div>

              {/* Trigger */}
              <div>
                <p className="font-mono text-[11px] text-corsair-text-dim sm:text-[12px]">
                  {evt.trigger}
                </p>
                <p className="mt-1 font-mono text-[9px] text-corsair-text-dim/60">
                  Signed SET (Ed25519)
                </p>
              </div>

              {/* Delivery */}
              <div className="hidden sm:block">
                {evt.deliveredTo.map((d) => (
                  <p key={d} className="font-mono text-[10px] text-corsair-text-dim">
                    {"\u2192"} {d}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Protocol footnote */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-corsair-border/30 pt-3 font-mono text-[10px] text-corsair-text-dim">
        <span>OpenID SSF/CAEP</span>
        <span className="text-corsair-border">|</span>
        <span>Ed25519-signed SETs</span>
        <span className="text-corsair-border">|</span>
        <span>Push + poll delivery</span>
        <span className="ml-auto text-corsair-cyan">Subscribers know instantly</span>
      </div>
    </div>
  );
}

// =============================================
// LAYER 2 — INTELLIGENCE PANELS
// =============================================

// ═══════════════════════════════════════════════
// NORMALIZE — canonical evidence transformation
// ═══════════════════════════════════════════════

const normalizeFormats = [
  { format: "prowler", status: "PASS", mapped: "pass", evidence: "scan", provenance: "tool" },
  { format: "securityhub", status: "ACTIVE", mapped: "fail", evidence: "scan", provenance: "tool" },
  { format: "inspec", status: "passed", mapped: "pass", evidence: "scan", provenance: "tool" },
  { format: "trivy", status: "fixed", mapped: "pass", evidence: "scan", provenance: "tool" },
  { format: "ciso-assistant", status: "compliant", mapped: "pass", evidence: "attestation", provenance: "auditor" },
  { format: "generic", status: "effective", mapped: "pass", evidence: "document", provenance: "self" },
];

function NormalizePanel() {
  return (
    <div className="grid gap-px bg-corsair-border md:grid-cols-2">
      {/* Left: Multi-format input */}
      <div className="bg-[#0A0A0A] p-5">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          INPUT — 8 TOOL FORMATS
        </p>
        <div className="font-mono text-[11px] leading-relaxed sm:text-[12px]">
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">corsair sign --file evidence.json</span>

          <div className="mt-3 space-y-1.5">
            {normalizeFormats.map((f) => (
              <div key={f.format} className="flex items-center gap-2 rounded border border-corsair-border/20 px-3 py-1.5">
                <span className="w-24 font-mono text-[10px] text-corsair-turquoise">{f.format}</span>
                <span className="text-corsair-text-dim">{"\u2192"}</span>
                <span className="font-mono text-[10px] text-corsair-text-dim">status: </span>
                <span className="font-mono text-[10px] text-corsair-gold">{f.status}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded border border-corsair-turquoise/20 bg-corsair-turquoise/5 px-3 py-2">
            <p className="font-pixel text-[7px] tracking-wider text-corsair-turquoise">AUTO-DETECTED</p>
            <p className="mt-1 font-mono text-[10px] text-corsair-text-dim">
              Format detection from JSON structure — zero configuration
            </p>
          </div>
        </div>
      </div>

      {/* Right: Canonical output */}
      <div className="bg-[#0A0A0A] p-5">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          OUTPUT — CANONICAL REPRESENTATION
        </p>
        <div className="font-mono text-[11px] leading-relaxed sm:text-[12px]">
          <div className="text-corsair-text-dim">{"{"}</div>
          <div className="ml-4">
            <span className="text-corsair-turquoise">&quot;controlId&quot;</span>
            <span className="text-corsair-text-dim">: </span>
            <span className="text-corsair-green">&quot;CIS-1.1&quot;</span>
            <span className="text-corsair-text-dim">,</span>
          </div>
          <div className="ml-4">
            <span className="text-corsair-turquoise">&quot;status&quot;</span>
            <span className="text-corsair-text-dim">: </span>
            <span className="text-corsair-green">&quot;pass&quot;</span>
            <span className="text-corsair-text-dim">,</span>
          </div>
          <div className="ml-4">
            <span className="text-corsair-turquoise">&quot;severity&quot;</span>
            <span className="text-corsair-text-dim">: </span>
            <span className="text-corsair-green">&quot;high&quot;</span>
            <span className="text-corsair-text-dim">,</span>
          </div>
          <div className="ml-4">
            <span className="text-corsair-turquoise">&quot;evidence.type&quot;</span>
            <span className="text-corsair-text-dim">: </span>
            <span className="text-corsair-green">&quot;scan&quot;</span>
            <span className="text-corsair-text-dim">,</span>
          </div>
          <div className="ml-4">
            <span className="text-corsair-turquoise">&quot;assurance.provenance&quot;</span>
            <span className="text-corsair-text-dim">: </span>
            <span className="text-corsair-green">&quot;tool&quot;</span>
            <span className="text-corsair-text-dim">,</span>
          </div>
          <div className="ml-4">
            <span className="text-corsair-turquoise">&quot;frameworks&quot;</span>
            <span className="text-corsair-text-dim">: [</span>
            <span className="text-corsair-green">&quot;SOC2&quot;</span>
            <span className="text-corsair-text-dim">, </span>
            <span className="text-corsair-green">&quot;NIST-800-53&quot;</span>
            <span className="text-corsair-text-dim">],</span>
          </div>
          <div className="ml-4">
            <span className="text-corsair-turquoise">&quot;evidence.hash&quot;</span>
            <span className="text-corsair-text-dim">: </span>
            <span className="text-corsair-green">&quot;a7f3e2d1...&quot;</span>
          </div>
          <div className="text-corsair-text-dim">{"}"}</div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-corsair-border/30 pt-3 font-mono text-[10px] text-corsair-text-dim">
          <span>Deterministic</span>
          <span className="text-corsair-border">|</span>
          <span>Zero AI</span>
          <span className="text-corsair-border">|</span>
          <span>SHA-256 hashed</span>
          <span className="ml-auto text-corsair-turquoise">Same format, any tool</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SCORE — 7-dimension evidence quality scoring
// ═══════════════════════════════════════════════

const scoreDimensions = [
  { name: "Source Independence", weight: "0.20", score: 85, method: "deterministic", detail: "tool=18, self=2, auditor=2" },
  { name: "Recency", weight: "0.15", score: 92, method: "deterministic", detail: "avg 12 days old" },
  { name: "Coverage", weight: "0.15", score: 100, method: "deterministic", detail: "22/22 have evidence" },
  { name: "Reproducibility", weight: "0.15", score: 80, method: "deterministic", detail: "scan=18, document=2, attestation=2" },
  { name: "Consistency", weight: "0.10", score: 90, method: "deterministic", detail: "3/3 multi-source agree" },
  { name: "Evidence Quality", weight: "0.15", score: 75, method: "model-assisted", detail: "deterministic baseline" },
  { name: "Completeness", weight: "0.10", score: 95, method: "model-assisted", detail: "21/22 assessed (non-skip)" },
];

function ScorePanel() {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div className="font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-gold">$</span>{" "}
        <span className="text-corsair-text">corsair sign --file prowler-findings.json --score</span>
      </div>

      {/* Composite score hero */}
      <div className="mt-4 flex items-center gap-4 rounded-lg border border-corsair-turquoise/20 bg-corsair-turquoise/5 px-4 py-3">
        <div className="text-center">
          <p className="font-mono text-3xl font-bold text-corsair-turquoise">86</p>
          <p className="font-pixel text-[7px] tracking-wider text-corsair-turquoise/60">COMPOSITE</p>
        </div>
        <div className="h-10 w-px bg-corsair-turquoise/20" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-corsair-turquoise">B</span>
            <span className="font-mono text-[11px] text-corsair-text-dim">Evidence Quality Grade</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-corsair-text-dim">
            5 deterministic + 2 model-assisted dimensions
          </p>
        </div>
        <Badge className="ml-auto border-transparent bg-corsair-turquoise/20 font-pixel text-[8px] text-corsair-turquoise">
          FICO FOR COMPLIANCE
        </Badge>
      </div>

      {/* Dimension breakdown */}
      <div className="mt-4 space-y-1.5">
        {scoreDimensions.map((dim) => (
          <div key={dim.name} className="grid grid-cols-[1fr_50px_60px_80px] items-center gap-2 rounded px-2 py-1.5 sm:grid-cols-[1fr_50px_60px_120px_1fr]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-corsair-text sm:text-[12px]">{dim.name}</span>
              {dim.method === "model-assisted" && (
                <span className="font-pixel text-[6px] tracking-wider text-corsair-gold/50">MODEL</span>
              )}
            </div>
            <span className="text-right font-mono text-[10px] text-corsair-text-dim">{dim.weight}</span>
            <span className={`text-right font-mono text-[12px] font-bold ${
              dim.score >= 90 ? "text-corsair-green" :
              dim.score >= 70 ? "text-corsair-turquoise" :
              "text-corsair-gold"
            }`}>{dim.score}</span>
            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-corsair-border/30">
              <div
                className={`h-full rounded-full ${
                  dim.score >= 90 ? "bg-corsair-green" :
                  dim.score >= 70 ? "bg-corsair-turquoise" :
                  "bg-corsair-gold"
                }`}
                style={{ width: `${dim.score}%` }}
              />
            </div>
            <span className="hidden font-mono text-[9px] text-corsair-text-dim sm:block">{dim.detail}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-corsair-border/30 pt-3 font-mono text-[10px] text-corsair-text-dim">
        <span>7 dimensions</span>
        <span className="text-corsair-border">|</span>
        <span>Weights sum to 1.0</span>
        <span className="text-corsair-border">|</span>
        <span>0-100 composite</span>
        <span className="text-corsair-border">|</span>
        <span>A/B/C/D/F grade</span>
        <span className="ml-auto text-corsair-turquoise">Deterministic + explainable</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// QUERY — evidence search, filter, aggregation
// ═══════════════════════════════════════════════

const queryResults = [
  { id: "CIS-1.1", title: "Root Account MFA", status: "fail", severity: "critical", framework: "SOC2", provenance: "tool" },
  { id: "CIS-1.4", title: "IAM Password Policy", status: "fail", severity: "critical", framework: "NIST-800-53", provenance: "tool" },
  { id: "CIS-2.1", title: "CloudTrail Enabled", status: "fail", severity: "high", framework: "SOC2", provenance: "tool" },
  { id: "CC7.3", title: "Physical Security", status: "fail", severity: "high", framework: "SOC2", provenance: "self" },
];

function QueryPanel() {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div className="font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-gold">$</span>{" "}
        <span className="text-corsair-text">queryEvidence(controls,</span>{" "}
        <span className="text-corsair-text-dim">{"{"}</span>
      </div>
      <div className="ml-6 font-mono text-[11px] sm:text-[12px]">
        <div>
          <span className="text-corsair-turquoise">status</span>
          <span className="text-corsair-text-dim">: </span>
          <span className="text-corsair-green">&quot;fail&quot;</span>
          <span className="text-corsair-text-dim">,</span>
        </div>
        <div>
          <span className="text-corsair-turquoise">severity</span>
          <span className="text-corsair-text-dim">: [</span>
          <span className="text-corsair-green">&quot;critical&quot;</span>
          <span className="text-corsair-text-dim">, </span>
          <span className="text-corsair-green">&quot;high&quot;</span>
          <span className="text-corsair-text-dim">],</span>
        </div>
        <div>
          <span className="text-corsair-turquoise">sortBy</span>
          <span className="text-corsair-text-dim">: </span>
          <span className="text-corsair-green">&quot;severity&quot;</span>
          <span className="text-corsair-text-dim">,</span>
        </div>
        <div>
          <span className="text-corsair-turquoise">limit</span>
          <span className="text-corsair-text-dim">: </span>
          <span className="text-corsair-gold">10</span>
        </div>
      </div>
      <div className="font-mono text-[11px] text-corsair-text-dim sm:text-[12px]">{"}"}</div>

      {/* Results */}
      <div className="mt-4 rounded-lg border border-corsair-turquoise/20 bg-corsair-turquoise/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[8px] tracking-wider text-corsair-turquoise">RESULTS</span>
          <span className="font-mono text-[10px] text-corsair-text-dim">4 of 22 controls match</span>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {queryResults.map((r) => (
          <div key={r.id} className="grid grid-cols-[60px_1fr_60px_70px_80px_60px] items-center gap-2 rounded px-2 py-1.5 font-mono text-[11px] sm:text-[12px]">
            <span className="text-corsair-turquoise">{r.id}</span>
            <span className="truncate text-corsair-text text-[10px]">{r.title}</span>
            <StatusBadge status={r.status === "fail" ? "FAIL" : "PASS"} />
            <span className={`text-[10px] ${r.severity === "critical" ? "text-corsair-crimson font-bold" : "text-corsair-gold"}`}>
              {r.severity.toUpperCase()}
            </span>
            <span className="text-[10px] text-corsair-text-dim">{r.framework}</span>
            <span className="text-[10px] text-corsair-text-dim">{r.provenance}</span>
          </div>
        ))}
      </div>

      {/* Aggregations */}
      <div className="mt-4 grid gap-3 border-t border-corsair-border/30 pt-3 sm:grid-cols-3">
        <div className="rounded border border-corsair-border/20 p-2">
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">BY STATUS</p>
          <div className="mt-1 flex gap-3 font-mono text-[10px]">
            <span className="text-corsair-green">pass: 18</span>
            <span className="text-corsair-crimson">fail: 4</span>
          </div>
        </div>
        <div className="rounded border border-corsair-border/20 p-2">
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">BY SEVERITY</p>
          <div className="mt-1 flex gap-3 font-mono text-[10px]">
            <span className="text-corsair-crimson">crit: 2</span>
            <span className="text-corsair-gold">high: 2</span>
          </div>
        </div>
        <div className="rounded border border-corsair-border/20 p-2">
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">BY PROVENANCE</p>
          <div className="mt-1 flex gap-3 font-mono text-[10px]">
            <span className="text-corsair-turquoise">tool: 3</span>
            <span className="text-corsair-text-dim">self: 1</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-corsair-text-dim">
        <span>Filter chain</span>
        <span className="text-corsair-border">|</span>
        <span>Sort + paginate</span>
        <span className="text-corsair-border">|</span>
        <span>Aggregations</span>
        <span className="text-corsair-border">|</span>
        <span>Regression detection</span>
        <span className="ml-auto text-corsair-turquoise">Search across signed evidence</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// QUARTER — Quartermaster governance review
// ═══════════════════════════════════════════════

const governanceChecks = [
  { name: "Self-assessment gap", category: "coverage", severity: "warning" as const, detail: "2 controls rely on self-assessment only (L0)", dimension: "sourceIndependence" },
  { name: "Missing evidence hash", category: "integrity", severity: "warning" as const, detail: "1 control has no evidence hash", dimension: "evidenceQuality" },
  { name: "Stale evidence", category: "recency", severity: "info" as const, detail: "3 controls over 90 days old", dimension: "recency" },
  { name: "Single-source coverage", category: "consistency", severity: "info" as const, detail: "19/22 controls from single tool", dimension: "consistency" },
];

function QuarterPanel() {
  return (
    <div className="grid gap-px bg-corsair-border md:grid-cols-2">
      {/* Left: Governance checks */}
      <div className="bg-[#0A0A0A] p-5">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          QUARTERMASTER — GOVERNANCE CHECKS
        </p>
        <div className="font-mono text-[11px] leading-relaxed sm:text-[12px]">
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">reviewEvidence(controls)</span>

          <div className="mt-3 space-y-2">
            {governanceChecks.map((check, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${
                  check.severity === "warning"
                    ? "border-corsair-gold/20 bg-corsair-gold/5"
                    : "border-corsair-border/20"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    check.severity === "warning" ? "bg-corsair-gold" : "bg-corsair-turquoise/40"
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`font-mono text-[11px] font-bold ${
                        check.severity === "warning" ? "text-corsair-gold" : "text-corsair-turquoise"
                      }`}>
                        {check.name}
                      </p>
                      <span className="font-pixel text-[6px] tracking-wider text-corsair-text-dim">
                        {check.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-corsair-text-dim">{check.detail}</p>
                    <p className="mt-0.5 font-mono text-[9px] text-corsair-turquoise/50">
                      adjusts: {check.dimension}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Adjusted score */}
      <div className="bg-[#0A0A0A] p-5">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          OUTPUT — GOVERNANCE REPORT
        </p>
        <div className="font-mono text-[11px] leading-relaxed sm:text-[12px]">
          {/* Score comparison */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="font-mono text-xl text-corsair-text-dim line-through">86</p>
              <p className="font-pixel text-[6px] tracking-wider text-corsair-text-dim">BASELINE</p>
            </div>
            <span className="text-corsair-text-dim">{"\u2192"}</span>
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-corsair-turquoise">79</p>
              <p className="font-pixel text-[6px] tracking-wider text-corsair-turquoise">ADJUSTED</p>
            </div>
            <div className="ml-2">
              <Badge className="border-transparent bg-corsair-gold/20 font-pixel text-[8px] text-corsair-gold">
                C GRADE
              </Badge>
            </div>
          </div>

          {/* Penalty breakdown */}
          <div className="mt-4 space-y-1.5 rounded border border-corsair-border/20 p-3">
            <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">SCORE ADJUSTMENTS</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-corsair-text-dim">sourceIndependence</span>
              <span className="text-[10px] text-corsair-crimson">-5 (warning penalty)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-corsair-text-dim">evidenceQuality</span>
              <span className="text-[10px] text-corsair-crimson">-5 (warning penalty)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-corsair-text-dim">recency</span>
              <span className="text-[10px] text-corsair-text-dim">0 (info - no penalty)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-corsair-text-dim">consistency</span>
              <span className="text-[10px] text-corsair-text-dim">0 (info - no penalty)</span>
            </div>
          </div>

          {/* Model info */}
          <div className="mt-3 rounded border border-corsair-turquoise/20 bg-corsair-turquoise/5 p-3">
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[7px] tracking-wider text-corsair-turquoise">MODEL</span>
              <span className="font-mono text-[10px] text-corsair-text-dim">deterministic</span>
            </div>
            <p className="mt-1 font-mono text-[9px] text-corsair-text-dim">
              5 deterministic checks + 2 model-assisted (placeholder). Severity: critical=-10, warning=-5, info=0
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-corsair-border/30 pt-3 font-mono text-[10px] text-corsair-text-dim">
          <span>Scoring + governance</span>
          <span className="text-corsair-border">|</span>
          <span>Finding-based adjustment</span>
          <span className="ml-auto text-corsair-turquoise">Explainable score delta</span>
        </div>
      </div>
    </div>
  );
}

// =============================================
// LAYER 3 — DECISION PANELS
// =============================================

// ═══════════════════════════════════════════════
// AUDIT — full compliance audit orchestration
// ═══════════════════════════════════════════════

const auditFindings = [
  { id: "CRIT-001", severity: "critical", category: "failure", title: "Root Account MFA failed", control: "CIS-1.1" },
  { id: "HIGH-001", severity: "high", category: "failure", title: "CloudTrail not enabled", control: "CIS-2.1" },
  { id: "GAP-001", severity: "medium", category: "gap", title: "No evidence for CC7.3", control: "CC7.3" },
  { id: "WEAK-CC8.1", severity: "low", category: "weakness", title: "CC8.1 relies on self-assessment", control: "CC8.1" },
  { id: "STR-CC6.1", severity: "info", category: "strength", title: "Critical control CC6.1 passes", control: "CC6.1" },
];

function AuditPanel() {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div className="font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-gold">$</span>{" "}
        <span className="text-corsair-text">corsair audit</span>{" "}
        <span className="text-corsair-text-dim">--files prowler.json inspec.json --scope &quot;AWS Production&quot; --frameworks SOC2,NIST-800-53 --score</span>
      </div>

      {/* Pipeline steps */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-corsair-green/20 bg-corsair-green/5 px-3 py-2">
        {["INGEST", "NORMALIZE", "SCORE", "FINDINGS", "REPORT"].map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            <span className="font-pixel text-[7px] tracking-wider text-corsair-green">{step}</span>
            {i < 4 && <span className="text-corsair-green/30">{"\u2192"}</span>}
          </span>
        ))}
        <Badge className="ml-auto border-transparent bg-corsair-green/20 font-pixel text-[7px] text-corsair-green">
          ORCHESTRATED
        </Badge>
      </div>

      {/* Score summary */}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded border border-corsair-border/20 p-3 text-center">
          <p className="font-mono text-2xl font-bold text-corsair-green">B</p>
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">GRADE</p>
          <p className="font-mono text-[10px] text-corsair-text-dim">86/100</p>
        </div>
        <div className="rounded border border-corsair-border/20 p-3 text-center">
          <p className="font-mono text-2xl font-bold text-corsair-text">46</p>
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">CONTROLS</p>
          <p className="font-mono text-[10px] text-corsair-text-dim">from 2 sources</p>
        </div>
        <div className="rounded border border-corsair-border/20 p-3 text-center">
          <p className="font-mono text-2xl font-bold text-corsair-green">42</p>
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">PASSED</p>
          <p className="font-mono text-[10px] text-corsair-green">91%</p>
        </div>
        <div className="rounded border border-corsair-border/20 p-3 text-center">
          <p className="font-mono text-2xl font-bold text-corsair-crimson">4</p>
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">FAILED</p>
          <p className="font-mono text-[10px] text-corsair-crimson">1 critical</p>
        </div>
      </div>

      {/* Findings */}
      <div className="mt-4">
        <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-text-dim">FINDINGS</p>
        <div className="space-y-1">
          {auditFindings.map((f) => (
            <div
              key={f.id}
              className={`flex items-center gap-3 rounded px-3 py-1.5 font-mono text-[11px] ${
                f.severity === "critical" ? "bg-corsair-crimson/5" :
                f.severity === "high" ? "bg-corsair-crimson/3" :
                ""
              }`}
            >
              <span className={`w-16 font-bold ${
                f.severity === "critical" ? "text-corsair-crimson" :
                f.severity === "high" ? "text-corsair-crimson/80" :
                f.severity === "medium" ? "text-corsair-gold" :
                f.severity === "low" ? "text-corsair-text-dim" :
                "text-corsair-green"
              }`}>{f.id}</span>
              <span className={`w-16 text-[10px] ${
                f.severity === "critical" ? "text-corsair-crimson" :
                f.severity === "high" ? "text-corsair-crimson/80" :
                f.severity === "medium" ? "text-corsair-gold" :
                f.severity === "low" ? "text-corsair-text-dim" :
                "text-corsair-green"
              }`}>{f.severity}</span>
              <span className="text-corsair-text-dim text-[10px]">{f.title}</span>
              <span className="ml-auto text-corsair-text-dim text-[9px]">{f.control}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-corsair-border/30 pt-3 font-mono text-[10px] text-corsair-text-dim">
        <span>Multi-source ingestion</span>
        <span className="text-corsair-border">|</span>
        <span>Normalize + Score + Govern</span>
        <span className="text-corsair-border">|</span>
        <span>5 finding categories</span>
        <span className="ml-auto text-corsair-green">Full audit in one command</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// CERTIFY — continuous compliance certification
// ═══════════════════════════════════════════════

const certHistory = [
  { date: "2026-02-12", status: "active", score: 86, event: "Renewal audit passed" },
  { date: "2026-01-15", status: "warning", score: 74, event: "Score dropped below threshold" },
  { date: "2025-12-01", status: "active", score: 91, event: "Initial certification" },
];

function CertifyPanel() {
  return (
    <div className="grid gap-px bg-corsair-border md:grid-cols-2">
      {/* Left: Create certification */}
      <div className="bg-[#0A0A0A] p-5">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          CREATE CONTINUOUS CERTIFICATION
        </p>
        <div className="font-mono text-[11px] leading-relaxed sm:text-[12px]">
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">corsair cert create</span>
          <div className="ml-4 text-corsair-text-dim">
            <span className="text-corsair-green">--scope</span> <span className="text-corsair-text">&quot;AWS Production&quot;</span>
          </div>
          <div className="ml-4 text-corsair-text-dim">
            <span className="text-corsair-green">--frameworks</span> <span className="text-corsair-text">SOC2,NIST-800-53</span>
          </div>
          <div className="ml-4 text-corsair-text-dim">
            <span className="text-corsair-green">--files</span> <span className="text-corsair-text">evidence/*.json</span>
          </div>
          <div className="ml-4 text-corsair-text-dim">
            <span className="text-corsair-green">--min-score</span> <span className="text-corsair-gold">70</span>
          </div>
          <div className="ml-4 text-corsair-text-dim">
            <span className="text-corsair-green">--audit-interval</span> <span className="text-corsair-gold">90</span>
          </div>

          <div className="mt-4 space-y-2 rounded border border-corsair-green/20 bg-corsair-green/5 p-3">
            <p className="font-pixel text-[7px] tracking-wider text-corsair-green">CERTIFICATION CREATED</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-[10px] text-corsair-text-dim">ID:</span>
                <span className="text-[10px] text-corsair-text">cert-a1b2c3d4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-corsair-text-dim">Status:</span>
                <span className="text-[10px] text-corsair-green font-bold">[ACTIVE]</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-corsair-text-dim">Score:</span>
                <span className="text-[10px] text-corsair-green">86/100 (B)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-corsair-text-dim">Next audit:</span>
                <span className="text-[10px] text-corsair-text">2026-05-12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-corsair-text-dim">Expires:</span>
                <span className="text-[10px] text-corsair-text">2026-05-26</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Status history + drift */}
      <div className="bg-[#0A0A0A] p-5">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          LIFECYCLE — STATUS TRANSITIONS + DRIFT
        </p>
        <div className="font-mono text-[11px] sm:text-[12px]">
          {/* Status state machine */}
          <div className="flex flex-wrap items-center gap-2 rounded border border-corsair-border/20 p-3">
            {["active", "warning", "degraded", "suspended", "expired", "revoked"].map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`rounded px-1.5 py-0.5 text-[9px] ${
                  s === "active" ? "bg-corsair-green/20 text-corsair-green" :
                  s === "warning" ? "bg-corsair-gold/20 text-corsair-gold" :
                  s === "degraded" ? "bg-corsair-crimson/20 text-corsair-crimson" :
                  s === "revoked" ? "bg-corsair-crimson/30 text-corsair-crimson font-bold" :
                  "bg-corsair-border/30 text-corsair-text-dim"
                }`}>{s}</span>
                {i < 5 && <span className="text-corsair-text-dim/30 text-[8px]">{"\u2192"}</span>}
              </span>
            ))}
          </div>

          {/* History timeline */}
          <div className="relative mt-4">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-corsair-green/20" />
            <div className="space-y-2">
              {certHistory.map((entry, i) => (
                <div key={i} className="relative flex gap-3">
                  <div className="relative z-10">
                    <div className={`h-3 w-3 rounded-full border-2 ${
                      i === 0 ? "border-corsair-green bg-corsair-green" :
                      entry.status === "warning" ? "border-corsair-gold/50 bg-corsair-bg" :
                      "border-corsair-green/30 bg-corsair-bg"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-corsair-text-dim">{entry.date}</span>
                      <span className={`rounded px-1 py-0.5 text-[9px] ${
                        entry.status === "active" ? "bg-corsair-green/20 text-corsair-green" :
                        "bg-corsair-gold/20 text-corsair-gold"
                      }`}>{entry.status}</span>
                      <span className="text-corsair-text-dim text-[10px]">score: {entry.score}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-corsair-text-dim">{entry.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drift detection */}
          <div className="mt-4 rounded border border-corsair-gold/20 bg-corsair-gold/5 p-3">
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">DRIFT DETECTED</span>
              <span className="font-mono text-[10px] text-corsair-gold">score: 91 {"\u2192"} 74 (-17)</span>
            </div>
            <p className="mt-1 font-mono text-[9px] text-corsair-text-dim">
              Recommendation: investigate. 2 controls degraded. Grace period: 14 days.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-corsair-border/30 pt-3 font-mono text-[10px] text-corsair-text-dim">
          <span>Auto-renew</span>
          <span className="text-corsair-border">|</span>
          <span>Drift detection</span>
          <span className="text-corsair-border">|</span>
          <span>Grace period</span>
          <span className="ml-auto text-corsair-green">Compliance as code</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TPRM — Third-Party Risk Management
// ═══════════════════════════════════════════════

function TPRMPanel() {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div className="font-mono text-[11px] sm:text-[12px]">
        <span className="text-corsair-gold">$</span>{" "}
        <span className="text-corsair-text">corsair tprm assess</span>{" "}
        <span className="text-corsair-text-dim">--vendor acme-cloud --frameworks SOC2,NIST-800-53 --cpoes cpoe-v1.jwt cpoe-v2.jwt</span>
      </div>

      {/* Decision banner */}
      <div className="mt-4 flex items-center gap-4 rounded-lg border border-corsair-green/30 bg-corsair-green/10 px-4 py-3">
        <div className="text-center">
          <p className="font-mono text-3xl font-bold text-corsair-green">82</p>
          <p className="font-pixel text-[7px] tracking-wider text-corsair-green/60">COMPOSITE</p>
        </div>
        <div className="h-10 w-px bg-corsair-green/20" />
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-transparent bg-corsair-green/30 font-pixel text-[9px] text-corsair-green">
              CONDITIONAL APPROVAL
            </Badge>
          </div>
          <p className="mt-1 font-mono text-[10px] text-corsair-text-dim">
            Score 82 meets conditional threshold (70) but not auto-approve (85)
          </p>
        </div>
      </div>

      {/* 5-dimension breakdown */}
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {[
          { name: "Evidence Quality", weight: "0.30", score: 86, color: "text-corsair-green" },
          { name: "Certification", weight: "0.25", score: 75, color: "text-corsair-turquoise" },
          { name: "Framework Cov.", weight: "0.20", score: 100, color: "text-corsair-green" },
          { name: "Freshness", weight: "0.15", score: 68, color: "text-corsair-gold" },
          { name: "Trend", weight: "0.10", score: 80, color: "text-corsair-turquoise" },
        ].map((dim) => (
          <div key={dim.name} className="rounded border border-corsair-border/20 p-2 text-center">
            <p className={`font-mono text-lg font-bold ${dim.color}`}>{dim.score}</p>
            <p className="font-mono text-[9px] text-corsair-text-dim">{dim.name}</p>
            <p className="font-pixel text-[6px] tracking-wider text-corsair-text-dim/50">w: {dim.weight}</p>
          </div>
        ))}
      </div>

      {/* Findings + Conditions */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-corsair-border/20 p-3">
          <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-text-dim">FINDINGS</p>
          <div className="space-y-1.5">
            {[
              { severity: "high", title: "Stale evidence: CPOE v1 is 120 days old" },
              { severity: "medium", title: "No active certification found" },
              { severity: "info", title: "Historical trend: stable (+3 points)" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  f.severity === "high" ? "bg-corsair-crimson" :
                  f.severity === "medium" ? "bg-corsair-gold" :
                  "bg-corsair-turquoise/40"
                }`} />
                <p className="font-mono text-[10px] text-corsair-text-dim">{f.title}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-corsair-gold/20 bg-corsair-gold/5 p-3">
          <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold">CONDITIONS FOR APPROVAL</p>
          <div className="space-y-1.5">
            {[
              "Renew stale CPOE (v1 > 90 days old)",
              "Establish active compliance certification",
              "Manual security team review",
            ].map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-[10px] text-corsair-gold">-</span>
                <p className="font-mono text-[10px] text-corsair-text-dim">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision thresholds */}
      <div className="mt-4 flex items-center gap-1 rounded border border-corsair-border/20 p-2">
        <span className="font-pixel text-[6px] tracking-wider text-corsair-text-dim">THRESHOLDS:</span>
        <span className="rounded bg-corsair-crimson/10 px-1.5 py-0.5 font-mono text-[9px] text-corsair-crimson">reject &lt;50</span>
        <span className="rounded bg-corsair-gold/10 px-1.5 py-0.5 font-mono text-[9px] text-corsair-gold">review 50-70</span>
        <span className="rounded bg-corsair-turquoise/10 px-1.5 py-0.5 font-mono text-[9px] text-corsair-turquoise">conditional 70-85</span>
        <span className="rounded bg-corsair-green/10 px-1.5 py-0.5 font-mono text-[9px] text-corsair-green">approved 85+</span>
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-corsair-border/30 pt-3 font-mono text-[10px] text-corsair-text-dim">
        <span>5 scoring dimensions</span>
        <span className="text-corsair-border">|</span>
        <span>Automated decisions</span>
        <span className="text-corsair-border">|</span>
        <span>Vendor monitoring</span>
        <span className="text-corsair-border">|</span>
        <span>Dashboard</span>
        <span className="ml-auto text-corsair-green">Questionnaires are dead</span>
      </div>
    </div>
  );
}

// ─── Helpers ───

function Line({ k, v, raw }: { k: string; v: string; raw?: boolean }) {
  if (raw) return <div className="ml-4 text-corsair-text-dim">{v}</div>;
  return (
    <div className="ml-4">
      <span className="text-corsair-gold">&quot;{k}&quot;</span>
      <span className="text-corsair-text-dim">: </span>
      <span className="text-corsair-green">{v}</span>
      <span className="text-corsair-text-dim">,</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPass = status === "PASS";
  return (
    <span
      className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[10px] ${
        isPass
          ? "bg-corsair-green/10 text-corsair-green"
          : "bg-corsair-crimson/10 text-corsair-crimson"
      }`}
    >
      {status}
    </span>
  );
}
