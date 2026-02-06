/**
 * Parley Client — Trust Exchange Interface
 *
 * HTTP client for publishing and retrieving CPOE documents
 * from a Parley exchange server.
 *
 * Uses Bun's built-in fetch — no external HTTP dependencies.
 */

import type { CPOEDocument } from "./cpoe-types";
import { CPOEVerifier, type CPOEVerificationResult } from "./cpoe-verifier";
import type { ParleyEndpoint, ParleySubscription } from "./parley-types";

export class ParleyClient {
  private endpoint: ParleyEndpoint;

  constructor(endpoint: ParleyEndpoint) {
    this.endpoint = endpoint;
  }

  /**
   * Publish a CPOE document to the exchange.
   */
  async publish(cpoe: CPOEDocument, notify: boolean = true): Promise<{ published: boolean; id: string }> {
    const url = `${this.endpoint.baseUrl}/cpoe`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.endpoint.apiKey}`,
      },
      body: JSON.stringify({ cpoe, notify }),
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
    return { published: true, id: result.id || cpoe.cpoe.id };
  }

  /**
   * Get the latest CPOE from a specific issuer.
   */
  async getLatest(issuerId: string): Promise<CPOEDocument | null> {
    const url = `${this.endpoint.baseUrl}/cpoe/latest?issuer=${encodeURIComponent(issuerId)}`;

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

    return response.json() as Promise<CPOEDocument>;
  }

  /**
   * Subscribe to receive CPOE updates via webhook.
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
   * Verify a CPOE document using the provided public keys.
   */
  verify(cpoe: CPOEDocument, publicKeys: Buffer[]): CPOEVerificationResult {
    const verifier = new CPOEVerifier(publicKeys);
    return verifier.verify(cpoe);
  }
}
