"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { verifyViaAPI } from "@/lib/corsair-api";
import {
  SAMPLE_CPOE_JWT,
  decodeJWTPayload,
  mergeAPIResultWithDecoded,
} from "@/lib/marque-web-verifier";
import type { MarqueVerificationResult } from "@/lib/marque-web-verifier";

type VerifierState = "idle" | "verifying" | "verified" | "failed";

export function HeroVerifier() {
  const [state, setState] = useState<VerifierState>("idle");
  const [jwt, setJwt] = useState("");
  const [result, setResult] = useState<MarqueVerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const verify = useCallback(async (input: string) => {
    if (!input.trim()) return;
    setState("verifying");
    setResult(null);
    setErrorMsg("");

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

  const handleTrySample = () => {
    setJwt(SAMPLE_CPOE_JWT);
    verify(SAMPLE_CPOE_JWT);
  };

  const handleReset = () => {
    setState("idle");
    setJwt("");
    setResult(null);
    setErrorMsg("");
  };

  const borderClass = {
    idle: "border-corsair-border",
    verifying: "border-corsair-gold/60 animate-pulse",
    verified: "border-corsair-green/60 shadow-[0_0_30px_rgba(34,197,94,0.15)]",
    failed: "border-corsair-crimson/60 shadow-[0_0_30px_rgba(239,68,68,0.15)]",
  }[state];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className={`relative rounded-xl border ${borderClass} bg-corsair-surface p-5 transition-all duration-500`}
    >
      <AnimatePresence mode="wait">
        {(state === "idle" || state === "verifying") && (
          <motion.div
            key="input"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <label className="mb-2 block font-display text-xs font-medium tracking-wide text-corsair-text-dim">
              VERIFY A CPOE
            </label>
            <textarea
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              placeholder="Paste a CPOE (JWT) to verify..."
              rows={4}
              disabled={state === "verifying"}
              className="w-full resize-none rounded-lg border border-corsair-border/60 bg-[#0A0A0A] p-3 font-mono text-[11px] leading-relaxed text-corsair-text-dim placeholder:text-corsair-text-dim/40 focus:border-corsair-gold/50 focus:outline-none focus:ring-1 focus:ring-corsair-gold/20 disabled:opacity-50"
            />
            <div className="mt-3 flex gap-3">
              <Button
                size="sm"
                onClick={handleVerify}
                disabled={!jwt.trim() || state === "verifying"}
                className="font-display text-xs font-semibold"
              >
                {state === "verifying" ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleTrySample}
                disabled={state === "verifying"}
                className="font-display text-xs font-semibold text-corsair-text-dim hover:text-corsair-gold"
              >
                Try Sample
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

            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="mt-1 font-display text-xs text-corsair-text-dim hover:text-corsair-gold"
            >
              <RotateCcw className="mr-1.5 h-3 w-3" />
              Verify another
            </Button>
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
