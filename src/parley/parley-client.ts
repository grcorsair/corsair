/**
 * Parley Client — Trust Exchange Interface
 *
 * HTTP client for publishing and retrieving MARQUE documents
 * from a Parley exchange server.
 *
 * Uses Bun's built-in fetch — no external HTTP dependencies.
 */

import type { MarqueDocument } from "./marque-types";
import { MarqueVerifier, type MarqueVerificationResult } from "./marque-verifier";
import type { ParleyEndpoint, ParleySubscription } from "./parley-types";
import type { SSFStreamConfig } from "../flagship/flagship-types";
import { FlagshipClient } from "../flagship/flagship-client";

export class ParleyClient {
  private endpoint: ParleyEndpoint;
  private flagship?: FlagshipClient;

  constructor(endpoint: ParleyEndpoint, flagship?: { baseUrl: string; apiKey: string }) {
    this.endpoint = endpoint;
    if (flagship) {
      this.flagship = new FlagshipClient(flagship.baseUrl, flagship.apiKey);
    }
  }

  /**
   * Publish a MARQUE document to the exchange.
   */
  async publish(marque: MarqueDocument, notify: boolean = true): Promise<{ published: boolean; id: string }> {
    const url = `${this.endpoint.baseUrl}/marque`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.endpoint.apiKey}`,
      },
      body: JSON.stringify({ marque, notify }),
    });

    if (response.status === 401) {
      throw new Error("Parley: Invalid API key (401 Unauthorized)");
    }

    if (response.status === 429) {
      throw new Error("Parley: Rate limit exceeded (429). Retry later.");
    }

    if (!response.ok) {
      throw new Error(`Parley: Publish failed with status ${response.status}`);
    }

    const result = await response.json() as { id: string };
    return { published: true, id: result.id || marque.marque.id };
  }

  /**
   * Get the latest MARQUE from a specific issuer.
   */
  async getLatest(issuerId: string): Promise<MarqueDocument | null> {
    const url = `${this.endpoint.baseUrl}/marque/latest?issuer=${encodeURIComponent(issuerId)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.endpoint.apiKey}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Parley: GetLatest failed with status ${response.status}`);
    }

    return response.json() as Promise<MarqueDocument>;
  }

  /**
   * Subscribe to receive MARQUE updates via webhook.
   */
  async subscribe(subscription: ParleySubscription): Promise<{ subscribed: boolean }> {
    const url = `${this.endpoint.baseUrl}/subscriptions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.endpoint.apiKey}`,
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      throw new Error(`Parley: Subscribe failed with status ${response.status}`);
    }

    return { subscribed: true };
  }

  /**
   * Verify a MARQUE document or JWT-VC using the provided public keys.
   */
  async verify(marque: MarqueDocument | string, publicKeys: Buffer[]): Promise<MarqueVerificationResult> {
    const verifier = new MarqueVerifier(publicKeys);
    return verifier.verify(marque);
  }

  /**
   * Push a signed SET to a FLAGSHIP receiver endpoint.
   * Requires flagship client to be configured.
   */
  async pushEvent(endpoint: string, set: string): Promise<{ delivered: boolean }> {
    if (!this.flagship) {
      throw new Error("Parley: FLAGSHIP client not configured");
    }
    return this.flagship.pushEvent(endpoint, set);
  }

  /**
   * Poll for pending SET tokens from a FLAGSHIP stream.
   * Requires flagship client to be configured.
   */
  async pollEvents(streamId: string): Promise<{ sets: string[] }> {
    if (!this.flagship) {
      throw new Error("Parley: FLAGSHIP client not configured");
    }
    return this.flagship.pollEvents(streamId);
  }
}
