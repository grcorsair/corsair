import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Join the Corsair community. Contribute plugins, SPYGLASS rules, and help build the future of adversarial GRC testing.",
};

const links = [
  {
    name: "GitHub Repository",
    description:
      "Star the repo, file issues, submit pull requests. The code is open source.",
    href: "https://github.com/Arudjreis/corsair",
    icon: "anchor",
    cta: "View Repository",
  },
  {
    name: "Contributing Guide",
    description:
      "The Pirate's Code — how to contribute plugins, SPYGLASS rules, and attack vectors.",
    href: "https://github.com/Arudjreis/corsair/blob/main/CONTRIBUTING.md",
    icon: "scroll",
    cta: "Read the Code",
  },
  {
    name: "GRC Engineer",
    description:
      "Ayoub's GRC engineering practice. Strategy, content, and industry analysis.",
    href: "https://grcengineer.com",
    icon: "flag",
    cta: "Visit grcengineer.com",
  },
  {
    name: "Security Policy",
    description:
      "Found a vulnerability? Report it responsibly. We take security seriously.",
    href: "https://github.com/Arudjreis/corsair/blob/main/SECURITY.md",
    icon: "shield",
    cta: "Report Vulnerability",
  },
];

const contributions = [
  {
    title: "New Provider Plugins",
    description:
      "Build plugins for Okta, Auth0, Datadog, GitHub Actions, Terraform, Kubernetes, and more. Each plugin adds attack vectors and framework mappings.",
  },
  {
    title: "SPYGLASS Rules",
    description:
      "Write STRIDE threat model rules for new services. Community-contributed rules expand Corsair's threat coverage.",
  },
  {
    title: "Attack Vectors",
    description:
      "Design new RAID scenarios. Contribute adversarial test cases that validate control operational effectiveness.",
  },
  {
    title: "Framework Mappings",
    description:
      "Extend the CTID/SCF data layer. Map new compliance frameworks to MITRE ATT&CK techniques.",
  },
];

function CommunityIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    anchor: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-corsair-cyan">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 0 0-3 3c0 1.657 1.343 3 3 3s3-1.343 3-3a3 3 0 0 0-3-3ZM12 8v14M5 12H2l10 10 10-10h-3" />
      </svg>
    ),
    scroll: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-corsair-gold">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    flag: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-corsair-crimson">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-corsair-green">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  };
  return <>{icons[name]}</>;
}

export default function CommunityPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-corsair-text">
              Join the Crew
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Corsair is open source. Contribute plugins, attack vectors,
              SPYGLASS rules, and help build the future of adversarial GRC
              testing.
            </p>
          </div>
        </FadeIn>

        {/* Links grid */}
        <FadeIn delay={0.1}>
          <div className="mb-16 grid gap-4 sm:grid-cols-2">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <Card className="h-full bg-corsair-surface transition-all group-hover:border-corsair-cyan/40">
                  <CardHeader>
                    <div className="mb-1">
                      <CommunityIcon name={link.icon} />
                    </div>
                    <CardTitle className="font-display text-lg text-corsair-text group-hover:text-corsair-cyan">
                      {link.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-corsair-text-dim">
                      {link.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline" className="font-mono text-xs text-corsair-cyan">
                      {link.cta} →
                    </Badge>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </FadeIn>

        {/* Ways to contribute */}
        <FadeIn>
          <h2 className="mb-6 font-display text-2xl font-bold text-corsair-text">
            Ways to Contribute
          </h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="grid gap-4 sm:grid-cols-2">
            {contributions.map((item) => (
              <Card key={item.title} className="bg-corsair-surface">
                <CardHeader>
                  <CardTitle className="font-display text-corsair-gold">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-corsair-text-dim">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
