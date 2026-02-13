"use client";

import { useState, useEffect } from "react";
import { VendorProfileCard, type VendorProfile } from "@/components/features/vendor-profile-card";
import { BadgeEmbed } from "@/components/features/badge-embed";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Button } from "@/components/ui/button";

interface VendorProfileViewProps {
  domain: string;
}

export function VendorProfileView({ domain }: VendorProfileViewProps) {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/profile/${domain}`);
        if (res.status === 404) {
          setError("No CPOEs found for this issuer.");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [domain]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 animate-pulse rounded-lg bg-corsair-surface" />
        <div className="h-48 animate-pulse rounded-lg bg-corsair-surface" />
        <div className="h-32 animate-pulse rounded-lg bg-corsair-surface" />
      </div>
    );
  }

  if (error) {
    return (
      <FadeIn>
        <div className="text-center">
          <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
            PROFILE
          </p>
          <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text">
            {domain}
          </h1>
          <div className="mx-auto max-w-md rounded-lg border border-corsair-border bg-corsair-surface p-8">
            <p className="text-corsair-text-dim">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <a href="/playground">Sign your first CPOE</a>
            </Button>
          </div>
        </div>
      </FadeIn>
    );
  }

  if (!profile) return null;

  const latestEntryId = profile.history[0]?.entryId;

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn>
        <div className="text-center">
          <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
            COMPLIANCE PROFILE
          </p>
          <h1 className="mb-4 font-pixel-display text-4xl font-bold text-corsair-text sm:text-5xl">
            {domain}
          </h1>
          <p className="text-corsair-text-dim">
            Public compliance portfolio powered by{" "}
            <span className="text-corsair-gold">cryptographic proof</span>.
          </p>
        </div>
      </FadeIn>

      <PixelDivider variant="swords" className="my-8" />

      {/* Profile card */}
      <FadeIn delay={0.1}>
        <VendorProfileCard profile={profile} />
      </FadeIn>

      {/* Score trend */}
      {profile.history.length > 1 && (
        <FadeIn delay={0.2}>
          <div>
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              SCORE TREND
            </p>
            <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A] p-6">
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {profile.history
                  .slice()
                  .reverse()
                  .slice(-12)
                  .map((h, i) => {
                    const height = Math.max(4, (h.score / 100) * 100);
                    return (
                      <div
                        key={h.entryId}
                        className="group relative flex-1"
                        title={`${h.score}/100 — ${new Date(h.registrationTime).toLocaleDateString()}`}
                      >
                        <div
                          className="rounded-sm bg-corsair-gold/60 transition-colors group-hover:bg-corsair-gold"
                          style={{ height: `${height}%` }}
                        />
                        {i === profile.history.length - 1 && (
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] text-corsair-gold">
                            {h.score}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9px] text-corsair-text-dim/60">
                <span>Oldest</span>
                <span>Latest</span>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Badge embed */}
      {latestEntryId && (
        <FadeIn delay={0.3}>
          <BadgeEmbed marqueId={latestEntryId} />
        </FadeIn>
      )}

      {/* Share link */}
      <FadeIn delay={0.4}>
        <div className="rounded-lg border border-corsair-border bg-corsair-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="block font-mono text-xs font-semibold text-corsair-text">
                Share this profile
              </span>
              <span className="block font-mono text-[10px] text-corsair-text-dim">
                Send to procurement teams, auditors, or partners
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(`https://grcorsair.com/profile/${domain}`);
              }}
            >
              Copy Link
            </Button>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
