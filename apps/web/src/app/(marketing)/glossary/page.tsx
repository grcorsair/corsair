import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export const metadata: Metadata = {
  title: "Glossary — Every Corsair Term in Plain English",
  description:
    "Lost in the acronyms? CPOE, Parley, SCITT, DID:web, JWT-VC, Ed25519, FLAGSHIP — every term explained in one sentence with diagrams showing how they connect.",
  openGraph: {
    title: "Glossary — Every Corsair Term in Plain English",
    description:
      "CPOE, Parley, SCITT, DID:web, JWT-VC — every Corsair term explained with diagrams.",
  },
};

/* ────────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────────── */

interface GlossaryTerm {
  term: string;
  definition: string;
  tag?: string;
  relatesTo?: string[];
}

interface GlossarySection {
  id: string;
  label: string;
  labelColor: string;
  title: string;
  subtitle: string;
  terms: GlossaryTerm[];
}

const sections: GlossarySection[] = [
  {
    id: "corsair",
    label: "CORSAIR",
    labelColor: "text-corsair-gold",
    title: "Corsair Terms",
    subtitle: "The pirate vocabulary. Five concepts that make up the system.",
    terms: [
      {
        term: "CPOE",
        definition:
          'Certificate of Proof of Operational Effectiveness — a signed compliance proof. Think "digitally signed SOC 2 result." Named after Pieces of Eight.',
        tag: "artifact",
        relatesTo: ["JWT-VC", "Ed25519", "MARQUE"],
      },
      {
        term: "Parley",
        definition:
          "The open protocol behind Corsair. Like SMTP is for email, Parley is for compliance proofs. Composes JWT-VC + DID:web + SCITT + SSF/CAEP + in-toto/SLSA.",
        tag: "protocol",
        relatesTo: ["JWT-VC", "DID:web", "SCITT", "SSF/CAEP"],
      },
      {
        term: "MARQUE",
        definition:
          "A signed CPOE — the actual JWT you hand to a verifier. Named after letters of marque, the commissions that authorized privateers.",
        tag: "artifact",
        relatesTo: ["CPOE", "Ed25519", "DID:web"],
      },
      {
        term: "QUARTERMASTER",
        definition:
          "The governance engine that reviews evidence quality. Seven dimensions — source, recency, coverage, reproducibility, consistency, quality, completeness. Five deterministic, two model-assisted.",
        tag: "engine",
        relatesTo: ["Evidence Quality Score", "Normalization"],
      },
      {
        term: "FLAGSHIP",
        definition:
          "Real-time compliance change notifications. If your controls drift, subscribers know immediately. Emits signed SET events over SSF streams.",
        tag: "signal",
        relatesTo: ["SSF/CAEP", "SET (Security Event Token)"],
      },
    ],
  },
  {
    id: "protocol-stack",
    label: "PROTOCOL STACK",
    labelColor: "text-corsair-cyan",
    title: "The Parley Protocol Stack",
    subtitle:
      "Seven open standards composed into one protocol. Each layer builds on the one below.",
    terms: [
      {
        term: "JWT-VC",
        definition:
          "JSON Web Token — Verifiable Credential (W3C standard). The signed envelope that holds a CPOE. Three base64url segments: header.payload.signature. Any JWT library can verify it.",
        tag: "W3C",
        relatesTo: ["Ed25519", "DID:web", "CPOE"],
      },
      {
        term: "DID:web",
        definition:
          'Decentralized Identifier anchored to a domain. did:web:acme.com resolves to https://acme.com/.well-known/did.json — a JSON file containing the public key. DNS-based identity, no blockchain.',
        tag: "W3C",
        relatesTo: ["DID Document", "JWT-VC", "Ed25519"],
      },
      {
        term: "SCITT",
        definition:
          "Supply Chain Integrity, Transparency, and Trust (IETF draft). An append-only transparency log. Once a CPOE is registered, it can never be modified or deleted. Provides Merkle proofs and COSE receipts.",
        tag: "IETF",
        relatesTo: ["COSE Receipt", "Merkle Tree", "Transparency Log"],
      },
      {
        term: "SSF/CAEP",
        definition:
          "Shared Signals Framework / Continuous Access Evaluation Protocol (OpenID). The real-time event system behind FLAGSHIP. Defines how compliance changes are transmitted as signed events between organizations.",
        tag: "OpenID",
        relatesTo: ["FLAGSHIP", "SET (Security Event Token)"],
      },
      {
        term: "SET (Security Event Token)",
        definition:
          "A signed JWT that carries a single security event — like a compliance drift alert or a CPOE revocation. The unit of communication in the SSF/CAEP framework. Each SET is Ed25519-signed.",
        tag: "OpenID",
        relatesTo: ["SSF/CAEP", "FLAGSHIP", "JWT-VC"],
      },
      {
        term: "SD-JWT",
        definition:
          "Selective Disclosure JWT (IETF draft). Prove specific claims without revealing the full document. Undisclosed claims appear as SHA-256 hashes. Share your SOC 2 score without exposing every control detail.",
        tag: "IETF",
        relatesTo: ["JWT-VC", "CPOE", "SHA-256"],
      },
      {
        term: "in-toto / SLSA",
        definition:
          "Supply chain provenance standards (CNCF). Records the full pipeline that produced a CPOE — who ran what tool, when, in what order. Each pipeline step produces a COSE-signed receipt linked into a chain.",
        tag: "CNCF",
        relatesTo: ["Process Provenance", "COSE", "Receipt Chain"],
      },
    ],
  },
  {
    id: "crypto",
    label: "CRYPTOGRAPHY",
    labelColor: "text-corsair-turquoise",
    title: "Cryptographic Primitives",
    subtitle: "The math underneath. Every proof traces back to these.",
    terms: [
      {
        term: "Ed25519",
        definition:
          "An elliptic-curve digital signature algorithm (Curve25519). Fast, compact 64-byte signatures, no weak keys. What Corsair signs every CPOE, every SET, and every SCITT receipt with. Same curve as SSH and Signal.",
        tag: "signature",
        relatesTo: ["JWT-VC", "COSE", "DID:web"],
      },
      {
        term: "COSE",
        definition:
          "CBOR Object Signing and Encryption (IETF RFC 9052). A compact binary signing format — like JWT but smaller. Used in SCITT receipts and process provenance receipts. COSE_Sign1 wraps a single Ed25519 signature.",
        tag: "IETF",
        relatesTo: ["CBOR", "SCITT", "Ed25519"],
      },
      {
        term: "CBOR",
        definition:
          "Concise Binary Object Representation (IETF RFC 8949). A binary data format like JSON but more compact. The serialization layer under COSE. Hand-rolled in Corsair with zero dependencies.",
        tag: "IETF",
        relatesTo: ["COSE", "SCITT"],
      },
      {
        term: "SHA-256",
        definition:
          "A cryptographic hash function that produces a fixed 256-bit digest. Used in evidence hash chains, Merkle trees, SD-JWT claim hashing, and CPOE integrity verification.",
        tag: "hash",
        relatesTo: ["Merkle Tree", "Evidence Hash Chain", "SD-JWT"],
      },
      {
        term: "Merkle Tree",
        definition:
          "A tree of hashes where each parent is the hash of its children. The SCITT log uses a Merkle tree so you can prove any single entry exists without downloading the entire log. Tamper-evident by design.",
        tag: "data structure",
        relatesTo: ["SCITT", "Merkle Proof", "SHA-256"],
      },
      {
        term: "Merkle Proof",
        definition:
          "A cryptographic proof that a specific entry exists in a Merkle tree. Contains the sibling hashes needed to recompute the root. Efficient (log₂ n hashes) and tamper-evident.",
        tag: "proof",
        relatesTo: ["Merkle Tree", "SCITT", "COSE Receipt"],
      },
    ],
  },
  {
    id: "pipeline",
    label: "PIPELINE",
    labelColor: "text-corsair-gold",
    title: "Pipeline Concepts",
    subtitle: "What happens when evidence flows through Corsair.",
    terms: [
      {
        term: "Evidence",
        definition:
          "The raw output from a security tool — JSON findings, scan results, assessment exports. The input to Corsair's sign pipeline. Corsair auto-detects 8+ formats.",
        tag: "input",
        relatesTo: ["Normalization", "Provenance"],
      },
      {
        term: "Provenance",
        definition:
          'The record of where evidence came from. Three sources: "self" (organization self-reports), "tool" (automated scanner), "auditor" (independent third party). Corsair records provenance, buyers decide sufficiency.',
        tag: "metadata",
        relatesTo: ["CPOE", "Process Provenance"],
      },
      {
        term: "Process Provenance",
        definition:
          "The pipeline receipt chain — records every step of the signing pipeline using in-toto/SLSA format. COSE-signed receipts linked by SHA-256 digests. Proves the CPOE wasn't tampered with during processing.",
        tag: "chain",
        relatesTo: ["in-toto / SLSA", "COSE", "Receipt Chain"],
      },
      {
        term: "Receipt Chain",
        definition:
          "A sequence of COSE-signed receipts, each referencing the previous receipt's digest. Forms a tamper-evident audit trail of every pipeline step. The chain digest is embedded in the final CPOE.",
        tag: "chain",
        relatesTo: ["Process Provenance", "COSE", "SHA-256"],
      },
      {
        term: "Normalization",
        definition:
          "Converting 8+ evidence formats into a single canonical structure (CanonicalControlEvidence). Makes Prowler, InSpec, Trivy, and SecurityHub results comparable apples-to-apples.",
        tag: "transform",
        relatesTo: ["Evidence", "Evidence Quality Score"],
      },
      {
        term: "Evidence Quality Score",
        definition:
          "A 0-100 score across seven dimensions: source, recency, coverage, reproducibility, consistency, quality, completeness. The FICO score for compliance data. 5 dimensions are deterministic, 2 are model-assisted.",
        tag: "score",
        relatesTo: ["QUARTERMASTER", "Normalization"],
      },
      {
        term: "Evidence Hash Chain",
        definition:
          "A SHA-256 chain linking each piece of evidence to the previous one. The hash chain root is embedded in the CPOE, proving no evidence was added, removed, or reordered after signing.",
        tag: "integrity",
        relatesTo: ["SHA-256", "CPOE"],
      },
      {
        term: "Transparency Log",
        definition:
          "An append-only registry of signed statements backed by SCITT. Once a CPOE is logged, it can never be modified or deleted. Backed by a Merkle tree for efficient inclusion proofs.",
        tag: "log",
        relatesTo: ["SCITT", "Merkle Tree", "COSE Receipt"],
      },
    ],
  },
  {
    id: "verification",
    label: "VERIFICATION",
    labelColor: "text-corsair-cyan",
    title: "Verification & Trust",
    subtitle: "How proofs are checked and trust is displayed.",
    terms: [
      {
        term: "DID Document",
        definition:
          "A JSON file at /.well-known/did.json containing your organization's Ed25519 public key in JWK format. Anyone who resolves your DID can verify your CPOEs. Like an SSL certificate for compliance.",
        tag: "identity",
        relatesTo: ["DID:web", "Ed25519", "JWT-VC"],
      },
      {
        term: "Key Attestation",
        definition:
          "A certificate chain linking a CPOE signing key back to an organization's root key. Root key → org key attestation → CPOE signing. Proves key authorization without trusting a single key.",
        tag: "trust",
        relatesTo: ["Ed25519", "DID Document"],
      },
      {
        term: "CAA-in-DID",
        definition:
          "Certificate Authority Authorization constraints embedded in DID documents. Limits what scopes each signing key can attest to. Like DNS CAA records but for compliance keys.",
        tag: "policy",
        relatesTo: ["DID Document", "Key Attestation"],
      },
      {
        term: "COSE Receipt",
        definition:
          "A compact binary proof from the SCITT transparency log. Confirms a CPOE was registered at a specific time and includes the Merkle inclusion path. Like a notarized timestamp.",
        tag: "proof",
        relatesTo: ["SCITT", "COSE", "Merkle Proof"],
      },
      {
        term: "Verifiable Presentation (VP)",
        definition:
          "A W3C standard for bundling multiple Verifiable Credentials. Used when a Corsair CPOE and an auditor's attestation are combined into one proof. Each VC carries its own signature.",
        tag: "W3C",
        relatesTo: ["JWT-VC", "CPOE"],
      },
      {
        term: "Corsair Verified",
        definition:
          "The highest trust display tier. The CPOE was signed by did:web:grcorsair.com and the Ed25519 signature is valid. Green shield on the verify page.",
        tag: "trust tier",
        relatesTo: ["DID:web", "Ed25519"],
      },
      {
        term: "Self-Signed Valid",
        definition:
          "A CPOE signed by an organization's own key (not Corsair's). The DID resolves, the signature checks out, but Corsair didn't attest. Yellow shield.",
        tag: "trust tier",
        relatesTo: ["DID:web", "DID Document"],
      },
      {
        term: "Unverifiable",
        definition:
          "The issuer's DID document couldn't be fetched — the domain might be down or misconfigured. Not invalid, just unreachable. Gray shield. Try again later.",
        tag: "trust tier",
      },
      {
        term: "Invalid",
        definition:
          "The signature verification failed, the JWT is malformed, or the credential expired. Something is wrong with the CPOE itself. Red shield.",
        tag: "trust tier",
      },
      {
        term: "Assurance Levels (L0–L4)",
        definition:
          "Optional enrichment tiers: L0=Documented (policy says so), L1=Configured (tool proves it's on), L2=Demonstrated (test proves it works), L3=Observed (continuous monitoring), L4=Attested (third-party audit).",
        tag: "enrichment",
        relatesTo: ["QUARTERMASTER", "Verifiable Presentation (VP)"],
      },
    ],
  },
  {
    id: "grc",
    label: "GRC",
    labelColor: "text-corsair-green",
    title: "GRC Terms",
    subtitle: "The industry Corsair operates in.",
    terms: [
      {
        term: "GRC",
        definition:
          "Governance, Risk, and Compliance — the discipline of managing organizational policies, assessing risk, and proving regulatory compliance.",
        tag: "industry",
      },
      {
        term: "SOC 2",
        definition:
          "A trust framework for service organizations, maintained by the AICPA. The most common compliance report in SaaS. Five trust service categories.",
        tag: "framework",
      },
      {
        term: "TPRM",
        definition:
          "Third-Party Risk Management — assessing whether your vendors are secure before trusting them with your data. What buyers do with CPOEs.",
        tag: "process",
        relatesTo: ["CPOE"],
      },
      {
        term: "NIST 800-53",
        definition:
          "A US government catalog of security and privacy controls. Over 1,000 controls across 20 families. One of many frameworks Corsair maps evidence to.",
        tag: "framework",
      },
      {
        term: "ISO 27001",
        definition:
          "The international standard for information security management systems (ISMS). Certification requires third-party audit against 93 controls.",
        tag: "framework",
      },
      {
        term: "FedRAMP",
        definition:
          "Federal Risk and Authorization Management Program — the US government's standard for cloud security. Built on NIST 800-53 with continuous monitoring.",
        tag: "framework",
      },
    ],
  },
];

