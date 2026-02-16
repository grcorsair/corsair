"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { DEMO_DIFF, DEMO_LOG_ENTRIES } from "@/content/demo-cpoes";

// ─── Tab definitions — Five Primitives ───

interface TabDef {
  id: string;
  label: string;
  color: string;
  bg: string;
  desc: string;
}

const tabs: TabDef[] = [
  { id: "sign", label: "SIGN", color: "text-corsair-crimson", bg: "bg-corsair-crimson", desc: "like git commit" },
  { id: "verify", label: "VERIFY", color: "text-corsair-gold", bg: "bg-corsair-gold", desc: "like HTTPS" },
  { id: "diff", label: "DIFF", color: "text-corsair-green", bg: "bg-corsair-green", desc: "like git diff" },
  { id: "log", label: "LOG", color: "text-corsair-turquoise", bg: "bg-corsair-turquoise", desc: "SCITT transparency log" },
  { id: "signal", label: "SIGNAL", color: "text-corsair-cyan", bg: "bg-corsair-cyan", desc: "FLAGSHIP events" },
];

// ─── Main component ───

export function PrimitivesInAction() {
  const [activeTab, setActiveTab] = useState(0);
  const currentTab = tabs[activeTab];

  return (
    <div>
      {/* Tab bar — Five Primitives */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1 rounded-lg border border-corsair-border bg-corsair-surface p-1">
          {tabs.map((tab, i) => (
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
          <Badge className="ml-auto border-transparent font-pixel text-[7px] bg-corsair-gold/10 text-corsair-gold">
            PARLEY PROTOCOL
          </Badge>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {currentTab.id === "sign" && <SignPanel />}
            {currentTab.id === "verify" && <VerifyPanel />}
            {currentTab.id === "diff" && <DiffPanel />}
            {currentTab.id === "log" && <LogPanel />}
            {currentTab.id === "signal" && <SignalPanel />}
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

const diffControls = DEMO_DIFF.controls;

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
        {DEMO_DIFF.summary.improvements > 0 && (
          <span className="text-corsair-green">+{DEMO_DIFF.summary.improvements} fixed</span>
        )}
        {DEMO_DIFF.summary.regressions > 0 && (
          <span className="text-corsair-crimson">-{DEMO_DIFF.summary.regressions} regression</span>
        )}
        <span className="text-corsair-text-dim">{DEMO_DIFF.summary.unchanged} unchanged</span>
        <span className="ml-auto text-corsair-text-dim">
          Score: <span className="text-corsair-gold">{DEMO_DIFF.summary.scoreBefore}%</span>{" "}
          {"→"}{" "}
          <span className="text-corsair-green">{DEMO_DIFF.summary.scoreAfter}%</span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// LOG — SCITT append-only transparency chain
// ═══════════════════════════════════════════════

const scittEntries = DEMO_LOG_ENTRIES;

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
