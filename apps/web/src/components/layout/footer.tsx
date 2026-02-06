import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const productLinks = [
  { href: "/demo", label: "Demo" },
  { href: "/docs", label: "Documentation" },
  { href: "/marque", label: "Marque Verifier" },
  { href: "/blog", label: "Blog" },
];

const resourceLinks = [
  { href: "/docs/getting-started/quick-start", label: "Quick Start" },
  { href: "/docs/concepts/pipeline", label: "Pipeline Architecture" },
  { href: "/docs/integrations/mcp-server", label: "MCP Server" },
  { href: "/docs/integrations/ci-cd", label: "CI/CD Integration" },
];

const communityLinks = [
  { href: "https://github.com/Arudjreis/corsair", label: "GitHub", external: true },
  { href: "https://github.com/Arudjreis/corsair/blob/main/CONTRIBUTING.md", label: "Contributing Guide", external: true },
  { href: "https://github.com/Arudjreis/corsair/blob/main/SECURITY.md", label: "Security Policy", external: true },
  { href: "https://grcengineer.com", label: "GRC Engineer", external: true },
];

export function Footer() {
  return (
    <footer className="border-t border-corsair-border bg-corsair-deep">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Main grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <span className="font-display text-lg font-bold text-corsair-text">
              CORSAIR
            </span>
            <p className="mt-2 text-sm leading-relaxed text-corsair-text-dim">
              Agentic GRC chaos engineering. Attack first. Discover reality. Evidence emerges.
            </p>
            <p className="mt-3 font-mono text-xs text-corsair-text-dim/60">
              v0.2.0 &middot; MIT License
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-corsair-text">
              Product
            </h3>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-cyan"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-corsair-text">
              Resources
            </h3>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-cyan"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-corsair-text">
              Community
            </h3>
            <ul className="space-y-2">
              {communityLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-cyan"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-corsair-border" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-corsair-text-dim/60">
            &copy; {new Date().getFullYear()} Corsair. Autonomous. Adversarial. Agentic.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/blog/rss.xml"
              className="text-xs text-corsair-text-dim/60 transition-colors hover:text-corsair-cyan"
            >
              RSS
            </Link>
            <Link
              href="/sitemap.xml"
              className="text-xs text-corsair-text-dim/60 transition-colors hover:text-corsair-cyan"
            >
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
