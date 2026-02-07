/**
 * SSF Delivery Worker
 *
 * Processes the ssf_event_queue, delivering pending SET tokens
 * to stream endpoints via push delivery.
 *
 * Supports exponential backoff on failure and expiration after max attempts.
 * Designed to be triggered by cron (Railway cron) or internal setInterval.
 *
 * Backoff formula: next_retry = now + (2^attempts * 1000)ms
 */

// =============================================================================
// TYPES
// =============================================================================

export interface EventQueueRow {
  id: number;
  stream_id: string;
  set_token: string;
  jti: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry: string | null;
}

export interface EventUpdate {
  id: number;
  status: string;
  attempts: number;
  next_retry?: string;
  delivered_at?: string;
}

export interface DeliveryQueueDeps {
  fetchPendingEvents: () => Promise<EventQueueRow[]>;
  getStreamConfig: (
    streamId: string,
  ) => Promise<{ endpoint_url: string } | null>;
  updateEvent: (update: EventUpdate) => Promise<void>;
  pushEvent: (
    endpoint: string,
    setToken: string,
  ) => Promise<{ delivered: boolean }>;
}

export interface DeliveryResult {
  processed: number;
  delivered: number;
  failed: number;
  expired: number;
}

// =============================================================================
// BACKOFF
// =============================================================================

/**
 * Compute the next retry time using exponential backoff.
 * Formula: now + (2^attempts * 1000)ms
 */
function computeNextRetry(attempts: number): string {
  const delayMs = Math.pow(2, attempts) * 1000;
  return new Date(Date.now() + delayMs).toISOString();
}

// =============================================================================
// DELIVERY PROCESSOR
// =============================================================================

/**
 * Process all pending events in the delivery queue.
 *
 * For each pending event:
 * 1. Look up the stream config to find the push endpoint
 * 2. Attempt to push the SET token
 * 3. On success: mark as delivered with delivered_at timestamp
 * 4. On failure: increment attempts, compute next_retry with backoff
 * 5. On max_attempts exceeded: mark as expired
 */
export async function processDeliveryQueue(
  deps: DeliveryQueueDeps,
): Promise<DeliveryResult> {
  const result: DeliveryResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    expired: 0,
  };

  const events = await deps.fetchPendingEvents();

  for (const event of events) {
    result.processed++;

    // Look up stream config
    const config = await deps.getStreamConfig(event.stream_id);
    if (!config) {
      result.failed++;
      continue;
    }

    try {
      await deps.pushEvent(config.endpoint_url, event.set_token);

      // Success: mark as delivered
      await deps.updateEvent({
        id: event.id,
        status: "delivered",
        attempts: event.attempts + 1,
        delivered_at: new Date().toISOString(),
      });
      result.delivered++;
    } catch {
      const newAttempts = event.attempts + 1;

      if (newAttempts >= event.max_attempts) {
        // Max attempts exceeded: mark as expired
        await deps.updateEvent({
          id: event.id,
          status: "expired",
          attempts: newAttempts,
        });
        result.failed++;
        result.expired++;
      } else {
        // Schedule retry with exponential backoff
        await deps.updateEvent({
          id: event.id,
          status: "pending",
          attempts: newAttempts,
          next_retry: computeNextRetry(newAttempts),
        });
        result.failed++;
      }
    }
  }

  return result;
}
