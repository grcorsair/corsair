import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DisruptionSection() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Old way */}
      <Card className="bg-corsair-surface">
        <CardHeader>
          <Badge variant="destructive" className="w-fit text-xs">
            THE OLD WAY
          </Badge>
          <h3 className="mt-3 font-display text-xl font-bold text-corsair-text">
            &ldquo;Are you compliant?&rdquo;
          </h3>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Corsair way */}
      <Card className="border-corsair-cyan/30 bg-gradient-to-br from-corsair-surface to-corsair-navy/20">
        <CardHeader>
          <Badge className="w-fit bg-corsair-cyan/10 text-xs text-corsair-cyan hover:bg-corsair-cyan/20">
            THE CORSAIR WAY
          </Badge>
          <h3 className="mt-3 font-display text-xl font-bold text-corsair-text">
            &ldquo;Prove it works.&rdquo;
          </h3>
        </CardHeader>
        <CardContent>
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
              W3C Verifiable Credential with AI governance review
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-corsair-green">✓</span>
              Continuous proof that controls are operating
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
