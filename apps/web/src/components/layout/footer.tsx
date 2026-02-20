import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { CORSAIR_VERSION } from "@/content/snippets";

const productLinks = [
  { href: "/sign", label: "Sign" },
  { href: "/log", label: "Log" },
  { href: "/publish", label: "Publish" },
  { href: "/verify", label: "Verify" },
  { href: "/diff", label: "Diff" },
  { href: "/signal", label: "Signal" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/for-grc", label: "For GRC Leaders" },
  { href: "/docs", label: "Documentation" },
  { href: "/blog", label: "Blog" },
];

const resourceLinks = [
  { href: "/docs/getting-started/quick-start", label: "Quick Start" },
  { href: "/docs/concepts/pipeline", label: "CPOE Lifecycle" },
  { href: "/docs/integrations/api", label: "REST API" },
  { href: "/docs/integrations/skills", label: "Agent Skills" },
  { href: "/docs/integrations/sdk", label: "TypeScript SDK" },
  { href: "/docs#integrations", label: "Integrations" },
];

const communityLinks = [
  { href: "https://grcengineer.com", label: "GRC Engineer", external: true },
  { href: "https://grcengineer.com/subscribe", label: "Newsletter", external: true },
  { href: "https://github.com/Arudjreis/corsair", label: "GitHub", external: true },
  { href: "https://github.com/Arudjreis/corsair/blob/main/CONTRIBUTING.md", label: "Contributing Guide", external: true },
  { href: "https://github.com/Arudjreis/corsair/blob/main/SECURITY.md", label: "Security Policy", external: true },
];

export function Footer() {
  return (
    <footer className="border-t border-corsair-border bg-corsair-deep">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Main grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <span className="text-lg font-bold text-corsair-text" style={{ fontFamily: "var(--font-pixel-display)" }}>
              CORSAIR
            </span>
            <p className="mt-2 text-sm leading-relaxed text-corsair-text-dim">
              Open compliance trust exchange protocol. Verify trust. Don&apos;t assume it.
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-wider text-corsair-text-dim/40">
              Sign. Verify. Diff. Log. Signal.
            </p>
            <p className="mt-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim/60">
              v{CORSAIR_VERSION} &middot; Apache-2.0
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="mb-3 font-display text-sm font-semibold text-corsair-text">
              Product
            </p>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="mb-3 font-display text-sm font-semibold text-corsair-text">
              Resources
            </p>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <p className="mb-3 font-display text-sm font-semibold text-corsair-text">
              Community
            </p>
            <ul className="space-y-2">
              {communityLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-gold"
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
            &copy; {new Date().getFullYear()} Corsair. Built by{" "}
            <a
              href="https://grcengineer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-corsair-text-dim/80 transition-colors hover:text-corsair-gold"
            >
              Ayoub Fandi
            </a>
            . Open. Verifiable. Interoperable.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/blog/rss.xml"
              className="text-xs text-corsair-text-dim/60 transition-colors hover:text-corsair-gold"
            >
              RSS
            </Link>
            <Link
              href="/sitemap.xml"
              className="text-xs text-corsair-text-dim/60 transition-colors hover:text-corsair-gold"
            >
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
