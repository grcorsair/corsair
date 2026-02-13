import type { Metadata } from "next";
import { VendorProfileView } from "./vendor-profile-view";

interface ProfilePageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { domain } = await params;
  return {
    title: `${domain} — Compliance Profile`,
    description: `Public compliance portfolio for ${domain}. View CPOE history, assurance levels, and framework coverage.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { domain } = await params;

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <VendorProfileView domain={domain} />
      </div>
    </main>
  );
}
