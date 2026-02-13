import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import {
  MarqueIcon,
  ReconIcon,
  ChartIcon,
  QuarterIcon,
  SpyglassIcon,
  PlunderIcon,
  MarkIcon,
} from "@/components/pixel-art/pixel-icons";
import { StageHeader } from "@/components/features/anatomy/stage-header";
import {
  ProtocolComposition,
  JWTVCStructure,
  DIDResolutionFlow,
} from "@/components/features/protocol/trust-stack";
import { MerkleViz } from "@/components/features/protocol/merkle-viz";
import { SignalTimeline } from "@/components/features/protocol/signal-timeline";

export const metadata: Metadata = {
  title: "The Parley Protocol — Cryptographic Trust Stack",
  description:
    "Deep dive into the Parley protocol: Ed25519 signing, DID:web identity, 7-dimension assurance model, SCITT transparency logs, and real-time FLAGSHIP signals. Every cryptographic decision explained.",
};

export default function ProtocolPage() {
  return (
    <main className="pb-20">
      {/* ═══ HERO ═══ */}
      <section className="relative flex min-h-[50dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        {/* Subtle gold glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.02] blur-[120px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            THE CRYPTOGRAPHIC TRUST STACK
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            protocol
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Five open standards. Zero vendor lock-in.
            Every decision traceable, every proof verifiable.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {["JWT-VC", "DID:web", "Ed25519", "SCITT", "SSF/CAEP"].map(
              (std) => (
                <span
                  key={std}
                  className="rounded-md border border-corsair-border bg-corsair-surface px-3 py-1.5 font-mono text-xs text-corsair-gold"
                >
                  {std}
                </span>
              )
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.5}>
          <p className="mt-6 max-w-lg text-center text-xs text-corsair-text-dim">
            Parley composes open standards so any JWT library can verify a CPOE.
            This page explains every layer — from key generation to real-time signals.
          </p>
        </FadeIn>
      </section>

      {/* ═══ PRIMITIVES → CRYPTO LAYERS ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="mb-10 text-center">
              <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
                FIVE PRIMITIVES
              </p>
              <h2 className="mb-4 font-display text-3xl font-bold text-corsair-text">
                What you do &rarr; how we built it
              </h2>
              <p className="mx-auto max-w-2xl text-sm text-corsair-text-dim">
                Corsair exposes five user-facing primitives. Each maps to one or more
                open cryptographic standards underneath. This page explains every layer.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-6">
              <div className="space-y-3 font-mono text-xs">
                {[
                  { primitive: "Sign", crypto: "JWT-VC + Ed25519", color: "text-corsair-gold" },
                  { primitive: "Verify", crypto: "DID:web resolution + signature check", color: "text-corsair-green" },
                  { primitive: "Diff", crypto: "Compare two JWT-VC payloads", color: "text-corsair-turquoise" },
                  { primitive: "Log", crypto: "SCITT transparency log + Merkle proofs", color: "text-corsair-cyan" },
                  { primitive: "Signal", crypto: "FLAGSHIP / SSF/CAEP event streams", color: "text-corsair-crimson" },
                ].map((item) => (
                  <div key={item.primitive} className="flex items-center gap-3">
                    <span className={`w-16 shrink-0 font-bold ${item.color}`}>
                      {item.primitive}
                    </span>
                    <span className="text-corsair-border">&rarr;</span>
                    <span className="text-corsair-text">
                      {item.crypto}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ LAYER 1: PROTOCOL COMPOSITION ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={1}
            name="COMPOSITION"
            subtitle="Five standards, one protocol"
            color="text-corsair-gold"
            icon={<ChartIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Parley doesn&apos;t invent new cryptography. It composes five open standards
              into a trust exchange protocol. Each standard handles one concern —
              identity, attestation, logging, signaling, and signatures.
            </p>
          </FadeIn>

          <ProtocolComposition />
        </div>
      </section>

      {/* ═══ LAYER 2: IDENTITY — DID:web ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={2}
            name="IDENTITY"
            subtitle="DID:web — DNS is your identity provider"
            color="text-corsair-turquoise"
            icon={<ReconIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Organizations are identified via <code className="text-corsair-turquoise">did:web</code> DIDs —
              decentralized identifiers that map to HTTPS domains you already control.
              No blockchain, no registry, no vendor. Just DNS + a JSON file.
            </p>
          </FadeIn>

          <DIDResolutionFlow />
        </div>
      </section>

      {/* ═══ LAYER 3: PROOF — JWT-VC + Ed25519 ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={3}
            name="PROOF"
            subtitle="JWT-VC signed with Ed25519 — the CPOE"
            color="text-corsair-gold"
            icon={<MarqueIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              A CPOE is a W3C Verifiable Credential encoded as a JWT, signed with Ed25519.
              Three segments — header, payload, signature — carrying compliance claims
              that anyone can verify with standard libraries. No Corsair account needed.
            </p>
          </FadeIn>

          <JWTVCStructure />
        </div>
      </section>

      {/* ═══ LAYER 4: PROVENANCE — Who produced the evidence ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={4}
            name="PROVENANCE"
            subtitle="Who produced the evidence, recorded in the credential"
            color="text-corsair-gold"
            icon={<QuarterIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-2 max-w-2xl text-sm text-corsair-text-dim">
              Every CPOE records provenance — who produced the evidence, what tool
              generated it, and when. Corsair does not judge evidence quality. It
              records where the evidence came from, signs it, and lets buyers decide
              what&apos;s sufficient. The provenance model is simple:
            </p>
            <p className="mb-8 max-w-2xl text-xs text-corsair-text-dim/60 italic">
              Assurance scoring (L0-L4) is available as optional enrichment via the
              --enrich flag, but it is not part of the default signing path.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="space-y-3">
              {[
                { source: "self", desc: "Organization self-attests compliance without automated evidence", color: "text-corsair-text-dim", bgColor: "bg-corsair-text-dim/10" },
                { source: "tool", desc: "Security tool (Prowler, InSpec, Trivy) generated the evidence automatically", color: "text-corsair-green", bgColor: "bg-corsair-green/10" },
                { source: "auditor", desc: "Independent third party reviewed and verified the assessment", color: "text-corsair-gold", bgColor: "bg-corsair-gold/10" },
              ].map((item) => (
                <div key={item.source} className="flex items-start gap-4 rounded-lg border border-corsair-border bg-[#0A0A0A] p-4">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded font-mono text-xs font-bold ${item.bgColor} ${item.color}`}>
                    {item.source.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${item.color}`}>{item.source}</p>
                    <p className="text-xs text-corsair-text-dim">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ LAYER 5: TRANSPARENCY — SCITT + Merkle ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={5}
            name="TRANSPARENCY"
            subtitle="SCITT log — append-only, Merkle-proven, tamper-evident"
            color="text-corsair-turquoise"
            icon={<SpyglassIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Once a CPOE is issued, it&apos;s registered in an IETF SCITT transparency log.
              The log is append-only — entries cannot be modified or silently removed.
              Each registration produces a COSE receipt containing a Merkle inclusion proof:
              cryptographic evidence that this specific CPOE exists in the log.
            </p>
          </FadeIn>

          <MerkleViz />
        </div>
      </section>

      {/* ═══ LAYER 6: SIGNALS — FLAGSHIP / SSF / CAEP ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={6}
            name="SIGNAL"
            subtitle="FLAGSHIP — real-time compliance notifications"
            color="text-corsair-crimson"
            icon={<PlunderIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Compliance isn&apos;t annual — it&apos;s continuous. FLAGSHIP implements
              the OpenID Shared Signals Framework (SSF) with CAEP event types
              to notify subscribers of compliance state changes in real time.
              Every signal is a signed Security Event Token (SET) — Ed25519, same
              as the CPOE itself.
            </p>
          </FadeIn>

          <SignalTimeline />
        </div>
      </section>

      {/* ═══ LAYER 7: PROVENANCE — in-toto/SLSA Receipt Chain ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={7}
            name="PROVENANCE"
            subtitle="Advanced — in-toto/SLSA pipeline receipts"
            color="text-corsair-green"
            icon={<MarkIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-2 max-w-2xl text-sm text-corsair-text-dim">
              For advanced use cases, CPOEs can embed a process provenance chain — COSE-signed
              receipts for each pipeline step (classify, chart, quarter, sign). Each receipt
              captures input/output hashes and links to the previous receipt, forming a
              tamper-evident chain. The chain digest is embedded in the signed credential,
              proving not just what the CPOE says, but how it was built.
            </p>
            <p className="mb-6 max-w-2xl text-xs text-corsair-text-dim/60 italic">
              Process provenance is optional. The five core protocol layers above are sufficient
              for most verification workflows.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-6">
              <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-green/60">
                RECEIPT CHAIN STRUCTURE
              </p>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-20 text-corsair-text-dim">Format</span>
                  <span className="text-corsair-green">in-toto/v1 + COSE_Sign1</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-20 text-corsair-text-dim">Steps</span>
                  <span className="text-corsair-text">classify → chart → quarter → sign</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-20 text-corsair-text-dim">Linking</span>
                  <span className="text-corsair-text">Each receipt includes previous receipt digest (hash chain)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-20 text-corsair-text-dim">Signing</span>
                  <span className="text-corsair-text">Ed25519 via COSE_Sign1 (RFC 9052) — same key as CPOE</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-20 text-corsair-text-dim">Digest</span>
                  <span className="text-corsair-gold">Merkle root of all receipt hashes → embedded in CPOE</span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              SEE IT IN ACTION
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold text-corsair-text">
              From theory to proof
            </h2>
            <p className="mb-8 text-corsair-text-dim">
              See how security tool output becomes a signed, verifiable CPOE — or
              paste one yourself and check the signature.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/anatomy"
                className="inline-flex h-10 items-center rounded-md bg-corsair-gold px-6 font-display text-sm font-semibold text-corsair-deep transition-colors hover:bg-corsair-gold/90"
              >
                See the Anatomy
              </a>
              <a
                href="/marque"
                className="inline-flex h-10 items-center rounded-md border border-corsair-gold/30 px-6 font-display text-sm font-semibold text-corsair-text-dim transition-colors hover:border-corsair-gold hover:text-corsair-gold"
              >
                Verify a CPOE &rarr;
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
