const props = [
  {
    title: "Prove It Works",
    description:
      "RAID attacks your controls to test operational effectiveness. SPYGLASS models threats using STRIDE methodology. Not a checkbox — a proof.",
    accent: "border-corsair-crimson",
    icon: "⚔️",
  },
  {
    title: "Not Just Exists",
    description:
      "MARK detects drift between expected and actual state. 13+ compliance frameworks mapped automatically. Evidence is a byproduct, not a goal.",
    accent: "border-corsair-cyan",
    icon: "🔍",
  },
  {
    title: "Signed Proof",
    description:
      "MARQUE generates Ed25519-signed attestation. QUARTERMASTER AI reviews assessment quality. Cryptographic proof replaces questionnaire theater.",
    accent: "border-corsair-gold",
    icon: "✍️",
  },
];

export function ValueProps() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {props.map((prop) => (
        <div
          key={prop.title}
          className={`rounded-xl border-t-2 ${prop.accent} border border-t-2 border-corsair-border bg-corsair-surface p-6 transition-all hover:shadow-lg hover:shadow-corsair-cyan/5`}
        >
          <div className="mb-4 text-3xl">{prop.icon}</div>
          <h3 className="mb-2 font-display text-xl font-bold text-corsair-text">
            {prop.title}
          </h3>
          <p className="text-sm leading-relaxed text-corsair-text-dim">
            {prop.description}
          </p>
        </div>
      ))}
    </div>
  );
}
