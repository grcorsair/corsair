/**
 * Auto-Bundler — Automated MARQUE Generation Pipeline
 *
 * Runs the full Corsair assessment pipeline for configured providers,
 * generates a signed MARQUE document, and optionally publishes it.
 *
 * Pipeline per provider:
 *   RECON → Threat Model → MARK → RAID → PLUNDER → CHART
 *
 * Then: Combine results → Quartermaster (optional) → Generate MARQUE → Publish/Save
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

import { Corsair } from "../engine/index";
import { MarqueGenerator, type MarqueGeneratorInput } from "./marque-generator";
import { MarqueKeyManager } from "./marque-key-manager";
import { ParleyClient } from "./parley-client";
import type { MarqueDocument } from "./marque-types";
import type { ParleyConfig, BundleResult } from "./parley-types";
import type {
  MarkResult,
  RaidResult,
  ChartResult,
  ThreatModelResult,
} from "../types";

export class AutoBundler {
  private config: ParleyConfig;
  private corsair: Corsair;
  private keyManager: MarqueKeyManager;
  private generator: MarqueGenerator;

  constructor(config: ParleyConfig, corsair: Corsair, keyManager: MarqueKeyManager) {
    this.config = config;
    this.corsair = corsair;
    this.keyManager = keyManager;
    this.generator = new MarqueGenerator(keyManager, {
      expiryDays: config.expiryDays ?? 7,
    });
  }

  /**
   * Run the full assessment pipeline and generate a MARQUE.
   */
  async bundle(): Promise<BundleResult> {
    const allMarkResults: MarkResult[] = [];
    const allRaidResults: RaidResult[] = [];
    const allChartResults: ChartResult[] = [];
    const allEvidencePaths: string[] = [];
    const providersRun: string[] = [];
    let combinedThreatModel: ThreatModelResult | undefined;

    // Run pipeline for each configured provider
    for (const providerConfig of this.config.providers) {
      try {
        const result = await this.runProviderPipeline(providerConfig);

        providersRun.push(providerConfig.providerId);
        allMarkResults.push(...result.markResults);
        allRaidResults.push(...result.raidResults);
        allChartResults.push(...result.chartResults);
        allEvidencePaths.push(...result.evidencePaths);

        if (result.threatModel) {
          combinedThreatModel = result.threatModel;
        }
      } catch (error) {
        console.warn(
          `AutoBundler: Provider ${providerConfig.providerId} failed:`,
          error instanceof Error ? error.message : String(error)
        );
        // Continue with other providers
      }
    }

    // Build MARQUE input
    const input: MarqueGeneratorInput = {
      markResults: allMarkResults,
      raidResults: allRaidResults,
      chartResults: allChartResults,
      evidencePaths: allEvidencePaths,
      threatModel: combinedThreatModel,
      issuer: this.config.issuer,
      providers: providersRun,
    };

    // Diff detection: check if results changed
    const currentHash = this.hashResults(input);
    const previousHash = this.loadPreviousHash();

    if (currentHash === previousHash) {
      return {
        providersRun,
        controlsTested: 0,
        controlsPassed: 0,
        marqueGenerated: false,
        published: false,
        overallScore: 0,
      };
    }

    // Generate MARQUE
    const marque = await this.generator.generate(input);

    // Save locally
    let localPath: string | undefined;
    if (this.config.localOutputDir) {
      localPath = this.saveMARQUELocally(marque);
      this.saveHash(currentHash);
    }

    // Publish if endpoint configured
    let published = false;
    if (this.config.endpoint) {
      try {
        const client = new ParleyClient(this.config.endpoint);
        await client.publish(marque);
        published = true;
      } catch (error) {
        console.warn(
          "AutoBundler: Publish failed:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Compute summary stats
    const summary = marque.marque.summary;

    return {
      providersRun,
      controlsTested: summary.controlsTested,
      controlsPassed: summary.controlsPassed,
      marqueGenerated: true,
      localPath,
      published,
      overallScore: summary.overallScore,
    };
  }

  /**
   * Run the assessment pipeline for a single provider.
   */
  private async runProviderPipeline(providerConfig: {
    providerId: string;
    targetId: string;
    source: "fixture" | "aws";
  }): Promise<{
    markResults: MarkResult[];
    raidResults: RaidResult[];
    chartResults: ChartResult[];
    evidencePaths: string[];
    threatModel?: ThreatModelResult;
  }> {
    const { providerId, targetId, source } = providerConfig;

    // RECON
    const recon = await this.corsair.recon(targetId, { source });

    // Threat Model
    const threatModel = await this.corsair.threatModel(
      recon.snapshot as Record<string, unknown>,
      providerId
    );

    // Auto-MARK (threat-driven expectations)
    const autoMarkResult = await this.corsair.autoMark(
      recon.snapshot as Record<string, unknown>,
      providerId
    );

    // Auto-RAID
    const raidOptionsList = this.corsair.autoRaid(
      recon.snapshot as Record<string, unknown>,
      threatModel
    );

    const raidResults: RaidResult[] = [];
    for (const opts of raidOptionsList) {
      const raid = await this.corsair.raid(recon.snapshot as Record<string, unknown>, opts);
      raidResults.push(raid);
    }

    // PLUNDER
    const evidencePaths: string[] = [];
    const evidenceDir = this.config.localOutputDir || "/tmp/corsair-autobundle";
    const evidencePath = join(evidenceDir, `${providerId}-evidence.jsonl`);
    if (!existsSync(dirname(evidencePath))) {
      mkdirSync(dirname(evidencePath), { recursive: true });
    }

    for (const raid of raidResults) {
      await this.corsair.plunder(raid, evidencePath);
    }
    if (raidResults.length > 0) {
      evidencePaths.push(evidencePath);
    }

    // CHART
    const chartResult = await this.corsair.chart(autoMarkResult.findings, { providerId });

    return {
      markResults: [autoMarkResult],
      raidResults,
      chartResults: [chartResult],
      evidencePaths,
      threatModel,
    };
  }

  /**
   * Check if results have changed since last bundle.
   */
  private hashResults(input: MarqueGeneratorInput): string {
    const data = JSON.stringify({
      providers: input.providers.sort(),
      markFindings: input.markResults
        .flatMap((m) => m.findings.map((f) => `${f.field}:${f.expected}:${f.actual}:${f.drift}`))
        .sort(),
      raidResults: input.raidResults
        .map((r) => `${r.vector}:${r.success}:${r.controlsHeld}`)
        .sort(),
      driftDetected: input.markResults.some((m) => m.driftDetected),
    });
    return createHash("sha256").update(data).digest("hex");
  }

  private loadPreviousHash(): string | null {
    const hashPath = join(this.config.localOutputDir || "/tmp/corsair-autobundle", ".last-hash");
    if (!existsSync(hashPath)) return null;
    return readFileSync(hashPath, "utf-8").trim();
  }

  private saveHash(hash: string): void {
    const hashDir = this.config.localOutputDir || "/tmp/corsair-autobundle";
    if (!existsSync(hashDir)) mkdirSync(hashDir, { recursive: true });
    writeFileSync(join(hashDir, ".last-hash"), hash);
  }

  private saveMARQUELocally(marque: MarqueDocument): string {
    const dir = this.config.localOutputDir!;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = join(dir, `marque-${timestamp}.json`);
    writeFileSync(filePath, JSON.stringify(marque, null, 2));
    return filePath;
  }
}
