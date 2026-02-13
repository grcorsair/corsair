import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

// Rate limiting: 10 dry-runs/min, 5 signs/min per IP
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const body = await request.json();
    const isDryRun = body.dryRun === true;
    const limit = isDryRun ? 10 : 5;

    if (!checkRateLimit(`${ip}:${isDryRun ? "dry" : "sign"}`, limit)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in 60 seconds." },
        { status: 429 },
      );
    }

    if (!body.evidence) {
      return NextResponse.json(
        { error: "Missing 'evidence' field in request body." },
        { status: 400 },
      );
    }

    // Parse the evidence locally to generate a preview
    // This avoids requiring API auth for dry-run mode
    if (isDryRun) {
      let evidence: unknown;
      try {
        evidence = typeof body.evidence === "string" ? JSON.parse(body.evidence) : body.evidence;
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON in evidence field." },
          { status: 400 },
        );
      }

      const preview = generateDryRunPreview(evidence, body.format);
      return NextResponse.json(preview);
    }

    // Full sign — proxy to API
    const res = await fetch(`${API_BASE}/sign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {}),
      },
      body: JSON.stringify({
        evidence: body.evidence,
        format: body.format,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

/** Generate a preview of what the CPOE would contain without actually signing */
function generateDryRunPreview(evidence: unknown, formatOverride?: string): Record<string, unknown> {
  const detected = detectFormat(evidence, formatOverride);
  const summary = extractSummary(evidence, detected.format);

  const now = new Date();
  const expiry = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  return {
    jwt: `eyJhbGciOiJFZERTQSIsInR5cCI6InZjK2p3dCJ9.${btoa(JSON.stringify({ preview: true, format: detected.format, score: summary.overallScore }))}.PREVIEW_DRY_RUN`,
    marqueId: `preview-${crypto.randomUUID().slice(0, 8)}`,
    format: detected.format,
    controlsTested: summary.controlsTested,
    controlsPassed: summary.controlsPassed,
    controlsFailed: summary.controlsFailed,
    overallScore: summary.overallScore,
    provenance: detected.provenance,
    issuedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
  };
}

function detectFormat(
  evidence: unknown,
  override?: string,
): { format: string; provenance: string } {
  if (override) {
    return { format: override, provenance: `tool (${override})` };
  }

  if (Array.isArray(evidence)) {
    const first = evidence[0] as Record<string, unknown> | undefined;
    if (first && "StatusCode" in first) return { format: "prowler", provenance: "tool (Prowler)" };
  }

  if (typeof evidence === "object" && evidence !== null) {
    const obj = evidence as Record<string, unknown>;
    if ("Findings" in obj) return { format: "securityhub", provenance: "tool (SecurityHub)" };
    if ("profiles" in obj) return { format: "inspec", provenance: "tool (InSpec)" };
    if ("Results" in obj) return { format: "trivy", provenance: "tool (Trivy)" };
    if ("vulnerabilities" in obj) return { format: "gitlab", provenance: "tool (GitLab SAST)" };
    if ("requirement_assessments" in obj) return { format: "ciso-assistant-export", provenance: "tool (CISO Assistant)" };
    if ("results" in obj) return { format: "ciso-assistant-api", provenance: "tool (CISO Assistant)" };
    if ("controls" in obj) return { format: "generic", provenance: "json" };
  }

  return { format: "generic", provenance: "json" };
}

function extractSummary(
  evidence: unknown,
  format: string,
): { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number } {
  const empty = { controlsTested: 0, controlsPassed: 0, controlsFailed: 0, overallScore: 0 };

  if (format === "prowler" && Array.isArray(evidence)) {
    const pass = evidence.filter((f: Record<string, unknown>) => f.StatusCode === "PASS").length;
    const total = evidence.length;
    return { controlsTested: total, controlsPassed: pass, controlsFailed: total - pass, overallScore: total > 0 ? Math.round((pass / total) * 100) : 0 };
  }

  if (format === "securityhub" && typeof evidence === "object" && evidence !== null) {
    const findings = (evidence as Record<string, unknown>).Findings as Array<{ Compliance?: { Status?: string } }> | undefined;
    if (!findings) return empty;
    const pass = findings.filter((f) => f.Compliance?.Status === "PASSED").length;
    return { controlsTested: findings.length, controlsPassed: pass, controlsFailed: findings.length - pass, overallScore: findings.length > 0 ? Math.round((pass / findings.length) * 100) : 0 };
  }

  if (format === "inspec" && typeof evidence === "object" && evidence !== null) {
    const profiles = (evidence as Record<string, unknown>).profiles as Array<{ controls?: Array<{ results?: Array<{ status?: string }> }> }> | undefined;
    if (!profiles) return empty;
    let total = 0, pass = 0;
    for (const p of profiles) {
      for (const c of p.controls ?? []) {
        total++;
        if ((c.results ?? []).every((r) => r.status === "passed")) pass++;
      }
    }
    return { controlsTested: total, controlsPassed: pass, controlsFailed: total - pass, overallScore: total > 0 ? Math.round((pass / total) * 100) : 0 };
  }

  if (format === "trivy" && typeof evidence === "object" && evidence !== null) {
    const results = (evidence as Record<string, unknown>).Results as Array<{ Vulnerabilities?: Array<{ Severity?: string }> }> | undefined;
    if (!results) return empty;
    let total = 0, crit = 0;
    for (const r of results) {
      for (const v of r.Vulnerabilities ?? []) {
        total++;
        if (v.Severity === "CRITICAL" || v.Severity === "HIGH") crit++;
      }
    }
    return { controlsTested: total, controlsPassed: total - crit, controlsFailed: crit, overallScore: total > 0 ? Math.round(((total - crit) / total) * 100) : 100 };
  }

  if (format === "generic" && typeof evidence === "object" && evidence !== null) {
    const controls = (evidence as Record<string, unknown>).controls as Array<{ status?: string }> | undefined;
    if (!controls) return empty;
    const pass = controls.filter((c) => c.status === "pass" || c.status === "effective").length;
    return { controlsTested: controls.length, controlsPassed: pass, controlsFailed: controls.length - pass, overallScore: controls.length > 0 ? Math.round((pass / controls.length) * 100) : 0 };
  }

  return empty;
}
