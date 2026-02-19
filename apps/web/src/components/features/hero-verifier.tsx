"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RotateCcw, Share2 } from "lucide-react";
import { verifyViaAPI } from "@/lib/corsair-api";
import type { MarqueVerificationResult } from "@/lib/marque-web-verifier";

type VerifierState = "demo" | "idle" | "verifying" | "verified" | "failed";

/** Pre-loaded demo result — renders instantly on page load (no API call). */
const DEMO_RESULT: MarqueVerificationResult = {
  valid: true,
  reason: "Signature verified via DID:web. Credential integrity confirmed.",
  format: "jwt",
  issuerTier: "corsair-verified",
  provenance: { source: "tool", sourceIdentity: "Scanner v1.2" },
  scope: "AWS Production Baseline",
  summary: {
    controlsTested: 51,
    controlsPassed: 47,
    controlsFailed: 4,
    overallScore: 92,
  },
  vcMetadata: {
    context: ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/v1"],
    credentialType: ["VerifiableCredential", "CorsairCPOE"],
    issuerDID: "did:web:grcorsair.com",
    parleyVersion: "2.1",
    generatedAt: "2026-02-16T00:00:00Z",
  },
};

export function HeroVerifier() {
  const [state, setState] = useState<VerifierState>("demo");
  const [jwt, setJwt] = useState("");
  const [result, setResult] = useState<MarqueVerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const verify = useCallback(async (input: string) => {
    if (!input.trim()) return;
    setState("verifying");
    setResult(null);
    setErrorMsg("");

    const { decodeJWTPayload, mergeAPIResultWithDecoded } = await import("@/lib/marque-web-verifier");
    const decoded = decodeJWTPayload(input.trim());
    const apiResult = await verifyViaAPI(input.trim());

    if (apiResult.ok) {
      const merged = mergeAPIResultWithDecoded(apiResult.data, decoded);
      setResult(merged);
      setState(merged.valid ? "verified" : "failed");
      if (!merged.valid) setErrorMsg(merged.reason);
    } else {
      // API failed — fall back to client-side decode for display
      if (decoded) {
        setResult({
          valid: false,
          reason: `Client-side decode only — ${apiResult.error.message}`,
          format: "jwt",
          vcMetadata: {
            context: [],
            credentialType: [],
            issuerDID: (decoded.iss as string) ?? "",
            parleyVersion: (decoded.parley as string) ?? "",
          },
        });
        setState("failed");
        setErrorMsg(apiResult.error.message);
      } else {
        setState("failed");
        setErrorMsg(apiResult.error.message);
      }
    }
  }, []);

  const handleVerify = () => verify(jwt);

  const handleTrySample = async () => {
    // Dynamic import to avoid btoa at module level during SSR
    const { SAMPLE_CPOE_JWT } = await import("@/lib/marque-web-verifier");
    setJwt(SAMPLE_CPOE_JWT);
    verify(SAMPLE_CPOE_JWT);
  };

  const handleReset = () => {
    setState("idle");
    setJwt("");
    setResult(null);
    setErrorMsg("");
  };

  const handleVerifyOwn = () => {
    setState("idle");
    setJwt("");
    setResult(null);
    setErrorMsg("");
  };

  const borderClass = {
    demo: "border-corsair-green/60 shadow-[0_0_30px_rgba(34,197,94,0.15)]",
    idle: "border-corsair-gold/20 shadow-[0_0_15px_rgba(212,168,83,0.05)]",
    verifying: "border-corsair-gold/60 animate-pulse",
    verified: "border-corsair-green/60 shadow-[0_0_30px_rgba(34,197,94,0.15)]",
    failed: "border-corsair-crimson/60 shadow-[0_0_30px_rgba(239,68,68,0.15)]",
  }[state];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`relative rounded-xl border ${borderClass} bg-corsair-surface p-5 transition-all duration-500`}
    >
      <AnimatePresence mode="wait">
        {state === "demo" && (
          <motion.div
            key="demo"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-corsair-green" />
                <span className="font-display text-sm font-semibold text-corsair-green">
                  Verified
                </span>
              </div>
              <span className="rounded-full border border-corsair-gold/30 px-2.5 py-0.5 font-display text-[10px] font-medium tracking-widest text-corsair-gold">
                EXAMPLE VERIFICATION
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <ResultRow label="Issuer" value={DEMO_RESULT.vcMetadata!.issuerDID} />
              <ResultRow label="Provenance" value={`${DEMO_RESULT.provenance!.source} / ${DEMO_RESULT.provenance!.sourceIdentity}`} />
              <ResultRow label="Framework" value={DEMO_RESULT.scope!} span />
              <ResultRow
                label="Controls"
                value={`${DEMO_RESULT.summary!.controlsPassed}/${DEMO_RESULT.summary!.controlsTested} passed`}
              />
              <ResultRow
                label="Score"
                value={`${DEMO_RESULT.summary!.overallScore}%`}
              />
            </div>

            <div className="mt-1 flex gap-2">
              <Button
                size="sm"
                onClick={handleVerifyOwn}
                className="btn-glow font-display text-xs font-semibold"
              >
                Verify your own
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const url = `${window.location.origin}/demo`;
                  navigator.clipboard.writeText(url);
                }}
                className="font-display text-xs text-corsair-text-dim hover:text-corsair-gold"
              >
                <Share2 className="mr-1.5 h-3 w-3" />
                Share link
              </Button>
            </div>
          </motion.div>
        )}

        {(state === "idle" || state === "verifying") && (
          <motion.div
            key="input"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <label className="mb-2 block font-display text-xs font-medium tracking-wide text-corsair-text-dim">
              VERIFY A COMPLIANCE PROOF
            </label>
            <textarea
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              placeholder="Paste a signed compliance proof (JWT) to verify..."
              rows={3}
              disabled={state === "verifying"}
              className="w-full resize-none rounded-lg border border-corsair-border/60 bg-[#0A0A0A] p-3 font-mono text-[11px] leading-relaxed text-corsair-text-dim placeholder:text-corsair-text-dim/40 focus:border-corsair-gold/50 focus:outline-none focus:ring-1 focus:ring-corsair-gold/20 disabled:opacity-50"
            />
            <div className="mt-3 flex gap-3">
              <Button
                onClick={handleTrySample}
                disabled={state === "verifying"}
                className="btn-glow font-display text-sm font-semibold"
              >
                Try it now
              </Button>
              <Button
                variant="outline"
                onClick={handleVerify}
                disabled={!jwt.trim() || state === "verifying"}
                className="font-display text-sm font-semibold border-corsair-gold/30 text-corsair-text-dim hover:border-corsair-gold hover:text-corsair-gold"
              >
                {state === "verifying" ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify CPOE"
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {state === "verified" && result && (
          <motion.div
            key="result-success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-corsair-green" />
              <span className="font-display text-sm font-semibold text-corsair-green">
                Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {result.vcMetadata?.issuerDID && (
                <ResultRow label="Issuer" value={result.vcMetadata.issuerDID} />
              )}
              {result.scope && (
                <ResultRow label="Framework" value={result.scope} span />
              )}
              {result.summary && (
                <>
                  <ResultRow
                    label="Controls"
                    value={`${result.summary.controlsPassed}/${result.summary.controlsTested} passed`}
                  />
                  <ResultRow
                    label="Score"
                    value={`${result.summary.overallScore}%`}
                  />
                </>
              )}
              {result.vcMetadata?.generatedAt && (
                <ResultRow
                  label="Issued"
                  value={new Date(result.vcMetadata.generatedAt).toLocaleDateString()}
                />
              )}
            </div>

            <div className="mt-1 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReset}
                className="font-display text-xs text-corsair-text-dim hover:text-corsair-gold"
              >
                <RotateCcw className="mr-1.5 h-3 w-3" />
                Verify another
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const url = `${window.location.origin}/verify?cpoe=${encodeURIComponent(jwt)}`;
                  navigator.clipboard.writeText(url);
                }}
                className="font-display text-xs text-corsair-text-dim hover:text-corsair-gold"
              >
                <Share2 className="mr-1.5 h-3 w-3" />
                Share link
              </Button>
            </div>
          </motion.div>
        )}

        {state === "failed" && (
          <motion.div
            key="result-failed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-corsair-crimson" />
              <span className="font-display text-sm font-semibold text-corsair-crimson">
                Verification Failed
              </span>
            </div>
            <p className="text-xs leading-relaxed text-corsair-text-dim">
              {errorMsg}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="font-display text-xs text-corsair-text-dim hover:text-corsair-gold"
            >
              <RotateCcw className="mr-1.5 h-3 w-3" />
              Try again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ResultRow({
  label,
  value,
  span,
}: {
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <span className="text-corsair-text-dim/60">{label}</span>
      <p className="truncate font-mono text-corsair-text">{value}</p>
    </div>
  );
}
