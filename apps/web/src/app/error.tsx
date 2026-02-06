"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <Header />
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20">
        <div className="text-center">
          <div className="mb-6 font-mono text-8xl font-bold text-corsair-border">
            500
          </div>
          <h1 className="mb-3 font-display text-2xl font-bold text-corsair-text">
            Ship Down
          </h1>
          <p className="mb-8 text-corsair-text-dim">
            Something went wrong. The crew is working on repairs.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={reset}
              className="rounded-lg bg-corsair-cyan px-6 py-3 font-display text-sm font-semibold text-corsair-deep transition-all hover:shadow-[0_0_20px_rgba(0,207,255,0.3)]"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="rounded-lg border border-corsair-border bg-corsair-surface px-6 py-3 font-display text-sm font-semibold text-corsair-text transition-colors hover:border-corsair-cyan hover:text-corsair-cyan"
            >
              Return to Port
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
