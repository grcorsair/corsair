#!/usr/bin/env bun
/**
 * Demo: Full Corsair MVP Pipeline
 * RECON → MARK → RAID → PLUNDER → CHART → ESCAPE
 */

import { Corsair } from "./src/corsair-mvp";

console.log("🏴‍☠️ CORSAIR MVP - Full Pipeline Demo\n");

const corsair = new Corsair();

// 1. RECON: Observe Cognito pool without modification
console.log("━━━ 1. RECON ━━━━━━━━━━━━━━━━━━━━━━━━━━");
const snapshot = corsair.recon("tests/fixtures/cognito_pool_mfa_optional.json");
console.log(`MFA Config: ${snapshot.mfaConfiguration}`);
console.log(`User Count: ${snapshot.userCount}`);
console.log(`Pool ID: ${snapshot.poolId}\n`);

// 2. MARK: Identify drift
console.log("━━━ 2. MARK ━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const expectations = {
  mfaRequired: true,
  mfaConfiguration: "ON" as const,
  passwordPolicy: {
    minimumLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
  }
};
const driftFindings = corsair.mark(snapshot, expectations);
console.log(`Drift Detected: ${driftFindings.length > 0}`);
driftFindings.forEach(finding => {
  console.log(`  - ${finding.severity}: ${finding.finding}`);
});
console.log();

// 3. RAID: Execute controlled chaos
console.log("━━━ 3. RAID ━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const raidResult = corsair.raid({
  target: "us-east-1_TEST123",
  attackVector: "mfa-bypass",
  blastRadius: "low",
  chaosIntensity: 1
});
console.log(`Attack: ${raidResult.attackVector}`);
console.log(`Outcome: ${raidResult.outcome}`);
console.log(`Bypass Successful: ${raidResult.bypassSuccessful}`);
console.log(`Evidence Count: ${raidResult.evidenceArtifacts.length}\n`);

// 4. PLUNDER: Extract evidence with JSONL
console.log("━━━ 4. PLUNDER ━━━━━━━━━━━━━━━━━━━━━━━━");
const evidencePath = corsair.plunder(raidResult, "/tmp/corsair-evidence.jsonl");
console.log(`Evidence Path: ${evidencePath}`);
console.log(`Chain Verified: ${corsair.verifyHashChain(evidencePath)}\n`);

// 5. CHART: Map to compliance frameworks
console.log("━━━ 5. CHART ━━━━━━━━━━━━━━━━━━━━━━━━━━");
const complianceMappings = corsair.chart(raidResult);
console.log(`MITRE Technique: ${complianceMappings.mitre.technique}`);
console.log(`NIST Controls: ${complianceMappings.nist.controls.join(", ")}`);
console.log(`SOC2 Criteria: ${complianceMappings.soc2.criteria.join(", ")}\n`);

// 6. ESCAPE: Clean rollback
console.log("━━━ 6. ESCAPE ━━━━━━━━━━━━━━━━━━━━━━━━━");
const cleanupOps = [
  () => console.log("  ✓ Deleted temp test user"),
  () => console.log("  ✓ Restored MFA settings"),
  () => console.log("  ✓ Cleared device keys")
];
corsair.escape(cleanupOps);
console.log("\n✅ Full pipeline complete!");
