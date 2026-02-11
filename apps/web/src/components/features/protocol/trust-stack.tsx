"use client";

import { motion } from "motion/react";
import {
  PROTOCOL_STANDARDS,
  JWT_VC_LAYERS,
  DID_RESOLUTION_STEPS,
  DID_DOCUMENT_EXAMPLE,
  VERIFICATION_STEPS,
} from "@/data/protocol-data";

function StandardCard({
  standard,
  index,
}: {
  standard: (typeof PROTOCOL_STANDARDS)[number];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group rounded-xl border border-corsair-border bg-[#0A0A0A] p-5 transition-colors hover:border-corsair-gold/30"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-pixel text-[9px] tracking-wider text-corsair-gold">
          {standard.name}
        </span>
        <span className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          {standard.role.toUpperCase()}
        </span>
      </div>
      <p className="mb-2 text-sm font-medium text-corsair-text">
        {standard.fullName}
      </p>
      <p className="mb-3 text-xs text-corsair-text-dim leading-relaxed">
        {standard.what}
      </p>
      <div className="flex items-center justify-between border-t border-corsair-border pt-3">
        <span className="font-mono text-[10px] text-corsair-turquoise">
          {standard.spec}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-corsair-text-dim italic">
        {standard.why}
      </p>
    </motion.div>
  );
}

export function ProtocolComposition() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PROTOCOL_STANDARDS.map((s, i) => (
        <StandardCard key={s.name} standard={s} index={i} />
      ))}
    </div>
  );
}

export function JWTVCStructure() {
  return (
    <div className="space-y-3">
      {JWT_VC_LAYERS.map((layer, li) => (
        <motion.div
          key={layer.name}
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: li * 0.15 }}
          className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]"
        >
          <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
            <div
              className={`h-2 w-2 rounded-full`}
              style={{
                backgroundColor:
                  layer.color === "corsair-gold"
                    ? "#D4A853"
                    : layer.color === "corsair-turquoise"
                      ? "#7FDBCA"
                      : "#2ECC71",
              }}
            />
            <span
              className={`font-pixel text-[7px] tracking-wider`}
              style={{
                color:
                  layer.color === "corsair-gold"
                    ? "#D4A853"
                    : layer.color === "corsair-turquoise"
                      ? "#7FDBCA"
                      : "#2ECC71",
              }}
            >
              {layer.name.toUpperCase()}
            </span>
          </div>
          <div className="divide-y divide-corsair-border/50">
            {layer.fields.map((field) => (
              <div
                key={field.key}
                className="flex items-start gap-4 px-4 py-2.5"
              >
                <span className="w-16 flex-shrink-0 font-mono text-[11px] text-corsair-gold">
                  {field.key}
                </span>
                <span className="font-mono text-[11px] text-corsair-text">
                  {field.value}
                </span>
                <span className="ml-auto hidden text-[10px] text-corsair-text-dim sm:block">
                  {field.note}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Dot separator between sections */}
      <div className="flex items-center justify-center gap-1 py-2">
        <div className="h-1 w-1 rounded-full bg-corsair-gold/30" />
        <div className="h-1 w-1 rounded-full bg-corsair-gold/30" />
        <div className="h-1 w-1 rounded-full bg-corsair-gold/30" />
      </div>

      {/* Verification flow */}
      <div className="rounded-xl border border-corsair-gold/20 bg-corsair-surface p-5">
        <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          VERIFICATION FLOW — 4 STEPS, ANY JWT LIBRARY
        </p>
        <div className="space-y-4">
          {VERIFICATION_STEPS.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex gap-4"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-corsair-border bg-[#0A0A0A] font-pixel text-[8px] text-corsair-gold">
                {step.step}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-corsair-text">
                  {step.action}
                </p>
                <p className="mt-0.5 text-xs text-corsair-text-dim">
                  {step.detail}
                </p>
                <pre className="mt-1.5 overflow-x-auto rounded-md bg-[#0A0A0A] px-3 py-1.5 font-mono text-[10px] text-corsair-turquoise">
                  {step.code}
                </pre>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DIDResolutionFlow() {
  return (
    <div className="space-y-6">
      {/* Step-by-step resolution */}
      <div className="grid gap-3 sm:grid-cols-2">
        {DID_RESOLUTION_STEPS.map((step, i) => (
          <motion.div
            key={step.step}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-corsair-gold/20 font-pixel text-[7px] text-corsair-gold">
                {step.step}
              </span>
              <span className="font-pixel text-[8px] tracking-wider text-corsair-text-dim">
                {step.label.toUpperCase()}
              </span>
            </div>
            <div className="mb-1 font-mono text-[10px] text-corsair-text-dim">
              <span className="text-corsair-gold/60">in:</span> {step.input}
            </div>
            <div className="mb-2 font-mono text-[10px] text-corsair-green">
              <span className="text-corsair-gold/60">out:</span> {step.output}
            </div>
            <p className="text-[11px] text-corsair-text-dim">{step.detail}</p>
          </motion.div>
        ))}
      </div>

      {/* DID Document */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]"
      >
        <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-corsair-turquoise/60" />
          <span className="font-pixel text-[7px] tracking-wider text-corsair-turquoise">
            /.WELL-KNOWN/DID.JSON
          </span>
          <span className="ml-auto font-mono text-[9px] text-corsair-text-dim">
            grcorsair.com
          </span>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-corsair-text-dim">
          {DID_DOCUMENT_EXAMPLE}
        </pre>
      </motion.div>
    </div>
  );
}
