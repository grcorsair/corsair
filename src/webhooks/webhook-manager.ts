/**
 * Webhook Manager — HTTP Delivery for Platform Consumers
 *
 * Handles the full webhook lifecycle: endpoint registration, HMAC-SHA256
 * payload signing, event dispatch routing, HTTP delivery, and retry
 * with exponential backoff.
 *
 * In-memory storage (Map) for endpoints and deliveries.
 * Uses Node.js `crypto` for HMAC — no external dependencies.
 *
 * Delivery flow:
 *   dispatch(event, data)
 *     → find subscribed endpoints
 *     → build WebhookPayload
 *     → signPayload (HMAC-SHA256)
 *     → HTTP POST with signature header
 *     → track delivery record
 */

import { createHmac, randomBytes, randomUUID } from "crypto";
import type {
  WebhookConfig,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEventType,
  WebhookPayload,
} from "./types";

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: WebhookConfig = {
  maxRetries: 5,
  retryBackoffMs: 1000,
  timeoutMs: 10000,
  maxEndpoints: 20,
  signatureHeader: "X-Corsair-Signature",
};

/** Current API version stamped on every webhook payload */
const API_VERSION = "2026-02-13";

// =============================================================================
// WEBHOOK MANAGER
// =============================================================================

export class WebhookManager {
  private config: WebhookConfig;
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();

