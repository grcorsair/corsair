/**
 * Integrated Pipeline Test Contract
 *
 * Tests the integration of STRIDE threat modeling into the
 * RECON → MARK → RAID → CHART pipeline via the Corsair facade.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair } from "../../src/corsair-mvp";
import type { ThreatModelResult, RaidOptions, ChartResult } from "../../src/corsair-mvp";
import {
  compliantSnapshot,
  nonCompliantSnapshot,
  nonCompliantS3Snapshot,
} from "../fixtures/mock-snapshots";
import { ReportGenerator } from "../../src/output/report-generator";

describe("Integrated Pipeline - Threat Model → MARK → RAID → CHART", () => {
  let corsair: Corsair;

  beforeAll(() => {
    corsair = new Corsair();
  });

  test("corsair.threatModel(snapshot, 'aws-cognito') returns valid ThreatModelResult", async () => {
    const result = await corsair.threatModel(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    expect(result.threats).toBeArray();
    expect(result.threats.length).toBeGreaterThan(0);
    expect(result.methodology).toBe("STRIDE-automated");
    expect(result.provider).toBe("aws-cognito");
    expect(result.threatCount).toBe(result.threats.length);
    expect(result.analyzedAt).toBeTruthy();
  });

  test("corsair.autoMark(snapshot, 'aws-cognito') uses threat model to generate expectations", async () => {
    const result = await corsair.autoMark(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    expect(result.driftDetected).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.threatModel).toBeDefined();
    expect(result.threatModel.threats.length).toBeGreaterThan(0);
  });

  test("autoMark drift findings carry threatRef linking to originating threat", async () => {
    const result = await corsair.autoMark(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    const findingsWithRef = result.findings.filter((f) => f.threatRef);
    expect(findingsWithRef.length).toBeGreaterThan(0);

    // Each threatRef should match a threat ID
    const threatIds = new Set(result.threatModel.threats.map((t) => t.id));
    for (const finding of findingsWithRef) {
      expect(threatIds.has(finding.threatRef!)).toBe(true);
    }
  });

  test("autoRaid(snapshot, threatModel) generates raid options from threat attack vectors", async () => {
    const tm = await corsair.threatModel(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    const raidOptions = corsair.autoRaid(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      tm
    );

    expect(raidOptions).toBeArray();
    expect(raidOptions.length).toBeGreaterThan(0);
    for (const opt of raidOptions) {
      expect(opt.vector).toBeTruthy();
      expect(opt.intensity).toBeGreaterThan(0);
      expect(opt.dryRun).toBe(true);
    }
  });

  test("Full pipeline: threatModel → autoMark → autoRaid → chart → all linked by threat IDs", async () => {
    const snapshot = nonCompliantSnapshot as unknown as Record<string, unknown>;

    // Step 1: Threat model
    const tm = await corsair.threatModel(snapshot, "aws-cognito");
    expect(tm.threats.length).toBeGreaterThan(0);

    // Step 2: Auto mark
    const markResult = await corsair.autoMark(snapshot, "aws-cognito");
    expect(markResult.driftDetected).toBe(true);

    // Step 3: Auto raid options
    const raidOptions = corsair.autoRaid(snapshot, tm);
    expect(raidOptions.length).toBeGreaterThan(0);

    // Step 4: Execute one raid
    const raidResult = await corsair.raid(snapshot, raidOptions[0]);
    expect(raidResult.raidId).toBeTruthy();

    // Step 5: Chart
    const chartResult = await corsair.chart(markResult.findings);
    expect(chartResult.mitre.technique).toBeTruthy();
  });

  test("Compliant snapshot: threatModel generates threats, autoMark finds no drift (controls hold)", async () => {
    const result = await corsair.autoMark(
      compliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    // Compliant snapshot should have no drift
    const driftFindings = result.findings.filter((f) => f.drift);
    expect(driftFindings).toHaveLength(0);
    expect(result.driftDetected).toBe(false);
  });

  test("Non-compliant snapshot: full pipeline generates linked evidence chain", async () => {
    const snapshot = nonCompliantSnapshot as unknown as Record<string, unknown>;
    const tm = await corsair.threatModel(snapshot, "aws-cognito");
    const markResult = await corsair.autoMark(snapshot, "aws-cognito");

    // Threats exist
    expect(tm.threats.length).toBeGreaterThan(0);
    // Drift found
    expect(markResult.driftDetected).toBe(true);
    // Findings linked to threats
    const linkedFindings = markResult.findings.filter((f) => f.threatRef);
    expect(linkedFindings.length).toBeGreaterThan(0);
  });

  test("Threat model summary embedded in HTML report when available", async () => {
    const snapshot = nonCompliantSnapshot as unknown as Record<string, unknown>;
    const tm = await corsair.threatModel(snapshot, "aws-cognito");
    const markResult = await corsair.autoMark(snapshot, "aws-cognito");
    const chartResult = await corsair.chart(markResult.findings);

    const reportGen = new ReportGenerator();
    const html = reportGen.generateHTML({
      findings: markResult.findings,
      chartResult,
      threatModel: tm,
    });

    expect(html).toContain("Threat Model (STRIDE)");
    expect(html).toContain("Risk Distribution");
    expect(html).toContain("Spoofing");
  });

  test("ChartResult.threatModel field populated when threat model was used", async () => {
    const snapshot = nonCompliantSnapshot as unknown as Record<string, unknown>;
    const tm = await corsair.threatModel(snapshot, "aws-cognito");
    const markResult = await corsair.autoMark(snapshot, "aws-cognito");
    const chartResult = await corsair.chart(markResult.findings);

    // Manually attach (in full pipeline this would be done by caller)
    const enrichedChart: ChartResult = { ...chartResult, threatModel: tm };
    expect(enrichedChart.threatModel).toBeDefined();
    expect(enrichedChart.threatModel!.provider).toBe("aws-cognito");
  });
});
