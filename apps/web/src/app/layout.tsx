import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Press_Start_2P } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CORSAIR — Open Compliance Trust Exchange Protocol",
    template: "%s — CORSAIR",
  },
  description:
    "Open protocol for machine-readable, cryptographically verifiable compliance attestations. Verify trust. Don't assume it.",
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
    "TPRM",
    "third-party risk management",
    "Marque",
    "SCITT",
    "Parley protocol",
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
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${pressStart2P.variable}`}
    >
      <body className="min-h-screen bg-corsair-deep text-corsair-text antialiased">
        {children}
      </body>
    </html>
  );
}
