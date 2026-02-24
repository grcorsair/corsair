import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CORSAIR — Open Compliance Trust Exchange Protocol",
    template: "%s — CORSAIR",
  },
  description:
    "Open protocol for machine-readable, cryptographically verifiable compliance attestations. Verify trust. Don't assume it.",
  authors: [{ name: "Ayoub Fandi", url: "https://grcengineer.com" }],
  creator: "Ayoub Fandi",
  keywords: [
    "GRC",
    "compliance verification",
    "verifiable credentials",
    "compliance",
    "SOC2",
    "NIST",
    "CPOE",
    "trust exchange",
    "JWT-VC",
    "Ed25519",
    "Marque",
    "SCITT",
    "Parley protocol",
    "GRC Engineering",
  ],
  metadataBase: new URL("https://grcorsair.com"),
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "CORSAIR — Open Compliance Trust Exchange Protocol",
    description:
      "Open protocol for machine-readable, cryptographically verifiable compliance attestations. Verify trust. Don't assume it.",
    url: "https://grcorsair.com",
    siteName: "CORSAIR",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CORSAIR — Open Compliance Trust Exchange Protocol",
    description: "Open protocol for cryptographically verifiable compliance attestations. Verify trust. Don't assume it.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-noise min-h-screen bg-corsair-deep text-corsair-text antialiased">
        {children}
      </body>
    </html>
  );
}
