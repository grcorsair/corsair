import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const props = [
  {
    title: "Prove It Works",
    description:
      "RAID attacks your controls to test operational effectiveness. SPYGLASS models threats using STRIDE methodology. Not a checkbox — a proof.",
    accent: "border-t-corsair-crimson",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-corsair-crimson" strokeWidth={1.5}>
        <path d="M9.5 14.5L3 21m0 0h5.5M3 21v-5.5M14.5 9.5L21 3m0 0h-5.5M21 3v5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Not Just Exists",
    description:
      "MARK detects drift between expected and actual state. 13+ compliance frameworks mapped automatically. Evidence is a byproduct, not a goal.",
    accent: "border-t-corsair-cyan",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-corsair-cyan" strokeWidth={1.5}>
        <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Signed Proof",
    description:
      "MARQUE generates standards-based Ed25519-signed attestation. QUARTERMASTER AI reviews assessment quality. W3C Verifiable Credential replaces questionnaire theater.",
    accent: "border-t-corsair-gold",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-corsair-gold" strokeWidth={1.5}>
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