  constructor(config?: Partial<WebhookConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------

  /** Returns the current webhook configuration */
  getConfig(): WebhookConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // ENDPOINT MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Register a new webhook endpoint.
   * Auto-generates HMAC secret if not provided.
   * Throws if max endpoints limit is reached.
   */
  registerEndpoint(
    url: string,
    events: WebhookEventType[],
    secret?: string,
    metadata?: Record<string, string>,
  ): WebhookEndpoint {
    const activeCount = this.countActiveEndpoints();
    if (activeCount >= this.config.maxEndpoints) {
      throw new Error(
        `Max endpoints limit reached (${this.config.maxEndpoints}). Remove an endpoint before adding a new one.`,
      );
    }

    const endpoint: WebhookEndpoint = {
      id: randomUUID(),
      url,
      secret: secret ?? randomBytes(32).toString("hex"),
      events: [...events],
      active: true,
      createdAt: new Date().toISOString(),
      metadata,
    };

    this.endpoints.set(endpoint.id, endpoint);
    return { ...endpoint };
  }

  /**
   * Deactivate an endpoint. Returns true if the endpoint was active and
   * is now deactivated; false if not found or already inactive.
   */
  removeEndpoint(id: string): boolean {
    const ep = this.endpoints.get(id);
    if (!ep || !ep.active) return false;

    ep.active = false;
    return true;
  }

  /** List all active endpoints */
  listEndpoints(): WebhookEndpoint[] {
    const result: WebhookEndpoint[] = [];
    for (const ep of this.endpoints.values()) {
      if (ep.active) {
        result.push({ ...ep });
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // HMAC SIGNING
  // ---------------------------------------------------------------------------

  /**
   * Sign a webhook payload using HMAC-SHA256.
   * Returns the hex-encoded digest.
   */
  signPayload(payload: WebhookPayload, secret: string): string {
    const body = JSON.stringify(payload);
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  /**
   * Verify a webhook signature against a payload and secret.
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verifySignature(
    payload: WebhookPayload,
    signature: string,
    secret: string,
  ): boolean {
    const expected = this.signPayload(payload, secret);
    if (expected.length !== signature.length) return false;

    // Timing-safe comparison
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  }

  // ---------------------------------------------------------------------------
  // DISPATCH
  // ---------------------------------------------------------------------------

  /**
   * Dispatch an event to all subscribed, active endpoints.
   * Creates a payload, delivers to each matching endpoint,
   * and returns delivery records.
   */
  async dispatch(
    event: WebhookEventType,
    data: Record<string, unknown>,
  ): Promise<WebhookDelivery[]> {
    const matching = this.findSubscribedEndpoints(event);
    if (matching.length === 0) return [];

    const deliveries: WebhookDelivery[] = [];

    for (const ep of matching) {
      const payload = this.buildPayload(event, data);
      const delivery = await this.deliver(ep, payload);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  // ---------------------------------------------------------------------------
  // DELIVER
  // ---------------------------------------------------------------------------

  /**
   * Deliver a payload to a single endpoint via HTTP POST.
   * Returns a delivery record tracking the attempt result.
   */
  async deliver(
    endpoint: WebhookEndpoint,
    payload: WebhookPayload,
  ): Promise<WebhookDelivery> {
    const signature = this.signPayload(payload, endpoint.secret);
    const body = JSON.stringify(payload);
    const deliveryId = randomUUID();

    const delivery: WebhookDelivery = {
      id: deliveryId,
      endpointId: endpoint.id,
      payloadId: payload.id,
      status: "pending",
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      lastAttemptAt: undefined,
      nextRetryAt: undefined,
      responseStatus: undefined,
      responseBody: undefined,
      error: undefined,
    };

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [this.config.signatureHeader]: signature,
        },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      delivery.attempts = 1;
      delivery.lastAttemptAt = new Date().toISOString();
      delivery.responseStatus = response.status;

      if (response.ok) {
        delivery.status = "success";
      } else {
        delivery.status = "failed";
        delivery.responseBody = await response.text();
        delivery.error = `HTTP ${response.status}`;
        delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts);
      }
    } catch (err) {
      delivery.attempts = 1;
      delivery.lastAttemptAt = new Date().toISOString();
      delivery.status = "failed";
      delivery.error = err instanceof Error ? err.message : String(err);
      delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts);
    }

    this.deliveries.set(deliveryId, delivery);
    return { ...delivery };
  }

  // ---------------------------------------------------------------------------
  // RETRY
  // ---------------------------------------------------------------------------

  /**
   * Retry a failed delivery. Returns the updated delivery record,
   * or null if the delivery doesn't exist, was successful, or is exhausted.
   */
  async retryFailed(deliveryId: string): Promise<WebhookDelivery | null> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) return null;
    if (delivery.status === "success" || delivery.status === "exhausted") return null;

    const endpoint = this.endpoints.get(delivery.endpointId);
    if (!endpoint) return null;

    // Check if max retries exhausted
    if (delivery.attempts >= delivery.maxAttempts) {
      delivery.status = "exhausted";
      delivery.nextRetryAt = undefined;
      return { ...delivery };
    }

    // Rebuild the payload from the original event (re-fetch from deliveries)
    // For retry, we re-POST with a fresh attempt
    const signature = this.signPayload(
      { id: delivery.payloadId } as WebhookPayload,
      endpoint.secret,
    );

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [this.config.signatureHeader]: signature,
        },
        body: JSON.stringify({ retryOf: delivery.payloadId }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      delivery.attempts += 1;
      delivery.lastAttemptAt = new Date().toISOString();
      delivery.responseStatus = response.status;

      if (response.ok) {
        delivery.status = "success";
        delivery.nextRetryAt = undefined;
        delivery.error = undefined;
      } else {
        delivery.responseBody = await response.text();
        delivery.error = `HTTP ${response.status}`;

        if (delivery.attempts >= delivery.maxAttempts) {
          delivery.status = "exhausted";
          delivery.nextRetryAt = undefined;
        } else {
          delivery.status = "failed";
          delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts);
        }
      }
    } catch (err) {
      delivery.attempts += 1;
      delivery.lastAttemptAt = new Date().toISOString();
      delivery.error = err instanceof Error ? err.message : String(err);

      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = "exhausted";
        delivery.nextRetryAt = undefined;
      } else {
        delivery.status = "failed";
        delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts);
      }
    }

    return { ...delivery };
  }

  // ---------------------------------------------------------------------------
  // DELIVERY LOOKUP
  // ---------------------------------------------------------------------------

  /** Retrieve a stored delivery record by ID */
  getDelivery(id: string): WebhookDelivery | null {
    const d = this.deliveries.get(id);
    return d ? { ...d } : null;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /** Count active endpoints */
  private countActiveEndpoints(): number {
    let count = 0;
    for (const ep of this.endpoints.values()) {
      if (ep.active) count++;
    }
    return count;
  }

  /** Find all active endpoints subscribed to a specific event */
  private findSubscribedEndpoints(event: WebhookEventType): WebhookEndpoint[] {
    const result: WebhookEndpoint[] = [];
    for (const ep of this.endpoints.values()) {
      if (ep.active && ep.events.includes(event)) {
        result.push(ep);
      }
    }
    return result;
  }

  /** Build a WebhookPayload for an event */
  private buildPayload(
    type: WebhookEventType,
    data: Record<string, unknown>,
  ): WebhookPayload {
    return {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      data,
      apiVersion: API_VERSION,
    };
  }

  /** Calculate next retry timestamp using exponential backoff */
  private calculateNextRetry(attempt: number): string {
    const delayMs = this.config.retryBackoffMs * Math.pow(2, attempt - 1);
    return new Date(Date.now() + delayMs).toISOString();
  }
}
