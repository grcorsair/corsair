/**
 * FLAGSHIP Client - HTTP Delivery for SET Tokens
 *
 * Handles HTTP delivery of Security Event Tokens (SETs).
 * Supports push (POST to receiver) and poll (GET from stream) delivery
 * methods per the SSF specification.
 *
 * Enhancements:
 * - Exponential backoff retry on transient failures (5xx, network errors)
 * - 429 handling: respects Retry-After header, else uses backoff
 * - Circuit breaker: pauses delivery to endpoints with consecutive failures
 * - Request timeout via AbortSignal
 *
 * Uses Bun's built-in fetch -- no external HTTP dependencies.
 */

export interface FlagshipClientOptions {
  /** Maximum retries on transient failure (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Consecutive failures before circuit breaker trips (default: 3) */
  circuitBreakerThreshold?: number;
  /** How long circuit breaker pauses delivery in ms (default: 60000) */
  circuitBreakerPauseMs?: number;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
}

interface CircuitBreakerState {
  count: number;
  pausedUntil: number;
}

export class FlagshipClient {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number;
  private baseDelayMs: number;
  private circuitBreakerThreshold: number;
  private circuitBreakerPauseMs: number;
  private timeoutMs: number;
  private failureCount: Map<string, CircuitBreakerState> = new Map();

  constructor(
    baseUrl: string,
    apiKey: string,
    options?: FlagshipClientOptions,
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.maxRetries = options?.maxRetries ?? 3;
    this.baseDelayMs = options?.baseDelayMs ?? 1000;
    this.circuitBreakerThreshold = options?.circuitBreakerThreshold ?? 3;
    this.circuitBreakerPauseMs = options?.circuitBreakerPauseMs ?? 60000;
    this.timeoutMs = options?.timeoutMs ?? 10000;
  }

  /**
   * Check if the circuit breaker is open for an endpoint.
   * Returns true if requests should be blocked.
   */
  private isCircuitOpen(endpoint: string): boolean {
    const state = this.failureCount.get(endpoint);
    if (!state) return false;

    if (state.count >= this.circuitBreakerThreshold) {
      if (Date.now() < state.pausedUntil) {
        return true; // Still paused
      }
      // Pause period expired, reset
      this.failureCount.delete(endpoint);
      return false;
    }

    return false;
  }

  /**
   * Record a failure for an endpoint (circuit breaker tracking).
   */
  private recordFailure(endpoint: string): void {
    const state = this.failureCount.get(endpoint) || {
      count: 0,
      pausedUntil: 0,
    };
    state.count++;
    if (state.count >= this.circuitBreakerThreshold) {
      state.pausedUntil = Date.now() + this.circuitBreakerPauseMs;
    }
    this.failureCount.set(endpoint, state);
  }

  /**
   * Record a success for an endpoint (resets circuit breaker).
   */
  private recordSuccess(endpoint: string): void {
    this.failureCount.delete(endpoint);
  }

  /**
   * Determine if an HTTP status code is transient (retryable).
   */
  private isTransient(status: number): boolean {
    return status >= 500 || status === 429;
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Push a signed SET to a receiver endpoint via HTTP POST.
   * Uses application/secevent+jwt content type per RFC 8935.
   *
   * Retries on transient failures (5xx, 429) with exponential backoff.
   * Respects Retry-After header on 429 responses.
   * Circuit breaker trips after consecutive failures to the same endpoint.
   */
  async pushEvent(
    endpoint: string,
    set: string,
  ): Promise<{ delivered: boolean }> {
    // Circuit breaker check
    if (this.isCircuitOpen(endpoint)) {
      throw new Error(
        `FLAGSHIP: Circuit breaker open for ${endpoint}. Delivery paused.`,
      );
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/secevent+jwt",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: set,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        // Non-transient client errors: do not retry
        if (response.status === 401) {
          this.recordFailure(endpoint);
          throw new Error("FLAGSHIP: Invalid API key (401 Unauthorized)");
        }

        if (
          !this.isTransient(response.status) &&
          !response.ok
        ) {
          this.recordFailure(endpoint);
          throw new Error(
            `FLAGSHIP: Push failed with status ${response.status}`,
          );
        }

        // Transient error: retry if attempts remain
        if (this.isTransient(response.status)) {
          lastError = new Error(
            `FLAGSHIP: Push failed with status ${response.status}`,
          );

          if (attempt < this.maxRetries) {
            // Check for Retry-After on 429
            if (response.status === 429) {
              const retryAfter = response.headers.get("Retry-After");
              if (retryAfter) {
                const delaySec = parseInt(retryAfter, 10);
                if (!isNaN(delaySec)) {
                  await this.sleep(delaySec * 1000);
                  continue;
                }
              }
            }
            // Exponential backoff
            await this.sleep(Math.pow(2, attempt) * this.baseDelayMs);
            continue;
          }

          // Exhausted retries
          this.recordFailure(endpoint);
          throw lastError;
        }

        // Success
        this.recordSuccess(endpoint);
        return { delivered: true };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("FLAGSHIP:")
        ) {
          throw error;
        }

        // Network error or timeout: retry if attempts remain
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          await this.sleep(Math.pow(2, attempt) * this.baseDelayMs);
          continue;
        }

        this.recordFailure(endpoint);
        throw lastError;
      }
    }

    // Should not reach here, but safety net
    this.recordFailure(endpoint);
    throw lastError || new Error("FLAGSHIP: Push failed after all retries");
  }

  /**
   * Poll for pending SET tokens from a stream.
   */
  async pollEvents(streamId: string): Promise<{ sets: string[] }> {
    const url = `${this.baseUrl}/streams/${encodeURIComponent(streamId)}/events`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 401) {
      throw new Error("FLAGSHIP: Invalid API key (401 Unauthorized)");
    }

    if (!response.ok) {
      throw new Error(
        `FLAGSHIP: Poll failed with status ${response.status}`,
      );
    }

    return (await response.json()) as { sets: string[] };
  }

  /**
   * Acknowledge receipt of a SET token.
   */
  async acknowledgeEvent(streamId: string, jti: string): Promise<void> {
    const url = `${this.baseUrl}/streams/${encodeURIComponent(streamId)}/acknowledge`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ jti }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 401) {
      throw new Error("FLAGSHIP: Invalid API key (401 Unauthorized)");
    }

    if (!response.ok) {
      throw new Error(
        `FLAGSHIP: Acknowledge failed with status ${response.status}`,
      );
    }
  }
}