const tagColors: Record<string, string> = {
  artifact: "border-corsair-gold/40 text-corsair-gold",
  protocol: "border-corsair-gold/40 text-corsair-gold",
  engine: "border-corsair-gold/40 text-corsair-gold",
  signal: "border-corsair-gold/40 text-corsair-gold",
  W3C: "border-corsair-cyan/40 text-corsair-cyan",
  IETF: "border-corsair-cyan/40 text-corsair-cyan",
  OpenID: "border-corsair-cyan/40 text-corsair-cyan",
  CNCF: "border-corsair-cyan/40 text-corsair-cyan",
  signature: "border-corsair-turquoise/40 text-corsair-turquoise",
  hash: "border-corsair-turquoise/40 text-corsair-turquoise",
  "data structure": "border-corsair-turquoise/40 text-corsair-turquoise",
  proof: "border-corsair-turquoise/40 text-corsair-turquoise",
  industry: "border-corsair-green/40 text-corsair-green",
  framework: "border-corsair-green/40 text-corsair-green",
  process: "border-corsair-green/40 text-corsair-green",
  input: "border-corsair-gold/40 text-corsair-gold",
  metadata: "border-corsair-gold/40 text-corsair-gold",
  transform: "border-corsair-gold/40 text-corsair-gold",
  chain: "border-corsair-gold/40 text-corsair-gold",
  integrity: "border-corsair-gold/40 text-corsair-gold",
  score: "border-corsair-gold/40 text-corsair-gold",
  log: "border-corsair-gold/40 text-corsair-gold",
  "trust tier": "border-corsair-cyan/40 text-corsair-cyan",
  enrichment: "border-corsair-gold/40 text-corsair-gold",
  identity: "border-corsair-cyan/40 text-corsair-cyan",
  trust: "border-corsair-cyan/40 text-corsair-cyan",
  policy: "border-corsair-cyan/40 text-corsair-cyan",
};

