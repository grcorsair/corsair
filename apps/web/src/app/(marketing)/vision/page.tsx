import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import {
  SpyglassIcon,
  ChartIcon,
  ReconIcon,
  MarqueIcon,
  QuarterIcon,
  MarkIcon,
} from "@/components/pixel-art/pixel-icons";
import { StageHeader } from "@/components/features/anatomy/stage-header";

export const metadata: Metadata = {
  title: "Vision — Why Compliance Trust Needs an Open Protocol",
  description:
    "Parley is an open protocol for machine-readable, cryptographically verifiable compliance attestations. The SMTP of compliance trust — not another dashboard.",
  openGraph: {
    title: "Vision — The Parley Protocol",
    description:
      "Why compliance trust needs an open protocol. Machine-readable. Cryptographically signed. Verifiable by anyone.",
  },
};

export default function VisionPage() {
  return (
    <main className="pb-20">
      {/* ═══ HERO ═══ */}
      <section className="relative flex min-h-[50dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.02] blur-[120px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            THE PARLEY PROTOCOL
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            vision
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Compliance trust is broken. Not because the tools are bad —
            <br className="hidden sm:inline" />
            <span className="text-corsair-gold">
              {" "}
              because the format is missing.
            </span>
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <p className="mt-6 max-w-lg text-center text-xs text-corsair-text-dim">
            Parley is an open protocol for machine-readable, cryptographically
            verifiable compliance attestations. This is why it matters.
          </p>
        </FadeIn>
      </section>

      {/* ═══ 01: THE PROBLEM ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={1}
            name="THE PROBLEM"
            subtitle="$8.57 billion in trust, exchanged via email attachment"
            color="text-corsair-crimson"
            icon={<SpyglassIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                Every quarter, tens of thousands of organizations email
                compliance reports to each other. SOC 2 Type IIs. ISO 27001
                certificates. Pentest summaries. PDF attachments, stored in
                shared drives, re-requested when someone leaves or a link
                expires.
              </p>
              <p>
                These documents are{" "}
                <span className="text-corsair-crimson">
                  machine-unreadable
                </span>
                ,{" "}
                <span className="text-corsair-crimson">
                  cryptographically unverifiable
                </span>
                , and{" "}
                <span className="text-corsair-crimson">
                  impossible to validate
                </span>{" "}
                without trusting the sender. The entire third-party risk
                management market — $8.57 billion — runs on faith. Not
                cryptography. Not verification. Faith.
              </p>
              <p>
                The tools aren&apos;t the problem. Vanta, Drata, Secureframe —
                they manage compliance within organizations. The problem is what
                happens when compliance evidence moves{" "}
                <em>between</em> organizations. There is no standard format. No
                verification protocol. No way to check without trusting.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ 02: THE THESIS ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={2}
            name="THE THESIS"
            subtitle="What if compliance worked like HTTPS?"
            color="text-corsair-gold"
            icon={<ChartIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                Every website you visit is cryptographically authenticated.
                Your browser checks the certificate, verifies the signature,
                confirms the identity — automatically, instantly, for free. No
                one emails SSL certificates as PDF attachments. The protocol
                handles it.
              </p>
              <p>
                Compliance has no equivalent. No standard format for
                attestations. No signature to check. No resolution protocol for
                issuer identity. Every exchange is manual, bespoke, and
                trust-based.
              </p>
              <p className="text-corsair-text">
                Parley is that missing protocol. An open standard for compliance
                attestations that are{" "}
                <span className="text-corsair-gold">machine-readable</span>,{" "}
                <span className="text-corsair-gold">
                  cryptographically signed
                </span>
                , and{" "}
                <span className="text-corsair-gold">
                  verifiable by anyone
                </span>{" "}
                with standard libraries. No vendor account. No proprietary
                platform. Four steps with any JWT library.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 rounded-xl border border-corsair-border bg-[#0A0A0A] p-6">
              <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
                THE ANALOGY
              </p>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-28 shrink-0 text-corsair-text-dim">
                    Vanta / Drata
                  </span>
                  <span className="text-corsair-text">
                    Salesforce — manages compliance{" "}
                    <span className="text-corsair-text-dim">within</span> an
                    organization
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-28 shrink-0 text-corsair-gold">
                    Parley
                  </span>
                  <span className="text-corsair-gold">
                    SMTP — moves trust{" "}
                    <span className="text-corsair-text-dim">between</span>{" "}
                    organizations
                  </span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ 03: THE PARALLEL ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={3}
            name="THE PARALLEL"
            subtitle="MCP standardized AI tooling. Parley standardizes compliance trust."
            color="text-corsair-turquoise"
            icon={<ReconIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                Before MCP, every AI application built custom integrations to
                every tool. Slack had one connector, GitHub had another,
                databases had a third. Each was proprietary, incompatible, and
                fragile. MCP replaced that chaos with an open protocol — and the
                entire AI tooling ecosystem accelerated.
              </p>
              <p>
                Compliance trust is in the same state. Every platform — Whistic,
                SafeBase, Conveyor — moves compliance documents through
                proprietary channels. None of them can verify each other&apos;s
                attestations. None produce a format that&apos;s portable across
                platforms.
              </p>
              <p>
                Parley sits underneath all of them. It doesn&apos;t compete with
                compliance platforms — it{" "}
                <span className="text-corsair-turquoise">
                  makes every platform interoperable
                </span>
                . Any platform that produces a CPOE generates a verifiable
                credential. Any platform that consumes a CPOE can check the
                signature. No bilateral integration. No vendor lock-in. The
                protocol handles it.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
                <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-turquoise/60">
                  MCP
                </p>
                <p className="text-sm text-corsair-text-dim">
                  Open protocol for AI &harr; tools.{" "}
                  <span className="text-corsair-turquoise">
                    Any client connects to any server.
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-corsair-gold/20 bg-[#0A0A0A] p-5">
                <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
                  PARLEY
                </p>
                <p className="text-sm text-corsair-text-dim">
                  Open protocol for org &harr; org trust.{" "}
                  <span className="text-corsair-gold">
                    Any verifier checks any CPOE.
                  </span>
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ 04: THE PROOF ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={4}
            name="THE PROOF"
            subtitle="CPOE — a verifiable credential, not a document"
            color="text-corsair-gold"
            icon={<MarqueIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                A CPOE (Certificate of Proof of Operational Effectiveness) is a{" "}
                <a
                  href="https://www.w3.org/TR/vc-data-model-2.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-corsair-gold underline decoration-corsair-gold/30 hover:decoration-corsair-gold"
                >
                  W3C Verifiable Credential
                </a>{" "}
                signed with Ed25519. It wraps compliance evidence — controls
                tested, controls passed, assurance level, issuer identity — in a
                JWT that anyone can verify.
              </p>
              <p>
                The name is intentional. Pieces of Eight — the original CPOE —
                were universally verifiable. Cut them, weigh them, bite them.
                Anyone could check. No authority needed. A CPOE works the same
                way: decode, resolve, extract, verify. Four steps with any JWT
                library on Earth.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 rounded-xl border border-corsair-border bg-[#0A0A0A] p-6">
              <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
                VERIFICATION FLOW
              </p>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-corsair-gold/10 text-corsair-gold">
                    1
                  </span>
                  <span className="w-16 text-corsair-text-dim">Decode</span>
                  <span className="text-corsair-text">
                    Parse JWT header + payload (base64url, no crypto yet)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-corsair-gold/10 text-corsair-gold">
                    2
                  </span>
                  <span className="w-16 text-corsair-text-dim">Resolve</span>
                  <span className="text-corsair-text">
                    Fetch issuer&apos;s DID document via HTTPS
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-corsair-gold/10 text-corsair-gold">
                    3
                  </span>
                  <span className="w-16 text-corsair-text-dim">Extract</span>
                  <span className="text-corsair-text">
                    Find the public key matching header.kid
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-corsair-gold/10 text-corsair-gold">
                    4
                  </span>
                  <span className="w-16 text-corsair-text-dim">Verify</span>
                  <span className="text-corsair-gold">
                    Check Ed25519 signature over the JWT payload
                  </span>
                </div>
              </div>
              <p className="mt-4 text-xs text-corsair-text-dim/60">
                No Corsair account needed. No API key. No vendor dependency.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ 05: THE LADDER ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={5}
            name="THE LADDER"
            subtitle="Five levels of assurance — FICO for compliance"
            color="text-corsair-green"
            icon={<QuarterIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                Not all compliance evidence is equal. A policy PDF is not the
                same as a pentest result. A config scan is not the same as
                continuous monitoring. The assurance ladder makes this explicit —
                five levels, from self-declared to independently attested.
              </p>
              <p>
                The CPOE&apos;s declared level is the{" "}
                <span className="text-corsair-green">minimum</span> across all
                in-scope controls. Like an SSL certificate where one unverified
                domain means rejection. You cannot claim L2 if any control has
                only policy evidence.
              </p>
              <p>
                This is{" "}
                <span className="text-corsair-green">FICO for compliance</span>
                . A standardized score — L0 through L4 — consumed by every
                platform, every CRQ model, every procurement workflow. The same
                way FICO (300-850) is consumed by every lender, regardless of
                their internal risk models.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 space-y-2">
              {assuranceLevels.map((level) => (
                <div
                  key={level.level}
                  className="flex items-start gap-4 rounded-lg border border-corsair-border bg-[#0A0A0A] p-4"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded font-mono text-sm font-bold ${level.badgeClass}`}
                  >
                    {level.level}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-corsair-text">
                      {level.name}
                    </p>
                    <p className="text-xs text-corsair-text-dim">
                      {level.description}
                    </p>
                  </div>
                  <span className="ml-auto hidden text-xs text-corsair-text-dim/60 sm:block">
                    {level.analogy}
                  </span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ 06: THE FUTURE ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={6}
            name="THE FUTURE"
            subtitle="Agents need proofs, not judgment"
            color="text-corsair-turquoise"
            icon={<MarkIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                Today, a human reads a SOC 2 report and decides whether to trust
                a vendor. Tomorrow, a procurement agent will need to make the
                same decision — programmatically, at scale, in milliseconds.
              </p>
              <p>
                That agent cannot read a PDF. It cannot evaluate trust on a
                phone call. It needs a{" "}
                <span className="text-corsair-turquoise">
                  machine-readable, cryptographically signed proof
                </span>{" "}
                that it can verify without human intervention. It needs a CPOE.
              </p>
              <p>
                This is why the format matters more than the tool. Intelligence
                commoditizes — anyone with an LLM can analyze a SOC 2 report.
                Infrastructure compounds — signing keys, transparency logs,
                verification networks, signal history. The protocol that carries
                compliance trust between organizations and between agents is the
                layer that endures.
              </p>
              <p>
                The same CPOE format that a human verifies on a web page today
                is the same format an agent verifies via API tomorrow. Same
                Ed25519 signature. Same DID resolution. Same SCITT log. Same
                FLAGSHIP signals. The consumer changes. The proof does not.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ INVITATION ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              OPEN PROTOCOL
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold text-corsair-text">
              Build on Parley
            </h2>
            <p className="mb-8 text-corsair-text-dim">
              The CPOE specification is{" "}
              <span className="text-corsair-gold">CC BY 4.0</span>. The
              reference implementation is{" "}
              <span className="text-corsair-gold">Apache 2.0</span>.
              Verification is free, forever. Anyone can issue, anyone can
              verify, anyone can build.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/marque"
                className="inline-flex h-10 items-center rounded-md bg-corsair-gold px-6 font-display text-sm font-semibold text-corsair-deep transition-colors hover:bg-corsair-gold/90"
              >
                Verify a CPOE
              </a>
              <a
                href="/protocol"
                className="inline-flex h-10 items-center rounded-md border border-corsair-gold/30 px-6 font-display text-sm font-semibold text-corsair-text-dim transition-colors hover:border-corsair-gold hover:text-corsair-gold"
              >
                Read the Protocol &rarr;
              </a>
              <a
                href="https://github.com/Arudjreis/corsair/blob/main/CPOE_SPEC.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-md border border-corsair-border px-6 font-display text-sm font-semibold text-corsair-text-dim transition-colors hover:border-corsair-gold hover:text-corsair-gold"
              >
                CPOE Spec
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}

/* ─── data ─── */

const assuranceLevels = [
  {
    level: "L0",
    name: "Documented",
    description: "Policy says so. No config evidence. No test results.",
    analogy: "Self-signed cert",
    badgeClass: "bg-corsair-text-dim/10 text-corsair-text-dim",
  },
  {
    level: "L1",
    name: "Configured",
    description:
      "Settings confirm it's on. Config exports, tool scans, SecurityHub.",
    analogy: "Domain-validated (DV)",
    badgeClass: "bg-corsair-gold/10 text-corsair-gold",
  },
  {
    level: "L2",
    name: "Demonstrated",
    description:
      "Test results prove it works. Pentest findings, adversarial testing.",
    analogy: "Org-validated (OV)",
    badgeClass: "bg-corsair-gold/10 text-corsair-gold",
  },
  {
    level: "L3",
    name: "Observed",
    description:
      "Continuous monitoring confirms effectiveness. Real-time signals active.",
    analogy: "Extended validation (EV)",
    badgeClass: "bg-corsair-green/10 text-corsair-green",
  },
  {
    level: "L4",
    name: "Attested",
    description:
      "Independent third party verified and co-signed the credential.",
    analogy: "EV + audit letter",
    badgeClass: "bg-corsair-green/10 text-corsair-green",
  },
];
