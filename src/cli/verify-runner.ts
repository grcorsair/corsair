import { existsSync, readFileSync } from "fs";

export async function runVerify(args: string[]): Promise<void> {
  let filePath: string | undefined;
  let url: string | undefined;
  let domain: string | undefined;
  let verifyAll = false;
  let pubkeyPath: string | undefined;
  let showHelp = false;
  let jsonOutput = false;
  let useDid = false;
  let requireIssuer: string | undefined;
  let requireFrameworks: string[] = [];
  let maxAgeDays: number | undefined;
  let minScore: number | undefined;
  let requireSource: "self" | "tool" | "auditor" | undefined;
  let requireSourceIdentities: string[] = [];
  let requireToolAttestation = false;
  let requireInputBinding = false;
  let requireEvidenceChain = false;
  let requireReceipts = false;
  let requireScitt = false;
  let verifyDependencies = false;
  let dependencyDepth = 1;
  let receiptsPath: string | undefined;
  let sourceDocumentPath: string | undefined;
  let policyPath: string | undefined;
  const evidencePaths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--file":
      case "-f":
        filePath = args[++i];
        break;
      case "--url":
        url = args[++i];
        break;
      case "--domain":
        domain = args[++i];
        break;
      case "--pubkey":
      case "-k":
        pubkeyPath = args[++i];
        break;
      case "--did":
        useDid = true;
        break;
      case "--json":
        jsonOutput = true;
        break;
      case "--require-issuer":
        requireIssuer = args[++i];
        break;
      case "--require-framework":
        requireFrameworks = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--max-age":
        maxAgeDays = parseInt(args[++i], 10);
        break;
      case "--min-score":
        minScore = parseInt(args[++i], 10);
        break;
      case "--require-source":
        requireSource = args[++i] as "self" | "tool" | "auditor";
        break;
      case "--require-source-identity":
        requireSourceIdentities = (args[++i] || "").split(",").map(s => s.trim()).filter(Boolean);
        break;
      case "--require-tool-attestation":
        requireToolAttestation = true;
        break;
      case "--require-input-binding":
        requireInputBinding = true;
        break;
      case "--require-evidence-chain":
        requireEvidenceChain = true;
        break;
      case "--require-receipts":
        requireReceipts = true;
        break;
      case "--require-scitt":
        requireScitt = true;
        break;
      case "--dependencies":
      case "--verify-dependencies":
        verifyDependencies = true;
        break;
      case "--dependency-depth":
        dependencyDepth = Math.max(1, parseInt(args[++i], 10) || 1);
        break;
      case "--receipts":
        receiptsPath = args[++i];
        break;
      case "--policy":
        policyPath = args[++i];
        break;
      case "--source-document":
        sourceDocumentPath = args[++i];
        break;
      case "--evidence":
        evidencePaths.push(args[++i]);
        break;
      case "--all":
        verifyAll = true;
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
CORSAIR VERIFY — Verify a CPOE (JWT-VC or JSON envelope)

USAGE:
  corsair verify --file <path> [--pubkey <path>]
  corsair verify --url <https://...>
  corsair verify --domain <domain>

OPTIONS:
  -f, --file <PATH>     Path to the CPOE file (JWT or JSON)
      --url <URL>       Fetch and verify a CPOE from a URL
      --domain <DOMAIN> Resolve trust.txt/catalog and verify latest CPOE
  -k, --pubkey <PATH>   Path to Ed25519 public key PEM (default: ./keys/corsair-signing.pub)
      --did             Verify via DID:web resolution (no local key needed)
      --require-issuer <DID>      Require a specific issuer DID
      --require-framework <LIST>  Comma-separated frameworks that must be present
      --max-age <DAYS>            Maximum allowed age based on provenance.sourceDate
      --min-score <N>             Minimum overallScore required
      --require-source <TYPE>     Require provenance source: self|tool|auditor
      --require-source-identity <LIST>  Comma-separated source identities allowed
      --require-tool-attestation  Require toolAttestation in receipts
      --require-input-binding     Require provenance.sourceDocument hash binding
      --require-evidence-chain    Require evidenceChain + verification
      --require-receipts          Require verified process receipts
      --require-scitt             Require SCITT entry IDs for receipts
      --dependencies              Verify dependency CPOEs (trust graph)
      --dependency-depth <N>      Dependency verification depth (default: 1)
      --receipts <PATH>           Verify process receipts (JSON array)
      --policy <PATH>             Apply policy artifact JSON
      --evidence <PATH>           Verify evidence chain against JSONL (repeatable)
      --source-document <PATH>    Verify provenance.sourceDocument against raw evidence JSON
      --all             Verify all CPOEs when using --domain
      --json            Output structured JSON
  -h, --help            Show this help
`);
    return;
  }

  if (filePath && (url || domain)) {
    console.error("Error: --file cannot be combined with --url or --domain");
    process.exit(2);
  }

  if (url && domain) {
    console.error("Error: --url and --domain cannot be combined");
    process.exit(2);
  }

  if (requireSource && !["self", "tool", "auditor"].includes(requireSource)) {
    console.error(`Error: invalid --require-source value: ${requireSource}`);
    process.exit(2);
  }

  if (verifyAll && !domain) {
    console.error("Error: --all requires --domain");
    process.exit(2);
  }

  const remoteMode = Boolean(url || domain);
  if (remoteMode && (receiptsPath || evidencePaths.length > 0 || sourceDocumentPath)) {
    console.error("Error: --receipts, --evidence, and --source-document are not supported with --url/--domain");
    process.exit(2);
  }

  if (!filePath && !url && !domain) {
    console.error("Error: --file, --url, or --domain is required");
    console.error('Run "corsair verify --help" for usage');
    process.exit(2);
  }

  if (remoteMode && !useDid && !pubkeyPath) {
    useDid = true;
  }

  type VerificationTarget = {
    label: string;
    content?: string;
    format?: "JWT-VC" | "JSON Envelope";
    error?: string;
  };

  const targets: VerificationTarget[] = [];
  let discoverySource: string | undefined;
  let trustTxtUrl: string | undefined;
  let catalogUrl: string | undefined;
  let catalogWarning: string | undefined;

  if (filePath) {
    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(2);
    }
    const content = readFileSync(filePath, "utf-8").trim();
    const format = content.startsWith("eyJ") ? "JWT-VC" : "JSON Envelope";
    targets.push({ label: filePath, content, format });
  } else if (url) {
    const { fetchCpoeJwt } = await import("../parley/cpoe-resolver");
    const resolved = await fetchCpoeJwt(url);
    if (!resolved.jwt) {
      console.error(`Error: Failed to fetch CPOE (${resolved.error || "unknown error"})`);
      process.exit(1);
    }
    targets.push({ label: url, content: resolved.jwt, format: "JWT-VC" });
  } else if (domain) {
    const { resolveCpoeList, fetchCpoeJwt } = await import("../parley/cpoe-resolver");
    const resolution = await resolveCpoeList(domain);
    if (resolution.error) {
      console.error(`Error: ${resolution.error}`);
      process.exit(1);
    }
    discoverySource = resolution.source;
    trustTxtUrl = resolution.trustTxtUrl;
    catalogUrl = resolution.catalogUrl;
    catalogWarning = resolution.catalogError;

    if (resolution.cpoes.length === 0) {
      console.error("Error: No CPOEs found for domain");
      process.exit(1);
    }

    const selected = verifyAll ? resolution.cpoes : resolution.cpoes.slice(0, 1);
    for (const entry of selected) {
      const resolved = await fetchCpoeJwt(entry.url);
      if (!resolved.jwt) {
        targets.push({
          label: entry.url,
          error: resolved.error || "Failed to fetch CPOE",
        });
      } else {
        targets.push({ label: entry.url, content: resolved.jwt, format: "JWT-VC" });
      }
    }
  }

  let publicKey: Buffer | undefined;
  if (!useDid || receiptsPath) {
    const keyPath = pubkeyPath || "./keys/corsair-signing.pub";
    if (!existsSync(keyPath)) {
      console.error(`Error: Public key not found: ${keyPath}`);
      console.error("Generate keys with: corsair keygen");
      process.exit(2);
    }
    publicKey = readFileSync(keyPath);
  }

  const { MarqueVerifier } = await import("../parley/marque-verifier");
  const verifier = publicKey ? new MarqueVerifier([publicKey]) : new MarqueVerifier([]);

  let policyFromFile: import("../parley/verification-policy").VerificationPolicy | undefined;
  if (policyPath) {
    if (!existsSync(policyPath)) {
      console.error(`Error: Policy file not found: ${policyPath}`);
      process.exit(2);
    }
    try {
      const raw = readFileSync(policyPath, "utf-8");
      const parsed = JSON.parse(raw);
      const { validatePolicyArtifact } = await import("../parley/policy");
      const result = validatePolicyArtifact(parsed);
      if (!result.ok || !result.policy) {
        console.error("Error: Invalid policy file");
        for (const err of result.errors) {
          console.error(`  - ${err}`);
        }
        process.exit(2);
      }
      policyFromFile = result.policy;
    } catch (err) {
      console.error(`Error: failed to parse policy file: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    }
  }

  const policyRequested = Boolean(
    policyFromFile
    || requireIssuer
    || requireFrameworks.length > 0
    || maxAgeDays !== undefined
    || minScore !== undefined
    || requireSource
    || requireSourceIdentities.length > 0
    || requireToolAttestation
    || requireInputBinding
    || requireEvidenceChain
    || requireReceipts
    || requireScitt
  );

  let receiptsData: Array<import("../parley/process-receipt").ProcessReceipt> | undefined;
  if (receiptsPath) {
    if (!publicKey) {
      console.error("Error: receipts verification requires a public key");
      process.exit(2);
    }
    try {
      const raw = readFileSync(receiptsPath, "utf-8");
      receiptsData = JSON.parse(raw);
    } catch (err) {
      console.error(`Error: failed to parse receipts file: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    }
  }

  let evidenceSummary: import("../evidence").EvidenceChainAggregate | null | undefined;
  if (evidencePaths.length > 0) {
    const { EvidenceEngine } = await import("../evidence");
    const engine = new EvidenceEngine();
    evidenceSummary = engine.summarizeChains(evidencePaths);
  }

  let sourceDocumentHash: string | undefined;
  if (sourceDocumentPath) {
    if (!existsSync(sourceDocumentPath)) {
      console.error(`Error: Source document not found: ${sourceDocumentPath}`);
      process.exit(2);
    }
    try {
      const raw = readFileSync(sourceDocumentPath, "utf-8");
      const parsed = JSON.parse(raw);
      const { hashData } = await import("../parley/process-receipt");
      sourceDocumentHash = hashData(parsed);
    } catch (err) {
      console.error(`Error: failed to compute source document hash: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    }
  }

  type VerificationOutcome = {
    ok: boolean;
    format?: string;
    label: string;
    error?: string;
    response?: Record<string, unknown>;
    result?: any;
    policyResult?: { ok: boolean; errors: string[] };
    processResult?: import("../parley/receipt-verifier").ProcessVerificationResult;
    evidenceResult?: import("../evidence").EvidenceChainMatchResult;
    inputBindingResult?: { ok: boolean; errors: string[]; expected?: string; actual?: string };
    dependencyStatus?: { ok: boolean; errors: string[]; results: import("../parley/dependency-proofs").DependencyVerificationResult[] } | null;
  };

  const verifyTarget = async (target: VerificationTarget): Promise<VerificationOutcome> => {
    if (target.error) {
      return { ok: false, label: target.label, error: target.error };
    }

    const content = target.content || "";
    const format = target.format || (content.startsWith("eyJ") ? "JWT-VC" : "JSON Envelope");
    let result;
    let doc: any | null = null;

    try {
      if (format === "JWT-VC") {
        if (useDid) {
          const { verifyVCJWTViaDID } = await import("../parley/vc-verifier");
          result = await verifyVCJWTViaDID(content);
        } else {
          result = await verifier.verify(content);
        }
      } else {
        doc = JSON.parse(content);
        if (useDid) {
          return { ok: false, label: target.label, error: "--did is only supported for JWT-VC verification" };
        }
        result = await verifier.verify(doc);
      }
    } catch (err) {
      return { ok: false, label: target.label, error: err instanceof Error ? err.message : String(err) };
    }

    let payload: Record<string, unknown> | null = null;
    if (format === "JWT-VC") {
      payload = decodeJwtPayload(content);
    }

    let processResult: import("../parley/receipt-verifier").ProcessVerificationResult | undefined;
    let evidenceResult: import("../evidence").EvidenceChainMatchResult | undefined;
    let inputBindingResult: { ok: boolean; errors: string[]; expected?: string; actual?: string } | undefined;
    let dependencyStatus:
      | { ok: boolean; errors: string[]; results: import("../parley/dependency-proofs").DependencyVerificationResult[] }
      | null = null;

    if (receiptsData && publicKey) {
      const { verifyProcessChain } = await import("../parley/receipt-verifier");
      processResult = verifyProcessChain(receiptsData, publicKey.toString());
      if (payload) {
        const cs = (payload.vc as any)?.credentialSubject as Record<string, unknown> | undefined;
        const chainDigest = cs?.processProvenance && (cs.processProvenance as any).chainDigest;
        if (chainDigest && processResult.chainDigest !== chainDigest) {
          processResult = { ...processResult, chainValid: false };
        }
      }
    }

    if (evidenceSummary) {
      const { compareEvidenceChain } = await import("../evidence");
      const expectedChain = format === "JWT-VC"
        ? ((payload?.vc as any)?.credentialSubject as any)?.evidenceChain
        : doc?.marque?.evidenceChain;
      evidenceResult = compareEvidenceChain(expectedChain, evidenceSummary);
    }

    if (sourceDocumentHash) {
      const expectedHash = (payload?.vc as any)?.credentialSubject?.provenance?.sourceDocument as string | undefined;
      const errors: string[] = [];
      if (!payload) {
        errors.push("input binding requires JWT-VC input");
      }
      if (!expectedHash) {
        errors.push("missing provenance.sourceDocument in CPOE");
      } else if (expectedHash !== sourceDocumentHash) {
        errors.push("source document hash does not match provenance.sourceDocument");
      }
      inputBindingResult = {
        ok: errors.length === 0,
        errors,
        expected: expectedHash,
        actual: sourceDocumentHash,
      };
    }

    if (verifyDependencies) {
      if (!payload) {
        dependencyStatus = {
          ok: false,
          errors: ["Dependency verification requires JWT-VC input"],
          results: [],
        };
      } else {
        const { parseDependencyProofs, verifyDependencyChain } = await import("../parley/dependency-proofs");
        const parsed = parseDependencyProofs(payload);
        if (parsed.dependencies.length === 0) {
          dependencyStatus = {
            ok: false,
            errors: [...parsed.errors, "No dependencies declared in CPOE"],
            results: [],
          };
        } else {
          const results = await verifyDependencyChain(parsed.dependencies, { depth: dependencyDepth });
          const ok = parsed.errors.length === 0 && results.every((r) => r.ok);
          dependencyStatus = {
            ok,
            errors: parsed.errors,
            results,
          };
        }
      }
    }

    let policyResult: { ok: boolean; errors: string[] } | undefined;
    if (policyRequested) {
      if (!payload) {
        policyResult = { ok: false, errors: ["Policy checks require JWT-VC input"] };
      } else {
        const { evaluateVerificationPolicy } = await import("../parley/verification-policy");
        const mergedPolicy = {
          requireIssuer: requireIssuer ?? policyFromFile?.requireIssuer,
          requireFramework: requireFrameworks.length > 0 ? requireFrameworks : policyFromFile?.requireFramework,
          maxAgeDays: maxAgeDays ?? policyFromFile?.maxAgeDays,
          minScore: minScore ?? policyFromFile?.minScore,
          requireSource: requireSource ?? policyFromFile?.requireSource,
          requireSourceIdentity: requireSourceIdentities.length > 0
            ? requireSourceIdentities
            : policyFromFile?.requireSourceIdentity,
          requireToolAttestation: requireToolAttestation || policyFromFile?.requireToolAttestation,
          requireInputBinding: requireInputBinding || policyFromFile?.requireInputBinding,
          requireEvidenceChain: requireEvidenceChain || policyFromFile?.requireEvidenceChain,
          requireReceipts: requireReceipts || policyFromFile?.requireReceipts,
          requireScitt: requireScitt || policyFromFile?.requireScitt,
        };

        policyResult = evaluateVerificationPolicy(payload, mergedPolicy, {
          process: processResult
            ? {
              chainValid: processResult.chainValid,
              receiptsTotal: processResult.receiptsTotal,
              receiptsVerified: processResult.receiptsVerified,
              toolAttestedVerified: processResult.toolAttestedVerified,
              scittRegistered: processResult.scittRegistered,
            }
            : null,
          evidence: evidenceResult ? { ok: evidenceResult.ok, errors: evidenceResult.errors } : null,
          inputBinding: inputBindingResult
            ? { ok: inputBindingResult.ok, errors: inputBindingResult.errors }
            : null,
        });
      }
    }

    const response = {
      valid: result.valid,
      issuer: result.signedBy ?? null,
      trustTier: result.issuerTier ?? null,
      scope: result.scope ?? null,
      summary: result.summary ?? null,
      provenance: result.provenance ?? null,
      extensions: result.extensions ?? null,
      timestamps: {
        issuedAt: result.generatedAt ?? null,
        expiresAt: result.expiresAt ?? null,
      },
      reason: result.reason,
      format,
      policy: policyResult ?? null,
      process: processResult ?? null,
      evidence: evidenceResult ?? null,
      inputBinding: inputBindingResult ?? null,
      dependencies: dependencyStatus,
    };

    const ok = result.valid
      && (!policyResult || policyResult.ok)
      && (!processResult || processResult.chainValid)
      && (!evidenceResult || evidenceResult.ok)
      && (!inputBindingResult || inputBindingResult.ok)
      && (!dependencyStatus || dependencyStatus.ok);

    return {
      ok,
      format,
      label: target.label,
      response,
      result,
      policyResult,
      processResult,
      evidenceResult,
      inputBindingResult,
      dependencyStatus,
    };
  };

  const outcomes: VerificationOutcome[] = [];
  for (const target of targets) {
    outcomes.push(await verifyTarget(target));
  }

  const overallOk = outcomes.every((o) => o.ok);

  if (jsonOutput) {
    if (outcomes.length === 1 && !domain && !url) {
      process.stdout.write(JSON.stringify(outcomes[0].response ?? { error: outcomes[0].error }, null, 2));
      process.exit(overallOk ? 0 : 1);
    }

    process.stdout.write(JSON.stringify({
      ...(domain ? {
        domain,
        source: discoverySource,
        trustTxtUrl,
        catalogUrl,
        ...(catalogWarning ? { catalogWarning } : {}),
      } : {}),
      ...(url ? { url } : {}),
      results: outcomes.map((o) => ({
        label: o.label,
        ok: o.ok,
        ...(o.error ? { error: o.error } : {}),
        ...(o.response ? o.response : {}),
      })),
    }, null, 2));
    process.exit(overallOk ? 0 : 1);
  }

  if (outcomes.length > 1) {
    console.log("CORSAIR VERIFY");
    console.log("==============");
    if (domain) {
      console.log(`  Domain:   ${domain}`);
      if (discoverySource) console.log(`  Source:   ${discoverySource}`);
      if (trustTxtUrl) console.log(`  trust.txt: ${trustTxtUrl}`);
      if (catalogUrl) console.log(`  Catalog:  ${catalogUrl}`);
      if (catalogWarning) console.log(`  Warning:  ${catalogWarning}`);
    }
    if (url) {
      console.log(`  URL:      ${url}`);
    }
    console.log("");
    for (const outcome of outcomes) {
      if (outcome.error) {
        console.log(`  ✗ ${outcome.label} — ${outcome.error}`);
        continue;
      }
      const summary = (outcome.response?.summary as any) || null;
      const score = summary?.overallScore !== undefined ? `${summary.overallScore}%` : "n/a";
      console.log(`  ${outcome.ok ? "✓" : "✗"} ${outcome.label} (${score})`);
      if (!outcome.ok && outcome.response?.reason) {
        console.log(`    Reason: ${outcome.response.reason}`);
      }
    }
    process.exit(overallOk ? 0 : 1);
  }

  const outcome = outcomes[0];
  if (!outcome || outcome.error) {
    console.error("VERIFICATION FAILED");
    if (outcome?.error) console.error(`  Reason: ${outcome.error}`);
    process.exit(1);
  }

  const result = outcome.result;
  const format = outcome.format;
  const policyResult = outcome.policyResult;
  const processResult = outcome.processResult;
  const evidenceResult = outcome.evidenceResult;
  const inputBindingResult = outcome.inputBindingResult;
  const dependencyStatus = outcome.dependencyStatus;

  if (result.valid) {
    console.log("VERIFIED");
    console.log(`  Signed by: ${result.signedBy || "Unknown"}`);
    console.log(`  Format:    ${format}`);
    console.log(`  Scope:     ${result.scope || "Unknown"}`);
    if (result.summary) {
      console.log(`  Summary:   ${result.summary.controlsTested} tested, ${result.summary.controlsPassed} passed, ${result.summary.controlsFailed} failed (${result.summary.overallScore}%)`);
    } else {
      console.log("  Summary:   unavailable");
    }
    if (result.provenance) {
      const identity = result.provenance.sourceIdentity || "unknown";
      const date = result.provenance.sourceDate ? `, ${result.provenance.sourceDate}` : "";
      console.log(`  Provenance: ${result.provenance.source} (${identity}${date})`);
    } else {
      console.log("  Provenance: unknown");
    }
    if (policyResult) {
      if (policyResult.ok) {
        console.log("  Policy:    PASS");
      } else {
        console.log("  Policy:    FAIL");
        for (const err of policyResult.errors) {
          console.log(`    - ${err}`);
        }
      }
    }
    if (processResult) {
      console.log(`  Process:   ${processResult.chainValid ? "VERIFIED" : "FAILED"} (${processResult.receiptsVerified}/${processResult.receiptsTotal})`);
    }
    if (evidenceResult) {
      console.log(`  Evidence:  ${evidenceResult.ok ? "VERIFIED" : "FAILED"}`);
      if (!evidenceResult.ok) {
        for (const err of evidenceResult.errors) {
          console.log(`    - ${err}`);
        }
      }
    }
    if (inputBindingResult) {
      console.log(`  Input:     ${inputBindingResult.ok ? "VERIFIED" : "FAILED"}`);
      if (!inputBindingResult.ok) {
        for (const err of inputBindingResult.errors) {
          console.log(`    - ${err}`);
        }
      }
    }
    if (dependencyStatus) {
      const failed = dependencyStatus.results.filter((r) => !r.ok);
      console.log(`  Dependencies: ${dependencyStatus.ok ? "VERIFIED" : "FAILED"} (${dependencyStatus.results.length - failed.length}/${dependencyStatus.results.length})`);
      if (dependencyStatus.errors.length > 0) {
        for (const err of dependencyStatus.errors) {
          console.log(`    - ${err}`);
        }
      }
      if (failed.length > 0) {
        for (const dep of failed) {
          console.log(`    - ${dep.dependency.issuer || "unknown"} (${dep.dependency.cpoe || "no url"}): ${dep.reason || "verification failed"}`);
        }
      }
    }
    process.exit(overallOk ? 0 : 1);
  } else {
    console.error("VERIFICATION FAILED");
    console.error(`  Reason: ${result.reason}`);
    process.exit(1);
  }
}

function stripSdJwt(jwt: string): string {
  const tildeIndex = jwt.indexOf("~");
  if (tildeIndex === -1) return jwt;
  return jwt.slice(0, tildeIndex);
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const baseJwt = stripSdJwt(jwt);
    const parts = baseJwt.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString();
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
