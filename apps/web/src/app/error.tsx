"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

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
            <Button
              size="lg"
              onClick={reset}
              className="font-display font-semibold"
            >
              Try Again
            </Button>
            <Button variant="outline" size="lg" className="font-display font-semibold" asChild>
              <Link href="/">Return to Port</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
