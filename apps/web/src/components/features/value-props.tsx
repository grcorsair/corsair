import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const props = [
  {
    title: "Ingest Existing Evidence",
    description:
      "INGEST extracts compliance data from SOC 2 reports, pentest results, and audit documents. CHART maps controls to 12+ frameworks automatically. No new data collection required.",
    accent: "border-t-corsair-cyan",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-corsair-cyan" strokeWidth={1.5}>
        <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "AI Governance Review",
    description:
      "QUARTERMASTER evaluates evidence quality, methodology rigor, and completeness before any credential is signed. Not a checkbox -- a governance gate with deterministic and LLM verification.",
    accent: "border-t-corsair-gold",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-corsair-gold" strokeWidth={1.5}>
        <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Cryptographic Proof Anyone Can Verify",
    description:
      "MARQUE generates Ed25519-signed W3C Verifiable Credentials (JWT-VC). Anyone with a public key can verify a CPOE -- no vendor lock-in, no trust assumptions. Open. Verifiable. Interoperable.",
    accent: "border-t-corsair-crimson",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-corsair-crimson" strokeWidth={1.5}>
        <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function ValueProps() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {props.map((prop) => (
        <Card
          key={prop.title}
          className={`border-t-2 ${prop.accent} bg-corsair-surface transition-all hover:shadow-lg hover:shadow-corsair-cyan/5`}
        >
          <CardHeader>
            <div className="mb-2">{prop.icon}</div>
            <CardTitle className="font-display text-xl text-corsair-text">
              {prop.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-relaxed text-corsair-text-dim">
              {prop.description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
