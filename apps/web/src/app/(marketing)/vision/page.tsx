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
                Your security tools already have the evidence. Prowler scans
                your cloud. InSpec profiles check your configs. Trivy finds
                your vulnerabilities. Wiz maps your attack surface. Every tool
                produces structured, machine-readable output — and none of it
                is cryptographically verifiable. The evidence exists. The proof
                format does not.
              </p>
              <p>
                These outputs are{" "}
                <span className="text-corsair-crimson">
                  siloed by vendor
                </span>
                ,{" "}
                <span className="text-corsair-crimson">
                  cryptographically unsigned
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
                The tools aren&apos;t the problem. Vanta has data. SafeBase has
                data. Drata has data. None of it is interoperable. Trust Centers
                store compliance evidence but can&apos;t share it across
                platforms because{" "}
                <span className="text-corsair-crimson">
                  the format is missing
                </span>
                . There is no standard proof format. No verification protocol.
                No way to check — regardless of which tool produced the evidence
                or which platform holds it.
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
            subtitle="What if compliance worked like git?"
            color="text-corsair-gold"
            icon={<ChartIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                Every line of code you write is tracked. Git records who changed
                what, when, and why. You can diff any two commits. You can verify
                the history. The entire software industry runs on this model —
                not because developers asked for it, but because the alternative
                (emailing tarballs) was insane.
              </p>
              <p>
                Compliance is still emailing tarballs. No standard format for
                attestations. No signature to check. No way to diff two
                assessments. No history you can verify. Every exchange is manual,
                bespoke, and trust-based.
              </p>
              <p className="text-corsair-text">
                Parley is git for compliance. Five primitives:{" "}
                <span className="text-corsair-gold">Sign</span> evidence like a commit.{" "}
                <span className="text-corsair-green">Verify</span> any CPOE with standard JWT libraries.{" "}
                <span className="text-corsair-turquoise">Diff</span> two CPOEs like two commits.{" "}
                <span className="text-corsair-cyan">Log</span> every attestation in an
                append-only SCITT transparency log.{" "}
                <span className="text-corsair-crimson">Signal</span> compliance changes
                in real time via FLAGSHIP.
                No vendor account. No proprietary platform.
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
                    GitHub — manages compliance{" "}
                    <span className="text-corsair-text-dim">within</span> an
                    organization
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-28 shrink-0 text-corsair-gold">
                    Parley
                  </span>
                  <span className="text-corsair-gold">
                    Git — tracks, signs, and diffs trust{" "}
                    <span className="text-corsair-text-dim">between</span>{" "}
                    organizations
                  </span>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-4 rounded-xl border border-corsair-gold/20 bg-[#0A0A0A] p-6">
              <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
                EVIDENCE AGNOSTIC — ANY INPUT, SAME PROOF
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {evidenceSources.map((source) => (
                  <div key={source.label} className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-corsair-gold">&rarr;</span>
                    <span className="text-corsair-text-dim">{source.label}</span>
                    <span className="text-corsair-text">{source.example}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-corsair-gold">
                All roads lead to the same CPOE. Same Ed25519 signature. Same
                verification flow. The provenance records where evidence came
                from — not the format.
              </p>
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
                Parley sits underneath all of them. Just as MCP gave every AI
                tool a common interface, Parley gives every compliance tool a
                common proof format. It doesn&apos;t compete with
                compliance platforms — it{" "}
                <span className="text-corsair-turquoise">
                  makes every platform interoperable
                </span>
                . Any tool that produces a CPOE generates a verifiable
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
                signed with Ed25519. It doesn&apos;t care where the evidence
                came from — a Prowler scan, an InSpec profile, a Trivy report,
                a Wiz export, or an agent&apos;s tool-call trace. The CPOE
                wraps the{" "}
                <span className="text-corsair-gold">
                  assessment result
                </span>{" "}
                — controls tested, controls passed, provenance, issuer
                identity — in a JWT that anyone can verify.
              </p>
              <p>
                The name is intentional. Pieces of Eight — the original CPOE —
                were universally verifiable. Cut them, weigh them, bite them.
                Anyone could check. No authority needed. A CPOE works the same
                way: decode, resolve, extract, verify. Four steps with any JWT
                library on Earth. The evidence type changes. The proof format
                does not.
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
            name="THE MODEL"
            subtitle="Five primitives — sign, verify, diff, log, signal"
            color="text-corsair-green"
            icon={<QuarterIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                Not all compliance evidence is equal. A policy PDF is not the
                same as a Prowler scan. A self-assessment is not the same as a
                third-party audit. Corsair addresses this with five protocol
                primitives:{" "}
                <span className="text-corsair-gold">Sign</span> evidence as
                Ed25519 verifiable credentials.{" "}
                <span className="text-corsair-green">Verify</span> any CPOE
                with standard JWT libraries.{" "}
                <span className="text-corsair-turquoise">Diff</span> two
                CPOEs to detect regressions.{" "}
                <span className="text-corsair-cyan">Log</span> every
                attestation in an append-only SCITT transparency log.{" "}
                <span className="text-corsair-crimson">Signal</span> compliance
                changes in real time via FLAGSHIP.
              </p>
              <p>
                Three provenance types — self, tool, auditor — give buyers the
                information they need to set their own thresholds. An enterprise
                might require tool-generated evidence for all vendors. A startup
                might accept self-assessed for low-risk suppliers. The CPOE
                carries the facts. The buyer — or their agent — makes the
                decision.
              </p>
              <p>
                Advanced features build on top of the primitives. Evidence quality
                scoring adds a FICO-like confidence score. Continuous certification
                automates re-validation. TPRM automation replaces security
                questionnaires. Every feature composes the same five primitives.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 space-y-2">
              {provenanceTypes.map((level) => (
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
            name="THE PRESENT AND BEYOND"
            subtitle="Scoring and certification are shipped. Agent-native trust is next."
            color="text-corsair-turquoise"
            icon={<MarkIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-4 text-sm text-corsair-text-dim">
              <p>
                The protocol is not a roadmap — it is{" "}
                <span className="text-corsair-turquoise">shipped</span>.
                Five primitives sign and verify compliance evidence with Ed25519,
                log it in SCITT transparency logs, diff for regressions, and
                signal changes in real time. Advanced features normalize evidence
                from 8+ formats, score quality across 7 dimensions, orchestrate
                audits, and automate TPRM decisions. Everything is live, tested,
                and in production.
              </p>
              <p>
                What comes next is agent-native trust exchange. A procurement
                agent cannot read a PDF. It cannot evaluate trust on a phone
                call. It needs a{" "}
                <span className="text-corsair-turquoise">
                  machine-readable, cryptographically signed proof
                </span>{" "}
                that it can verify without human intervention. It needs a CPOE —
                with a quality score and provenance metadata that its policy
                engine can evaluate automatically.
              </p>
              <p>
                This is why the format matters more than the tool. Intelligence
                commoditizes — anyone with an LLM can analyze a compliance
                report. Infrastructure compounds — signing keys, transparency
                logs, verification networks, quality scores, signal history. The
                protocol that carries compliance trust between organizations and
                between agents is the layer that endures.
              </p>
              <p>
                The verification network is already being seeded by
                tool-generated CPOEs. The same CPOE format that wraps a Prowler
                scan today wraps Wiz telemetry tomorrow and agent-witnessed
                control tests next year. The five primitives carry forward
                unchanged — sign, verify, diff, log, signal. The evidence
                evolves. The protocol does not.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FROM GRC ENGINEERING ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={7}
            name="FROM GRC ENGINEERING"
            subtitle="Deep dives on the ideas behind Corsair"
            color="text-corsair-gold"
            icon={<QuarterIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <div className="max-w-2xl space-y-2 text-sm text-corsair-text-dim">
              <p>
                Corsair was built by{" "}
                <a
                  href="https://grcengineer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-corsair-gold underline decoration-corsair-gold/30 hover:decoration-corsair-gold"
                >
                  Ayoub Fandi
                </a>
                , the creator of{" "}
                <a
                  href="https://grcengineer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-corsair-gold underline decoration-corsair-gold/30 hover:decoration-corsair-gold"
                >
                  GRC Engineer
                </a>
                {" "}&mdash; a practice focused on treating compliance as an
                engineering discipline, not a checkbox exercise. These articles
                explore the thinking behind the protocol:
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {grcArticles.map((article) => (
                <a
                  key={article.href}
                  href={article.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-corsair-border bg-[#0A0A0A] p-5 transition-all hover:border-corsair-gold/30"
                >
                  <p className="mb-1 font-pixel text-[7px] tracking-wider text-corsair-gold/40">
                    {article.tag}
                  </p>
                  <p className="text-sm font-medium text-corsair-text group-hover:text-corsair-gold">
                    {article.title}
                  </p>
                  <p className="mt-1 text-xs text-corsair-text-dim">
                    {article.description}
                  </p>
                </a>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-6 text-center">
              <a
                href="https://grcengineer.com/subscribe"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-corsair-gold transition-colors hover:text-corsair-gold/80"
              >
                Subscribe to the GRC Engineer newsletter &rarr;
              </a>
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

const evidenceSources = [
  { label: "Security scanners", example: "Prowler, SecurityHub, Wiz JSON" },
  { label: "Compliance tools", example: "InSpec profiles, ComplianceAsCode" },
  { label: "Vulnerability scans", example: "Trivy, Snyk, Grype reports" },
  { label: "Config exports", example: "Terraform state, CloudFormation" },
  { label: "Telemetry", example: "CrowdStrike, Datadog, SIEM feeds" },
  { label: "Agent traces", example: "MCP tool calls, agentic workflows" },
];

const grcArticles = [
  {
    title: "Compliance as Cope: How GRC Engineering Automated the Wrong Thing",
    description:
      "Why most GRC automation doesn't reduce risk — it just documents the status quo faster.",
    href: "https://grcengineer.com/p/compliance-as-cope-how-grc-engineering-automated-the-wrong-thing",
    tag: "GRC ENGINEERING",
  },
  {
    title: "The Framework Mapping Trap: When Documentation Precedes Reality",
    description:
      "Framework mappings look great on paper. But what happens when the map doesn't match the territory?",
    href: "https://grcengineer.com/p/the-framework-mapping-trap-when-documentation-precedes-reality",
    tag: "COMPLIANCE",
  },
  {
    title: "Are You Building for Auditors or Attackers?",
    description:
      "The GRC engineering shift — from satisfying auditors to actually reducing risk.",
    href: "https://grcengineer.com/p/are-you-building-for-auditors-or-attackers-the-grc-engineering-shift",
    tag: "GRC ENGINEERING",
  },
  {
    title: "AI Agents as the Next GRC Frontier",
    description:
      "How autonomous agents will reshape compliance — and why the proof layer matters more than the analysis.",
    href: "https://grcengineer.com/p/ai-agents-as-the-next-grc-frontier",
    tag: "AI IN GRC",
  },
];

const provenanceTypes = [
  {
    level: "S",
    name: "Self-Assessed",
    description: "Organization self-attests without automated evidence. Policy-level only.",
    analogy: "Self-signed cert",
    badgeClass: "bg-corsair-text-dim/10 text-corsair-text-dim",
  },
  {
    level: "T",
    name: "Tool-Generated",
    description:
      "Security tool (Prowler, InSpec, Trivy) produced the evidence automatically.",
    analogy: "Domain-validated (DV)",
    badgeClass: "bg-corsair-green/10 text-corsair-green",
  },
  {
    level: "A",
    name: "Auditor-Verified",
    description:
      "Independent third party reviewed and verified the assessment.",
    analogy: "Extended validation (EV)",
    badgeClass: "bg-corsair-gold/10 text-corsair-gold",
  },
];
