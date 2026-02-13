/**
 * Webhooks Module — Platform Consumer Event Delivery
 *
 * HTTP webhook infrastructure for delivering CPOE lifecycle events
 * to platform consumers. HMAC-SHA256 signed payloads with exponential
 * backoff retry.
 */

export {
  type WebhookEventType,
  type WebhookEndpoint,
  type WebhookPayload,
  type WebhookDelivery,
  type WebhookConfig,
} from "./types";

export { WebhookManager } from "./webhook-manager";
