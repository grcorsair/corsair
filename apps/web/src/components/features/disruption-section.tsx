export function DisruptionSection() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Old way */}
      <div className="rounded-xl border border-corsair-border bg-corsair-surface p-8">
        <div className="mb-4 inline-block rounded-full bg-corsair-crimson/10 px-3 py-1 font-mono text-xs font-semibold text-corsair-crimson">
          THE OLD WAY
        </div>
        <h3 className="mb-3 font-display text-xl font-bold text-corsair-text">
          &ldquo;Are you compliant?&rdquo;
        </h3>
        <ul className="space-y-3 text-sm text-corsair-text-dim">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-corsair-crimson">✗</span>
            300-question SIG questionnaires, self-attested
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-corsair-crimson">✗</span>
            Screenshots of control panels as &ldquo;evidence&rdquo;
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-corsair-crimson">✗</span>
            Annual audits that are stale immediately
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-corsair-crimson">✗</span>
            Checkbox theater that proves nothing
          </li>
        </ul>
      </div>

      {/* Corsair way */}
      <div className="rounded-xl border border-corsair-cyan/30 bg-gradient-to-br from-corsair-surface to-corsair-navy/20 p-8">
        <div className="mb-4 inline-block rounded-full bg-corsair-cyan/10 px-3 py-1 font-mono text-xs font-semibold text-corsair-cyan">
          THE CORSAIR WAY
        </div>
        <h3 className="mb-3 font-display text-xl font-bold text-corsair-text">
          &ldquo;Prove it works.&rdquo;
        </h3>
        <ul className="space-y-3 text-sm text-corsair-text-dim">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-corsair-green">✓</span>
            Adversarial attacks test controls under pressure
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-corsair-green">✓</span>
            SHA-256 evidence chain with cryptographic integrity
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-corsair-green">✓</span>
            Ed25519-signed Marque with AI governance review
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-corsair-green">✓</span>
            Continuous proof that controls are operating
          </li>
        </ul>
      </div>
    </div>
  );
}
