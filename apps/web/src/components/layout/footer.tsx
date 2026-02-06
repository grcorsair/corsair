import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-corsair-border bg-corsair-deep">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Brand */}
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className="font-display text-lg font-bold text-corsair-text">
              CORSAIR
            </span>
            <span className="text-sm text-corsair-text-dim">
              Autonomous. Adversarial. Agentic.
            </span>
          </div>

          {/* Links */}
          <div className="flex gap-8 text-sm text-corsair-text-dim">
            <a
              href="https://github.com/Arudjreis/corsair"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-corsair-cyan"
            >
              GitHub
            </a>
            <Link
              href="/docs"
              className="transition-colors hover:text-corsair-cyan"
            >
              Docs
            </Link>
            <a
              href="https://grcengineer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-corsair-cyan"
            >
              GRC Engineer
            </a>
          </div>

          {/* License */}
          <div className="text-sm text-corsair-text-dim">MIT License</div>
        </div>
      </div>
    </footer>
  );
}
