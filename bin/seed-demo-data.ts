#!/usr/bin/env bun
/**
 * Seed Demo Data — Generate real signed CPOEs from fixture evidence files.
 *
 * Every entry in the demo SCITT feed is a REAL signed CPOE. Even our demo data
 * is cryptographically verifiable. That's the whole point.
 *
 * Usage:
 *   bun run bin/seed-demo-data.ts [--key-dir ./keys]
 *
 * Output:
 *   apps/web/public/demo-scitt-entries.json  — SCITTListEntry[] for web fallback
 *   apps/web/public/demo-cpoes/              — Signed JWT files
 */

import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { signEvidence, type EvidenceFormat } from "../src/sign/sign-core";
import { MarqueKeyManager } from "../src/parley/marque-key-manager";

// =============================================================================
// CONFIGURATION
// =============================================================================

const ROOT = join(import.meta.dir, "..");
const FIXTURES_DIR = join(ROOT, "fixtures");
const WEB_PUBLIC = join(ROOT, "apps", "web", "public");
const CPOE_OUT_DIR = join(WEB_PUBLIC, "demo-cpoes");
const ENTRIES_OUT = join(WEB_PUBLIC, "demo-scitt-entries.json");

/** Map each evidence file to a fictional issuer DID, scope, and provenance override */
const EVIDENCE_FILES: Array<{
  file: string;
  format?: EvidenceFormat;
  source?: "soc2" | "iso27001" | "pentest" | "manual" | "json" | "tool";
  did: string;
  scope: string;
  daysAgo: number;
  provenanceOverride?: { source: string; sourceIdentity: string };
}> = [
  {
    file: "generic-evidence.json",
    format: "generic",
    source: "tool",
    did: "did:web:cloudbank.io",
    scope: "AWS Production — Cloud Infrastructure Controls",
    daysAgo: 1,
  },
  {
    file: "generic-evidence.json",
    format: "generic",
    source: "tool",
    did: "did:web:retailcorp.com",
    scope: "PCI DSS — Payment Infrastructure Hardening",
    daysAgo: 2,
    provenanceOverride: { source: "tool", sourceIdentity: "Compliance Runner" },
  },
  {
    file: "generic-evidence.json",
    format: "generic",
    source: "tool",
    did: "did:web:devshipco.dev",
    scope: "Container Security — Production Images",
    daysAgo: 3,
    provenanceOverride: { source: "tool", sourceIdentity: "Vuln Scanner" },
  },
  {
    file: "generic-evidence.json",
    format: "generic",
    source: "tool",
    did: "did:web:healthsafe.ai",
    scope: "HIPAA — AWS Environment Security Posture",
    daysAgo: 5,
    provenanceOverride: { source: "tool", sourceIdentity: "Cloud Posture API" },
  },
  {
    file: "generic-evidence.json",
    format: "generic",
    source: "iso27001",
    did: "did:web:govcloud.org",
    scope: "ISO 27001 — Information Security Management",
    daysAgo: 7,
    provenanceOverride: { source: "auditor", sourceIdentity: "Coalfire ISO Audit Team" },
  },
  {
    file: "generic-evidence.json",
    format: "generic",
    source: "soc2",
    did: "did:web:fintrust.co",
    scope: "SOC 2 Type II — Trust Services Criteria",
    daysAgo: 10,
    provenanceOverride: { source: "auditor", sourceIdentity: "Deloitte LLP" },
  },
  {
    file: "generic-evidence.json",
    format: "generic",
    source: "tool",
    did: "did:web:appsec-team.io",
    scope: "SAST — Application Code Security Review",
    daysAgo: 12,
    provenanceOverride: { source: "tool", sourceIdentity: "SAST Engine" },
  },
  {
    file: "generic-evidence.json",
    format: "generic",
    source: "manual",
    did: "did:web:acme-corp.com",
    scope: "Internal Security Assessment — Q1 2026",
    daysAgo: 14,
    provenanceOverride: { source: "self", sourceIdentity: "Acme Corp Security Team" },
  },
];

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const keyDirArg = process.argv.find((a) => a.startsWith("--key-dir="))?.split("=")[1]
    ?? (process.argv.includes("--key-dir") ? process.argv[process.argv.indexOf("--key-dir") + 1] : undefined);

  const keyDir = keyDirArg ? join(ROOT, keyDirArg) : join(ROOT, ".demo-keys");
  const keyManager = new MarqueKeyManager(keyDir);

  // Generate demo keypair if none exists
  const existing = await keyManager.loadKeypair();
  if (!existing) {
    console.log(`Generating demo Ed25519 keypair in ${keyDir}...`);
    await keyManager.generateKeypair();
  }

  // Ensure output directories
  mkdirSync(CPOE_OUT_DIR, { recursive: true });

  const entries: Array<Record<string, unknown>> = [];
  let treeSize = 0;

console.log("\nSigning fixture evidence files as CPOEs...\n");

  for (const config of EVIDENCE_FILES) {
    const filePath = join(FIXTURES_DIR, config.file);
    if (!existsSync(filePath)) {
      console.log(`  SKIP: ${config.file} (not found)`);
      continue;
    }

    try {
      const raw = await Bun.file(filePath).text();
      const evidence = JSON.parse(raw);

      const result = await signEvidence(
        {
          evidence,
          format: config.format,
          source: config.source,
          did: config.did,
          scope: config.scope,
          expiryDays: 180,
        },
        keyManager,
      );

      treeSize++;

      // Write JWT
      const jwtFile = config.file.replace(".json", ".jwt");
      const jwtPath = join(CPOE_OUT_DIR, jwtFile);
      await Bun.write(jwtPath, result.jwt);

      // Build SCITT entry — extract provenance from JWT payload (source of truth)
      // The VC generator maps raw source to self/tool/auditor via sourceToProvenanceType
      const vcProvenance = result.credentialSubject?.provenance as
        | { source?: string; sourceIdentity?: string }
        | undefined;

      const registrationTime = new Date(
        Date.now() - config.daysAgo * 24 * 60 * 60 * 1000,
      ).toISOString();

      const entry = {
        entryId: `scitt-${result.marqueId}`,
        registrationTime,
        treeSize,
        issuer: config.did,
        scope: config.scope,
        provenance: config.provenanceOverride ?? {
          source: vcProvenance?.source ?? "self",
          sourceIdentity: vcProvenance?.sourceIdentity ?? result.provenance.sourceIdentity,
        },
        summary: result.summary,
      };

      entries.push(entry);

      const domain = config.did.replace("did:web:", "");
      const source = entry.provenance.source;
      const score = result.summary.overallScore;
      console.log(
        `  ${domain.padEnd(22)} ${config.format?.padEnd(24) ?? "auto".padEnd(24)} ` +
        `${source.padEnd(8)} ${String(score).padStart(3)}% ` +
        `(${result.summary.controlsTested} controls)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR: ${config.file}: ${msg}`);
    }
  }

  // Write demo SCITT entries JSON
  await Bun.write(ENTRIES_OUT, JSON.stringify(entries, null, 2));

  console.log(`\nDone. ${entries.length} CPOEs signed.`);
  console.log(`  Entries: ${ENTRIES_OUT}`);
  console.log(`  CPOEs:   ${CPOE_OUT_DIR}/`);
  console.log(`\nEvery entry is cryptographically verifiable. Even the demo data.\n`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
