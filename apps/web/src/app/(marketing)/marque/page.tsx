import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Marque — Cryptographic CPOE Signature Verification",
  description:
    "Marque is the cryptographic signing and verification engine behind CORSAIR CPOEs. Redirects to the verification page.",
};

export default function MarquePage() {
  redirect("/verify");
}
