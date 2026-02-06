import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import { FirebaseAnalytics } from "@/components/analytics/firebase-analytics";
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
    default: "CORSAIR — Agentic GRC Chaos Engineering",
    template: "%s — CORSAIR",
  },
  description:
    "Your controls say they work. We make them prove it. Attack first. Discover reality. Evidence emerges.",
  keywords: [
    "GRC",
    "chaos engineering",
    "security testing",
    "compliance",
    "SOC2",
    "NIST",
    "offensive security",
    "TPRM",
    "third-party risk management",
    "CPOE",
    "adversarial testing",
    "Marque",
    "Ed25519",
  ],
  metadataBase: new URL("https://grcorsair.com"),
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "CORSAIR — Agentic GRC Chaos Engineering",
    description:
      "Your controls say they work. We make them prove it. Attack first. Discover reality. Evidence emerges.",
    url: "https://grcorsair.com",
    siteName: "CORSAIR",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CORSAIR — Agentic GRC Chaos Engineering",
    description: "Your controls say they work. We make them prove it.",
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
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
