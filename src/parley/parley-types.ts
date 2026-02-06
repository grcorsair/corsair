/**
 * Parley Protocol Types
 *
 * Types for the Parley trust exchange protocol: publishing, subscribing,
 * and auto-bundling CPOE documents.
 */

import type { CPOEIssuer } from "./cpoe-types";

/**
 * A Parley exchange endpoint for publishing/receiving CPOEs.
 */
export interface ParleyEndpoint {
  /** Base URL of the Parley exchange server */
  baseUrl: string;

  /** API key for authentication */
  apiKey: string;
}

/**
 * Request to publish a CPOE to the exchange.
 */
export interface ParleyPublishRequest {
  /** The CPOE document to publish */
  cpoe: unknown;

  /** Whether to send notifications to subscribers */
  notify?: boolean;
}

/**
 * Webhook subscription for receiving new CPOEs.
 */
export interface ParleySubscription {
  /** Unique subscriber identifier */
  subscriberId: string;

  /** Webhook URL to receive notifications */
  webhookUrl: string;

  /** HMAC secret for webhook verification */
  hmacSecret: string;

  /** Optional framework filters (only receive CPOEs covering these) */
  frameworks?: string[];
}

/**
 * Configuration for the AutoBundler.
 */
export interface ParleyConfig {
  /** Optional exchange endpoint for publishing */
  endpoint?: ParleyEndpoint;

  /** Local output directory for CPOE files */
  localOutputDir?: string;

  /** Providers to assess */
  providers: {
    providerId: string;
    targetId: string;
    source: "fixture" | "aws";
  }[];

  /** CPOE issuer identity */
  issuer: CPOEIssuer;

  /** Whether to run Admiral evaluation */
  admiralEnabled?: boolean;

  /** CPOE expiry in days (default: 7) */
  expiryDays?: number;
}

/**
 * Result of an auto-bundle operation.
 */
export interface BundleResult {
  /** Providers that were assessed */
  providersRun: string[];

  /** Number of controls tested */
  controlsTested: number;

  /** Number of controls passed */
  controlsPassed: number;

  /** Whether a new CPOE was generated (false if no changes detected) */
  cpoeGenerated: boolean;

  /** Path to the local CPOE file (if saved locally) */
  localPath?: string;

  /** Whether the CPOE was published to the exchange */
  published: boolean;

  /** Overall assessment score */
  overallScore: number;
}
