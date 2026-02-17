"use client";

import dynamic from "next/dynamic";

export const MarqueVerifierLazy = dynamic(
  () => import("./marque-verifier").then((m) => m.MarqueVerifier),
  { ssr: false },
);
