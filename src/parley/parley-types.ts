/**
 * Parley Protocol Types
 *
 * Types for the Parley trust exchange protocol: publishing, subscribing,
 * and auto-bundling MARQUE documents.
 */

import type { MarqueIssuer } from "./marque-types";
import type { FlagshipConfig } from "../flagship/flagship-types";

/**
 * A Parley exchange endpoint for publishing/receiving MARQUEs.
 */
export interface ParleyEndpoint {
  /** Base URL of the Parley exchange server */
  baseUrl: string;

  /** API key for authentication */
  apiKey: string;
}

/**
 * Request to publish a MARQUE to the exchange.
 */
export interface ParleyPublishRequest {
  /** The MARQUE document to publish */
  marque: unknown;

  /** Whether to send notifications to subscribers */
  notify?: boolean;
}

/**
 * Webhook subscription for receiving new MARQUEs.
 */
export interface ParleySubscription {
  /** Unique subscriber identifier */
  subscriberId: string;

  /** Webhook URL to receive notifications */
  webhookUrl: string;

  /** HMAC secret for webhook verification */
  hmacSecret: string;

  /** Optional framework filters (only receive MARQUEs covering these) */
  frameworks?: string[];
}

/**
 * Configuration for the AutoBundler.
 */
export interface ParleyConfig {
  /** Optional exchange endpoint for publishing */
  endpoint?: ParleyEndpoint;

  /** Local output directory for MARQUE files */
  localOutputDir?: string;

  /** Providers to assess */
  providers: {
    providerId: string;
    targetId: string;
    source: "fixture" | "aws";
  }[];

  /** MARQUE issuer identity */
  issuer: MarqueIssuer;

  /** Whether to run Quartermaster evaluation */
  quartermasterEnabled?: boolean;

  /** MARQUE expiry in days (default: 90) */
  expiryDays?: number;

  /** FLAGSHIP (SSF/SET/CAEP) configuration for real-time notifications */
  flagship?: FlagshipConfig;
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

  /** Whether a new MARQUE was generated (false if no changes detected) */
  marqueGenerated: boolean;

  /** Path to the local MARQUE file (if saved locally) */
  localPath?: string;

  /** Whether the MARQUE was published to the exchange */
  published: boolean;

  /** Overall assessment score */
  overallScore: number;

  /** FLAGSHIP stream ID if SSF notifications were sent */
  flagshipStreamId?: string;
}
