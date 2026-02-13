"use client";

import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ReconIcon,
  RaidIcon,
  ChartIcon,
  QuarterIcon,
  MarqueIcon,
  SpyglassIcon,
  PlunderIcon,
  MarkIcon,
} from "@/components/pixel-art/pixel-icons";

/* ─── Layer definitions ──────────────────────────────────── */

interface Stage {
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface Layer {
  number: number;
  label: string;
  tagline: string;
  color: string;
  glowColor: string;
  borderColor: string;
  bgTint: string;
  stages: Stage[];
}

const layers: Layer[] = [
  {
    number: 1,
    label: "Infrastructure",
    tagline: "Ed25519 signing, SCITT transparency, DID:web identity",
    color: "#D4A853",
    glowColor: "rgba(212,168,83,0.15)",
    borderColor: "rgba(212,168,83,0.3)",
    bgTint: "rgba(212,168,83,0.04)",
    stages: [
      {
        name: "EVIDENCE",
        description:
          "Accept structured output from security tools — Prowler, InSpec, Trivy, SecurityHub",
        icon: <ReconIcon size={36} />,
      },
      {
        name: "SIGN",
        description:
          "Record provenance and sign as a JWT-VC (Ed25519, did:web) — a verifiable CPOE",
        icon: <MarqueIcon size={36} />,
      },
      {
        name: "LOG",
        description:
          "Register in an append-only SCITT transparency log with COSE receipts",
        icon: <ChartIcon size={36} />,
      },
      {
        name: "VERIFY",
        description:
          "Anyone verifies a CPOE using standard JWT libraries and DID:web",
        icon: <QuarterIcon size={36} />,
      },
      {
        name: "DIFF",
        description:
          "Compare CPOEs to detect compliance regressions over time",
        icon: <RaidIcon size={36} />,
      },
    ],
  },
  {
    number: 2,
    label: "Intelligence",
    tagline:
      "8+ tool formats, 7-dimension scoring, evidence search, governance review",
    color: "#7FDBCA",
    glowColor: "rgba(127,219,202,0.15)",
    borderColor: "rgba(127,219,202,0.3)",
    bgTint: "rgba(127,219,202,0.04)",
    stages: [
      {
        name: "NORMALIZE",
        description:
          "Parse 8+ tool formats into a unified evidence schema automatically",
        icon: <MarkIcon size={36} />,
      },
      {
        name: "SCORE",
        description:
          "7-dimension evidence quality assessment — like FICO for compliance",
        icon: <PlunderIcon size={36} />,
      },
      {
        name: "QUERY",
        description:
          "Search and filter signed evidence across the transparency log",
        icon: <SpyglassIcon size={36} />,
      },
      {
        name: "QUARTER",
        description:
          "Quartermaster governance review — 5 deterministic + 2 model-assisted dimensions",
        icon: <QuarterIcon size={36} />,
      },
    ],
  },
  {
    number: 3,
    label: "Decision",
    tagline:
      "Multi-agent audit, continuous certification, vendor risk, webhooks",
    color: "#2ECC71",
    glowColor: "rgba(46,204,113,0.15)",
    borderColor: "rgba(46,204,113,0.3)",
    bgTint: "rgba(46,204,113,0.04)",
    stages: [
      {
        name: "AUDIT",
        description:
          "Multi-agent audit workflows — automated evidence collection and review",
        icon: <SpyglassIcon size={36} />,
      },
      {
        name: "CERTIFY",
        description:
          "Continuous certification — re-validate CPOEs on schedule, auto-downgrade on drift",
        icon: <MarqueIcon size={36} />,
      },
      {
        name: "TPRM",
        description:
          "Vendor risk management — ingest, compare, and monitor third-party CPOEs",
        icon: <ChartIcon size={36} />,
      },
      {
        name: "AUTOMATE",
        description:
          "Webhooks and FLAGSHIP signals — trigger actions on compliance changes",
        icon: <ReconIcon size={36} />,
      },
    ],
  },
];

/* ─── Animation variants ─────────────────────────────────── */

const layerContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.2 },
  },
};

const layerVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const stageContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const stageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

/* ─── Connector between layers ───────────────────────────── */

function LayerConnector({ fromColor, toColor }: { fromColor: string; toColor: string }) {
  return (
    <div className="flex flex-col items-center py-3">
      <div
        className="h-6 w-px"
        style={{
          background: `linear-gradient(to bottom, ${fromColor}, ${toColor})`,
          opacity: 0.5,
        }}
      />
      <div
        className="font-pixel text-[7px] tracking-wider"
        style={{ color: toColor, opacity: 0.6 }}
      >
        FEEDS INTO
      </div>
      <div
        className="h-3 w-px"
        style={{
          background: toColor,
          opacity: 0.3,
        }}
      />
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export function PipelineStages() {
  return (
    <motion.div
      className="flex flex-col"
      variants={layerContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      {layers.map((layer, layerIndex) => (
        <div key={layer.label}>
          {/* Connector between layers */}
          {layerIndex > 0 && (
            <LayerConnector
              fromColor={layers[layerIndex - 1].color}
              toColor={layer.color}
            />
          )}

          {/* Layer card */}
          <motion.div variants={layerVariants}>
            <div
              className="rounded-xl border p-5 sm:p-6"
              style={{
                borderColor: layer.borderColor,
                backgroundColor: layer.bgTint,
              }}
            >
              {/* Layer header */}
              <div className="mb-5 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Badge
                  variant="outline"
                  className="shrink-0 border-transparent font-pixel text-[8px] tracking-widest"
                  style={{ color: layer.color }}
                >
                  L{layer.number}
                </Badge>
                <span
                  className="font-display text-sm font-semibold tracking-wide sm:text-base"
                  style={{ color: layer.color }}
                >
                  {layer.label}
                </span>
                <span className="hidden text-xs text-corsair-text-dim sm:inline">
                  {layer.tagline}
                </span>
              </div>

              {/* Tagline on mobile (hidden on desktop where it's inline) */}
              <p className="mb-4 text-center text-xs text-corsair-text-dim sm:hidden">
                {layer.tagline}
              </p>

              {/* Stage cards */}
              <motion.div
                className={`grid gap-4 ${
                  layer.stages.length === 5
                    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                    : layer.stages.length === 4
                      ? "grid-cols-2 sm:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-3"
                }`}
                variants={stageContainerVariants}
              >
                {layer.stages.map((stage, stageIndex) => (
                  <motion.div
                    key={stage.name}
                    variants={stageVariants}
                    className="group flex flex-col items-center text-center"
                  >
                    <Card
                      className="pixel-card-hover mb-2 flex h-16 w-16 items-center justify-center bg-corsair-surface transition-all"
                      style={
                        {
                          "--glow-color": layer.glowColor,
                        } as React.CSSProperties
                      }
                    >
                      <CardContent className="p-0">{stage.icon}</CardContent>
                    </Card>

                    <Badge
                      variant="outline"
                      className="mb-1 border-transparent font-pixel text-[8px] tracking-wider"
                      style={{ color: layer.color }}
                    >
                      {stage.name}
                    </Badge>

                    <span className="text-xs leading-snug text-corsair-text-dim">
                      {stage.description}
                    </span>

                    {/* Arrow connector between stages (desktop, not last) */}
                    {stageIndex < layer.stages.length - 1 && (
                      <span
                        className="mt-1 hidden font-pixel text-[7px] sm:block"
                        style={{ color: layer.borderColor }}
                      >
                        &gt;
                      </span>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      ))}
    </motion.div>
  );
}
