/**
 * Webhook Types — Platform Consumer Event Delivery
 *
 * Defines the type system for the webhook delivery infrastructure.
 * Platform consumers register endpoints to receive CPOE lifecycle events
 * (new CPOE signed, score changed, CPOE expired, etc.).
 *
 * Payloads are signed with HMAC-SHA256 for authenticity verification.
 * Delivery uses exponential backoff retry with exhaustion tracking.
 */

// =============================================================================
// EVENT TYPES
// =============================================================================

/** Webhook event types covering the full CPOE lifecycle */
export type WebhookEventType =
  | "cpoe.signed"      // New CPOE issued
  | "cpoe.verified"    // CPOE verified by third party
  | "cpoe.expired"     // CPOE reached validUntil
  | "cpoe.revoked"     // CPOE explicitly revoked
  | "score.changed"    // Evidence quality score changed
  | "score.degraded"   // Score dropped below threshold
  | "drift.detected"   // Compliance drift detected
  | "key.rotated";     // Signing key was rotated

// =============================================================================
// ENDPOINT REGISTRATION
// =============================================================================

/** Webhook endpoint registration — where events get delivered */
export interface WebhookEndpoint {
  /** Unique endpoint identifier */
  id: string;
  /** Target URL for HTTP POST delivery */
  url: string;
  /** HMAC-SHA256 signing secret for payload authenticity */
  secret: string;
  /** Event types this endpoint subscribes to */
  events: WebhookEventType[];
  /** Whether this endpoint receives deliveries */
  active: boolean;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Arbitrary key-value metadata (org ID, environment, etc.) */
  metadata?: Record<string, string>;
}

// =============================================================================
// DELIVERY PAYLOAD
// =============================================================================

/** Webhook delivery payload — the JSON body sent to endpoints */
export interface WebhookPayload {
  /** Unique delivery ID */
  id: string;
  /** Event type */
  type: WebhookEventType;
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string;
  /** Event-specific data */
  data: Record<string, unknown>;
  /** API version for payload schema compatibility */
  apiVersion: string;
}

// =============================================================================
// DELIVERY TRACKING
// =============================================================================

/** Delivery attempt record — tracks each delivery's lifecycle */
export interface WebhookDelivery {
  /** Unique delivery record ID */
  id: string;
  /** Target endpoint ID */
  endpointId: string;
  /** Payload ID that was delivered */
  payloadId: string;
  /** Current delivery status */
  status: "pending" | "success" | "failed" | "exhausted";
  /** Number of delivery attempts made */
  attempts: number;
  /** Maximum attempts before marking as exhausted */
  maxAttempts: number;
  /** ISO 8601 timestamp of last delivery attempt */
  lastAttemptAt?: string;
  /** ISO 8601 timestamp of next scheduled retry */
  nextRetryAt?: string;
  /** HTTP response status code from the endpoint */
  responseStatus?: number;
  /** HTTP response body (truncated for storage) */
  responseBody?: string;
  /** Error message if delivery failed */
  error?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Webhook manager configuration */
export interface WebhookConfig {
  /** Maximum retry attempts per delivery (default: 5) */
  maxRetries: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  retryBackoffMs: number;
  /** HTTP request timeout in ms (default: 10000) */
  timeoutMs: number;
  /** Maximum endpoints per organization (default: 20) */
  maxEndpoints: number;
  /** HTTP header name for HMAC signature (default: "X-Corsair-Signature") */
  signatureHeader: string;
}
