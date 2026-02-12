import type { Metadata } from "next";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import {
  RaidIcon,
  ChartIcon,
  QuarterIcon,
  MarqueIcon,
  ReconIcon,
  PlunderIcon,
  SpyglassIcon,
  MarkIcon,
} from "@/components/pixel-art/pixel-icons";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Join the Corsair community. Contribute tool adapters, framework mappings, and help build the future of compliance proof infrastructure.",
};

const links = [
  {
    name: "GRC Engineer — by Ayoub Fandi",
    description:
      "The GRC engineering practice behind Corsair. Strategy, content, and industry analysis from the founder. Subscribe to the newsletter for weekly deep dives on compliance engineering.",
    href: "https://grcengineer.com",
    icon: <QuarterIcon size={32} />,
    cta: "Visit grcengineer.com",
    glowColor: "rgba(212,168,83,0.15)",
    label: "FOUNDER",
    labelColor: "text-corsair-gold",
  },
  {
    name: "GRC Engineer Newsletter",
    description:
      "Weekly newsletter on GRC engineering, compliance automation, and the future of trust verification. 30K+ subscribers.",
    href: "https://grcengineer.com/subscribe",
    icon: <MarkIcon size={32} />,
    cta: "Subscribe",
    glowColor: "rgba(127,219,202,0.15)",
    label: "NEWSLETTER",
    labelColor: "text-corsair-turquoise",
  },
  {
    name: "GitHub Repository",
    description:
      "Star the repo, file issues, submit pull requests. Protocol and verification are Apache 2.0. Specs are CC BY 4.0.",
    href: "https://github.com/Arudjreis/corsair",
    icon: <RaidIcon size={32} />,
    cta: "View Repository",
    glowColor: "rgba(0,207,255,0.15)",
    label: "APACHE 2.0",
    labelColor: "text-corsair-cyan",
  },
  {
    name: "Contributing Guide",
    description:
      "The Pirate's Code — how to contribute tool adapters, framework mappings, and protocol extensions.",
    href: "https://github.com/Arudjreis/corsair/blob/main/CONTRIBUTING.md",
    icon: <ChartIcon size={32} />,
    cta: "Read the Code",
    glowColor: "rgba(212,168,83,0.15)",
    label: "PIRATE CODE",
    labelColor: "text-corsair-gold",
  },
  {
    name: "Security Policy",
    description:
      "Found a vulnerability? Report it responsibly. We take security seriously.",
    href: "https://github.com/Arudjreis/corsair/blob/main/SECURITY.md",
    icon: <MarqueIcon size={32} />,
    cta: "Report Vulnerability",
    glowColor: "rgba(192,57,43,0.15)",
    label: "SECURITY",
    labelColor: "text-corsair-crimson",
  },
];

const contributions = [
  {
    title: "Tool Adapters",
    description:
      "Build adapters that translate security tool output into the CPOE format — InSpec, Prowler, Trivy, ComplianceAsCode, and more. Each adapter feeds directly into corsair sign.",
    icon: <ReconIcon size={28} />,
    label: "EVIDENCE",
    labelColor: "text-corsair-cyan",
    glowColor: "rgba(0,207,255,0.12)",
  },
  {
    title: "Framework Mappings",
    description:
      "Extend the CTID/SCF data layer. Map new compliance frameworks to MITRE ATT&CK techniques and expand CHART coverage.",
    icon: <SpyglassIcon size={28} />,
    label: "CHART",
    labelColor: "text-corsair-turquoise",
    glowColor: "rgba(127,219,202,0.12)",
  },
  {
    title: "Protocol Extensions",
    description:
      "Advance the Parley protocol — SD-JWT selective disclosure, SCITT transparency features, FLAGSHIP delivery patterns, and new CAEP event types.",
    icon: <PlunderIcon size={28} />,
    label: "PARLEY",
    labelColor: "text-corsair-gold",
    glowColor: "rgba(212,168,83,0.12)",
  },
  {
    title: "Verification Tools & Platform Connectors",
    description:
      "Build CPOE verification integrations — browser extensions, CI/CD plugins, API clients — and platform connectors for GRC tools like CISO Assistant, Eramba, and Vanta.",
    icon: <MarkIcon size={28} />,
    label: "VERIFY",
    labelColor: "text-corsair-green",
    glowColor: "rgba(46,204,113,0.12)",
  },
];

export default function CommunityPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-16 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              COMMUNITY
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              join the crew
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Corsair is open source (Apache 2.0). The CPOE specification is openly
              licensed (CC BY 4.0). Contribute tool adapters, framework
              mappings, protocol extensions, and help build the future of
              compliance proof infrastructure.
            </p>
          </div>
        </FadeIn>

        {/* Links grid */}
        <StaggerChildren className="mb-8 grid gap-4 sm:grid-cols-2">
          {links.map((link) => (
            <StaggerItem key={link.name}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block h-full"
              >
                <Card
                  className="pixel-card-hover h-full bg-corsair-surface transition-all"
                  style={{ "--glow-color": link.glowColor } as React.CSSProperties}
                >
                  <CardHeader>
                    <div className="mb-2">{link.icon}</div>
                    <span className={`font-pixel text-[7px] tracking-wider ${link.labelColor}`}>
                      {link.label}
                    </span>
                    <CardTitle className="font-display text-lg text-corsair-text group-hover:text-corsair-gold">
                      {link.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-corsair-text-dim">
                      {link.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline" className="font-mono text-xs text-corsair-gold border-corsair-gold/30">
                      {link.cta} &rarr;
                    </Badge>
                  </CardContent>
                </Card>
              </a>
            </StaggerItem>
          ))}
        </StaggerChildren>

        <PixelDivider variant="swords" className="my-16" />

        {/* Ways to contribute */}
        <FadeIn>
          <div className="mb-8 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              CONTRIBUTE
            </p>
            <h2 className="font-display text-2xl font-bold text-corsair-text">
              Ways to Contribute
            </h2>
          </div>
        </FadeIn>
        <StaggerChildren className="grid gap-4 sm:grid-cols-2">
          {contributions.map((item) => (
            <StaggerItem key={item.title}>
              <Card
                className="pixel-card-hover h-full bg-corsair-surface"
                style={{ "--glow-color": item.glowColor } as React.CSSProperties}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <div>
                      <span className={`font-pixel text-[7px] tracking-wider ${item.labelColor}`}>
                        {item.label}
                      </span>
                      <CardTitle className="font-display text-corsair-text">
                        {item.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-corsair-text-dim">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerChildren>

        <PixelDivider variant="diamond" className="my-16" />

        {/* CTA */}
        <FadeIn>
          <div className="text-center">
            <p className="mb-4 text-corsair-text-dim">
              Ready to join the crew?
            </p>
            <a
              href="https://github.com/Arudjreis/corsair"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg border border-corsair-gold/30 bg-corsair-surface px-8 py-4 font-display text-sm font-semibold text-corsair-text transition-all hover:border-corsair-gold hover:text-corsair-gold hover:shadow-[0_0_20px_rgba(212,168,83,0.1)]"
            >
              Start Contributing on GitHub &rarr;
            </a>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
