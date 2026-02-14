"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { MenuIcon } from "lucide-react";

const navLinks = [
  { href: "/vision", label: "Vision" },
  { href: "/anatomy", label: "How It Works" },
  { href: "/protocol", label: "Protocol" },
  { href: "/integrations", label: "Integrations" },
  { href: "/docs", label: "Docs" },
  { href: "/playground", label: "Playground" },
  { href: "/sign", label: "Sign" },
  { href: "/marque", label: "Verify" },
  { href: "/log", label: "Log" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/glossary", label: "Glossary" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-corsair-border bg-corsair-deep/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/corsair-logo.png"
            alt="CORSAIR"
            width={36}
            height={36}
            className="h-9 w-9"
          />
          <span className="font-display text-xl font-bold tracking-tight text-corsair-text">
            CORSAIR
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-gold"
            >
              {link.label}
            </Link>
          ))}
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/Arudjreis/corsair"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <GitHubIcon />
              <span>GitHub</span>
            </a>
          </Button>
        </div>

        {/* Mobile nav — shadcn Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-label="Toggle menu"
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-corsair-deep border-corsair-border">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-corsair-text">
                <Image
                  src="/assets/corsair-logo.png"
                  alt="CORSAIR"
                  width={24}
                  height={24}
                />
                CORSAIR
              </SheetTitle>
            </SheetHeader>
            <Separator className="bg-corsair-border" />
            <nav className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm text-corsair-text-dim transition-colors hover:bg-corsair-surface hover:text-corsair-gold"
                >
                  {link.label}
                </Link>
              ))}
              <Separator className="my-2 bg-corsair-border" />
              <a
                href="https://github.com/Arudjreis/corsair"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-corsair-text-dim transition-colors hover:bg-corsair-surface hover:text-corsair-gold"
              >
                <GitHubIcon />
                GitHub
              </a>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
