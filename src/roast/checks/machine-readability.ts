import type { RoastScoredCheck } from "../types";
import type { RoastScanContext } from "../scanner-types";
import { normalizeScore } from "../scoring";

export async function checkMachineReadability(ctx: RoastScanContext): Promise<RoastScoredCheck> {
  const findings: string[] = [];
  let score = 0;

  const trustTxt = ctx.trustResolution.trustTxt;
  if (trustTxt) {
    score += 1.5;
    findings.push("trust.txt is machine-readable");
  }

  if (ctx.cpoeListResolution.cpoes.length > 0) {
    score += 5;
    findings.push(`${ctx.cpoeListResolution.cpoes.length} JWT CPOE artifact(s) discovered`);
  }

  let structuredLinks = 0;
  let pdfLinks = 0;
  for (const page of ctx.pageSignals) {
    structuredLinks += page.structuredLinkCount;
    pdfLinks += page.pdfLinkCount;
  }

  if (structuredLinks > 0) {
    score += 2;
    findings.push(`${structuredLinks} structured link(s) found (.json/.xml/API-style paths)`);
  }

  if (pdfLinks > 0) {
    findings.push(`${pdfLinks} PDF report link(s) found`);
    if (structuredLinks === 0) {
      score += 0.5;
      findings.push("Trust center appears PDF-heavy with limited machine-readable endpoints");
    }
  }

  if (trustTxt?.catalog) {
    score += 1;
    findings.push("Catalog endpoint declared");
  }

  if (trustTxt?.scitt) {
    score += 1;
    findings.push("API-style SCITT endpoint declared");
  }

  if (score === 0) {
    findings.push("No machine-readable compliance artifacts found");
  }

  return {
    category: "machine-readability",
    score: normalizeScore(score),
    findings,
  };
}