function getTagColor(tag: string): string {
  return tagColors[tag] ?? "border-corsair-border text-corsair-text-dim";
}

function toAnchor(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/, "");
}

/* ────────────────────────────────────────────────────────────
   DIAGRAM COMPONENTS
   ──────────────────────────────────────────────────────────── */

function PipelineFlowDiagram() {
  const stages = [
    {
      name: "EVIDENCE",
      desc: "Tool output",
      color: "text-corsair-text-dim",
      borderColor: "border-corsair-border",
      bgColor: "bg-corsair-surface",
    },
    {
      name: "SIGN",
      desc: "JWT-VC + Ed25519",
      color: "text-corsair-gold",
      borderColor: "border-corsair-gold/30",
      bgColor: "bg-corsair-gold/[0.04]",
    },
    {
      name: "LOG",
      desc: "SCITT + Merkle",
      color: "text-corsair-cyan",
      borderColor: "border-corsair-cyan/30",
      bgColor: "bg-corsair-cyan/[0.04]",
    },
    {
      name: "VERIFY",
      desc: "DID:web + Ed25519",
      color: "text-corsair-green",
      borderColor: "border-corsair-green/30",
      bgColor: "bg-corsair-green/[0.04]",
    },
    {
      name: "DIFF",
      desc: "Compare CPOEs",
      color: "text-corsair-turquoise",
      borderColor: "border-corsair-turquoise/30",
      bgColor: "bg-corsair-turquoise/[0.04]",
    },
    {
      name: "SIGNAL",
      desc: "SSF/CAEP",
      color: "text-corsair-crimson",
      borderColor: "border-corsair-crimson/30",
      bgColor: "bg-corsair-crimson/[0.04]",
    },
  ];

  return (
    <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-6 sm:p-8">
      <p className="mb-1 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
        THE PIPELINE
      </p>
      <p className="mb-6 text-xs text-corsair-text-dim">
        Evidence flows left to right. Each stage uses the standards shown below
        it.
      </p>

      {/* Desktop: horizontal flow */}
      <div className="hidden items-center gap-2 sm:flex">
        {stages.map((stage, i) => (
          <div key={stage.name} className="flex items-center gap-2">
            <div
              className={`flex flex-col items-center rounded-lg border ${stage.borderColor} ${stage.bgColor} px-4 py-3 transition-all hover:shadow-[0_0_16px_rgba(212,168,83,0.06)]`}
            >
              <span
                className={`font-mono text-xs font-bold ${stage.color}`}
              >
                {stage.name}
              </span>
              <span className="mt-1 text-[10px] text-corsair-text-dim">
                {stage.desc}
              </span>
            </div>
            {i < stages.length - 1 && (
              <span className="font-mono text-xs text-corsair-border">
                &rarr;
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical flow */}
      <div className="flex flex-col gap-2 sm:hidden">
        {stages.map((stage, i) => (
          <div key={stage.name} className="flex flex-col items-center gap-2">
            <div
              className={`flex w-full items-center justify-between rounded-lg border ${stage.borderColor} ${stage.bgColor} px-4 py-3`}
            >
              <span
                className={`font-mono text-xs font-bold ${stage.color}`}
              >
                {stage.name}
              </span>
              <span className="text-[10px] text-corsair-text-dim">
                {stage.desc}
              </span>
            </div>
            {i < stages.length - 1 && (
              <span className="font-mono text-xs text-corsair-border">
                &darr;
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtocolStackDiagram() {
  const layers = [
    {
      label: "APPLICATION",
      items: ["CPOE", "MARQUE", "FLAGSHIP"],
      color: "text-corsair-gold",
      borderColor: "border-corsair-gold/20",
      bgColor: "bg-corsair-gold/[0.03]",
      desc: "What users interact with",
    },
    {
      label: "PROTOCOL",
      items: ["JWT-VC", "SSF/CAEP", "SD-JWT", "in-toto"],
      color: "text-corsair-cyan",
      borderColor: "border-corsair-cyan/20",
      bgColor: "bg-corsair-cyan/[0.03]",
      desc: "Standards that format and transport proofs",
    },
    {
      label: "TRUST",
      items: ["DID:web", "SCITT", "Merkle Tree"],
      color: "text-corsair-green",
      borderColor: "border-corsair-green/20",
      bgColor: "bg-corsair-green/[0.03]",
      desc: "Identity resolution and tamper-evident logging",
    },
    {
      label: "CRYPTO",
      items: ["Ed25519", "COSE", "CBOR", "SHA-256"],
      color: "text-corsair-turquoise",
      borderColor: "border-corsair-turquoise/20",
      bgColor: "bg-corsair-turquoise/[0.03]",
      desc: "Signatures, hashing, binary serialization",
    },
  ];

  return (
    <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-6 sm:p-8">
      <p className="mb-1 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
        THE PROTOCOL STACK
      </p>
      <p className="mb-6 text-xs text-corsair-text-dim">
        Four layers. Each builds on the one below. Top layer is what you touch,
        bottom layer is the math.
      </p>

      <div className="flex flex-col gap-2">
        {layers.map((layer, i) => (
          <div key={layer.label}>
            <div
              className={`rounded-lg border ${layer.borderColor} ${layer.bgColor} p-4 transition-all hover:shadow-[0_0_16px_rgba(212,168,83,0.04)]`}
            >
              <div className="mb-2 flex items-center gap-3">
                <span
                  className={`font-pixel text-[7px] tracking-wider ${layer.color}/60`}
                >
                  {layer.label}
                </span>
                <span className="text-[10px] text-corsair-text-dim">
                  {layer.desc}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {layer.items.map((item) => (
                  <a
                    key={item}
                    href={`#${toAnchor(item)}`}
                    className={`rounded-md border border-corsair-border bg-corsair-deep px-3 py-1 font-mono text-xs ${layer.color} transition-all hover:border-corsair-gold/40`}
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
            {i < layers.length - 1 && (
              <div className="flex justify-center py-1">
                <span className="font-mono text-[10px] text-corsair-border">
                  &uarr; depends on
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustTierDiagram() {
  const tiers = [
    {
      label: "Corsair Verified",
      shield: "bg-corsair-green",
      desc: "Signed by did:web:grcorsair.com, signature valid",
      condition: "Corsair's own key",
    },
    {
      label: "Self-Signed Valid",
      shield: "bg-yellow-500",
      desc: "DID resolves, signature valid, not Corsair's key",
      condition: "Organization's own key",
    },
    {
      label: "Unverifiable",
      shield: "bg-corsair-text-dim",
      desc: "DID document unreachable — domain down or misconfigured",
      condition: "Network issue",
    },
    {
      label: "Invalid",
      shield: "bg-corsair-crimson",
      desc: "Signature failed, JWT malformed, or credential expired",
      condition: "Cryptographic failure",
    },
  ];

  return (
    <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-6 sm:p-8">
      <p className="mb-1 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
        TRUST TIERS
      </p>
      <p className="mb-6 text-xs text-corsair-text-dim">
        When you verify a CPOE, the result falls into one of four display tiers.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiers.map((tier) => (
          <div
            key={tier.label}
            className="flex items-start gap-3 rounded-lg border border-corsair-border bg-corsair-surface p-4"
          >
            <div
              className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-sm ${tier.shield}`}
            />
            <div>
              <p className="font-mono text-xs font-bold text-corsair-text">
                {tier.label}
              </p>
              <p className="mt-0.5 text-[11px] text-corsair-text-dim">
                {tier.desc}
              </p>
              <p className="mt-1 font-pixel text-[6px] tracking-wider text-corsair-text-dim/60">
                {tier.condition}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerificationFlowDiagram() {
  const steps = [
    {
      num: "01",
      label: "DECODE",
      desc: "Parse JWT header + payload (base64url)",
    },
    {
      num: "02",
      label: "RESOLVE",
      desc: "Fetch issuer's DID document via HTTPS",
    },
    {
      num: "03",
      label: "EXTRACT",
      desc: "Find the public key matching header.kid",
    },
    {
      num: "04",
      label: "VERIFY",
      desc: "Check Ed25519 signature against public key",
    },
  ];

  return (
    <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-6 sm:p-8">
      <p className="mb-1 font-pixel text-[7px] tracking-wider text-corsair-green/60">
        VERIFICATION FLOW
      </p>
      <p className="mb-6 text-xs text-corsair-text-dim">
        Four steps. Anyone can do this. No Corsair account needed.
      </p>

      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-corsair-green/20 bg-corsair-green/[0.06]">
              <span className="font-mono text-xs font-bold text-corsair-green">
                {step.num}
              </span>
            </div>
            <div className="sm:mt-2">
              <p className="font-mono text-[11px] font-bold text-corsair-text">
                {step.label}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-corsair-text-dim">
                {step.desc}
              </p>
            </div>
            {i < steps.length - 1 && (
              <span className="hidden font-mono text-xs text-corsair-border sm:block">
                &rarr;
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────────── */

export default function GlossaryPage() {
  const totalTerms = sections.reduce((sum, s) => sum + s.terms.length, 0);

  return (
    <main className="pb-20">
      {/* ═══ HERO ═══ */}
      <section className="relative flex min-h-[50dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.02] blur-[120px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            EVERY TERM IN PLAIN ENGLISH
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            glossary
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            {totalTerms} terms. One sentence each. Diagrams showing how they
            connect.
            <br />
            <span className="text-corsair-text-dim/60">
              No jargon to explain jargon.
            </span>
          </p>
        </FadeIn>

        {/* Jump links */}
        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-md border border-corsair-border bg-corsair-surface px-3 py-1.5 font-mono text-xs text-corsair-text-dim transition-all hover:border-corsair-gold/40 hover:text-corsair-gold"
              >
                {section.label}
              </a>
            ))}
          </div>
        </FadeIn>
      </section>

      <PixelDivider className="my-4" />

      {/* ═══ PIPELINE DIAGRAM ═══ */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <PipelineFlowDiagram />
          </FadeIn>
        </div>
      </section>

      {/* ═══ PROTOCOL STACK DIAGRAM ═══ */}
      <section className="px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <FadeIn delay={0.1}>
            <ProtocolStackDiagram />
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="diamond" className="my-12" />

      {/* ═══ GLOSSARY SECTIONS ═══ */}
      <div className="px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-20">
          {sections.map((section, sectionIdx) => (
            <section key={section.id} id={section.id}>
              <FadeIn delay={0.05 * sectionIdx}>
                <div className="mb-8">
                  <p
                    className={`mb-2 font-pixel text-[7px] tracking-wider ${section.labelColor}/60`}
                  >
                    {section.label}
                  </p>
                  <h2 className="mb-1 font-display text-2xl font-bold text-corsair-text">
                    {section.title}
                  </h2>
                  <p className="text-sm text-corsair-text-dim">
                    {section.subtitle}
                  </p>
                </div>
              </FadeIn>

              {/* Inline diagrams for specific sections */}
              {section.id === "verification" && (
                <FadeIn delay={0.05 * sectionIdx + 0.02}>
                  <div className="mb-8 space-y-4">
                    <VerificationFlowDiagram />
                    <TrustTierDiagram />
                  </div>
                </FadeIn>
              )}

              <div className="grid gap-3">
                {section.terms.map((item, termIdx) => (
                  <FadeIn
                    key={item.term}
                    delay={0.05 * sectionIdx + 0.03 * termIdx}
                  >
                    <div
                      id={toAnchor(item.term)}
                      className="group rounded-xl border border-corsair-border bg-corsair-surface p-5 transition-all hover:border-corsair-gold/20 hover:shadow-[0_0_24px_rgba(212,168,83,0.04)]"
                    >
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                          <h3 className="font-mono text-base font-bold text-corsair-gold">
                            {item.term}
                          </h3>
                          {item.tag && (
                            <span
                              className={`rounded-full border px-2 py-0.5 font-pixel text-[6px] tracking-wider ${getTagColor(item.tag)}`}
                            >
                              {item.tag.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed text-corsair-text-dim">
                          {item.definition}
                        </p>
                        {item.relatesTo && item.relatesTo.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="font-pixel text-[6px] tracking-wider text-corsair-text-dim/40">
                              RELATES TO
                            </span>
                            {item.relatesTo.map((rel) => (
                              <a
                                key={rel}
                                href={`#${toAnchor(rel)}`}
                                className="rounded border border-corsair-border bg-corsair-deep px-2 py-0.5 font-mono text-[10px] text-corsair-text-dim transition-all hover:border-corsair-gold/30 hover:text-corsair-gold"
                              >
                                {rel}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>

              {sectionIdx < sections.length - 1 && (
                <PixelDivider variant="diamond" className="mt-16" />
              )}
            </section>
          ))}
        </div>
      </div>

      <PixelDivider variant="swords" className="my-8" />

      {/* ═══ CTA ═══ */}
      <FadeIn>
        <div className="px-6 text-center">
          <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/40">
            STILL LOST?
          </p>
          <p className="mb-6 text-corsair-text-dim">
            Check the protocol deep-dive or ask a question on GitHub.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/protocol"
              className="inline-block rounded-lg border border-corsair-gold/30 bg-corsair-surface px-8 py-4 font-display text-sm font-semibold text-corsair-text transition-all hover:border-corsair-gold hover:text-corsair-gold hover:shadow-[0_0_20px_rgba(212,168,83,0.1)]"
            >
              Protocol Deep-Dive &rarr;
            </a>
            <a
              href="/faq"
              className="inline-block rounded-lg border border-corsair-border bg-corsair-surface px-8 py-4 font-display text-sm font-semibold text-corsair-text-dim transition-all hover:border-corsair-cyan/40 hover:text-corsair-cyan"
            >
              FAQ
            </a>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
