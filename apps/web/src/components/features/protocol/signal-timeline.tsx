"use client";

import { motion } from "motion/react";
import { FLAGSHIP_TIMELINE, type FlagshipEvent } from "@/data/protocol-data";

const severityStyles: Record<FlagshipEvent["severity"], { dot: string; label: string; border: string }> = {
  info: { dot: "bg-corsair-green", label: "text-corsair-green", border: "border-corsair-green/20" },
  warning: { dot: "bg-corsair-gold", label: "text-corsair-gold", border: "border-corsair-gold/20" },
  critical: { dot: "bg-corsair-crimson", label: "text-corsair-crimson", border: "border-corsair-crimson/20" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function SignalTimeline() {
  return (
    <div className="space-y-6">
      {/* SSF/CAEP event mapping */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { pirate: "FLEET_ALERT", caep: "compliance-change", desc: "Drift detected", color: "corsair-crimson" },
          { pirate: "PAPERS_CHANGED", caep: "credential-change", desc: "CPOE lifecycle event", color: "corsair-turquoise" },
          { pirate: "MARQUE_REVOKED", caep: "session-revoked", desc: "Emergency revocation", color: "corsair-crimson" },
        ].map((event, i) => (
          <motion.div
            key={event.pirate}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-4"
          >
            <p
              className="mb-1 font-pixel text-[8px] tracking-wider"
              style={{ color: event.color === "corsair-gold" ? "#D4A853" : event.color === "corsair-crimson" ? "#C0392B" : "#7FDBCA" }}
            >
              {event.pirate}
            </p>
            <p className="font-mono text-[10px] text-corsair-text-dim">
              {event.caep}
            </p>
            <p className="mt-2 text-xs text-corsair-text-dim">{event.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
        <p className="mb-6 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          FLAGSHIP EVENT TIMELINE — ACME CORP COMPLIANCE SIGNALS
        </p>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 h-full w-px bg-corsair-border/50" />

          <div className="space-y-0">
            {FLAGSHIP_TIMELINE.map((event, i) => {
              const styles = severityStyles[event.severity];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="relative flex gap-4 py-3"
                >
                  {/* Dot on timeline */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full ${styles.dot} ring-2 ring-[#0A0A0A]`} />
                  </div>

                  {/* Content */}
                  <div className={`flex-1 rounded-lg border ${styles.border} bg-corsair-surface/50 p-3`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-pixel text-[7px] tracking-wider ${styles.label}`}>
                        {event.pirateName}
                      </span>
                      <span className="font-mono text-[9px] text-corsair-text-dim">
                        {event.caepType}
                      </span>
                      <span className="ml-auto font-mono text-[9px] text-corsair-text-dim/60">
                        {formatTime(event.time)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-corsair-text-dim">
                      {event.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delivery protocol */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-xl border border-corsair-gold/20 bg-corsair-surface p-5"
      >
        <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          SSF DELIVERY PROTOCOL
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-corsair-text">Push</p>
            <p className="mt-1 text-xs text-corsair-text-dim">
              Webhook delivery to subscriber endpoints. Retry and backoff behavior is implementer-defined.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-corsair-text">Poll</p>
            <p className="mt-1 text-xs text-corsair-text-dim">
              Subscriber requests events via GET. Cursor-based pagination. Retention is defined per stream policy.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-corsair-text">Security</p>
            <p className="mt-1 text-xs text-corsair-text-dim">
              Every SET is an Ed25519-signed JWT. Receiver verifies signature before processing. Replay protection via jti claim.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
