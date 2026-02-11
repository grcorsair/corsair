"use client";

import { motion } from "motion/react";
import { DEMO_FRAMEWORK_MAPPINGS, DEMO_DOCUMENT } from "@/data/demo-data";

export function ChartCascade() {
  const maxMapped = Math.max(...DEMO_FRAMEWORK_MAPPINGS.map((f) => f.controlsMapped));

  return (
    <div className="space-y-6">
      {/* Source + crosswalk indicator */}
      <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div>
            <p className="font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              SOURCE
            </p>
            <p className="mt-1 font-display text-sm font-semibold text-corsair-text">
              {DEMO_DOCUMENT.name}
            </p>
          </div>

          {/* Arrow */}
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-px w-8 bg-corsair-border" />
            <div className="rounded-md border border-corsair-border bg-corsair-surface px-2 py-1">
              <span className="font-pixel text-[7px] tracking-wider text-corsair-turquoise">
                CTID + SCF
              </span>
            </div>
            <div className="h-px w-8 bg-corsair-border" />
            <svg width="8" height="12" viewBox="0 0 8 12" className="text-corsair-border">
              <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          <div>
            <p className="font-pixel text-[8px] tracking-widest text-corsair-turquoise/60">
              TARGETS
            </p>
            <p className="mt-1 text-xs text-corsair-text-dim">
              {DEMO_FRAMEWORK_MAPPINGS.length} compliance frameworks
            </p>
          </div>
        </div>

        {/* Explanation */}
        <p className="mb-6 text-xs text-corsair-text-dim">
          CHART maps extracted controls using CTID (ATT&CK → NIST 800-53) and SCF (NIST → everything else)
          crosswalk data. One ingestion covers {DEMO_FRAMEWORK_MAPPINGS.length}+ frameworks automatically.
        </p>

        {/* Framework rows */}
        <div className="space-y-3">
          {DEMO_FRAMEWORK_MAPPINGS.map((fw, i) => {
            const passRate = Math.round((fw.passed / fw.controlsMapped) * 100);
            const barWidth = (fw.controlsMapped / maxMapped) * 100;

            return (
              <motion.div
                key={fw.framework}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="flex items-center gap-3">
                  {/* Framework name */}
                  <div className="w-24 flex-shrink-0 sm:w-28">
                    <span className="text-xs font-medium text-corsair-text">
                      {fw.framework}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1">
                    <div className="h-5 overflow-hidden rounded-md bg-corsair-border/30">
                      {/* Passed portion */}
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${barWidth}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.2 + i * 0.08 }}
                        className="relative flex h-full items-center"
                      >
                        {/* Pass segment */}
                        <div
                          className="h-full"
                          style={{
                            width: `${passRate}%`,
                            backgroundColor: fw.color,
                            opacity: 0.8,
                          }}
                        />
                        {/* Fail segment */}
                        <div
                          className="h-full bg-corsair-crimson/60"
                          style={{ width: `${100 - passRate}%` }}
                        />
                      </motion.div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex w-28 flex-shrink-0 items-center gap-2 sm:w-36">
                    <span className="font-mono text-[10px] text-corsair-text-dim">
                      {fw.controlsMapped} mapped
                    </span>
                    <span className="font-mono text-[10px] font-semibold" style={{ color: fw.color }}>
                      {passRate}%
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Crosswalk data source cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-corsair-border bg-corsair-surface p-4"
        >
          <p className="font-pixel text-[7px] tracking-wider text-corsair-gold">CTID</p>
          <p className="mt-1 text-xs font-medium text-corsair-text">ATT&CK → NIST 800-53</p>
          <p className="mt-1 text-xs text-corsair-text-dim">
            6,300+ mappings from MITRE ATT&CK techniques to NIST security controls
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7 }}
          className="rounded-xl border border-corsair-border bg-corsair-surface p-4"
        >
          <p className="font-pixel text-[7px] tracking-wider text-corsair-turquoise">SCF</p>
          <p className="mt-1 text-xs font-medium text-corsair-text">NIST 800-53 → 175+ frameworks</p>
          <p className="mt-1 text-xs text-corsair-text-dim">
            Secure Controls Framework crosswalk connects NIST to ISO, HIPAA, PCI, CIS, and more
          </p>
        </motion.div>
      </div>
    </div>
  );
}
