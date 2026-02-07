/**
 * FLAGSHIP Client - HTTP Delivery for SET Tokens
 *
 * Handles HTTP delivery of Security Event Tokens (SETs).
 * Supports push (POST to receiver) and poll (GET from stream) delivery
 * methods per the SSF specification.
 *
 * Uses Bun's built-in fetch -- no external HTTP dependencies.
 */

export class FlagshipClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Push a signed SET to a receiver endpoint via HTTP POST.
   * Uses application/secevent+jwt content type per RFC 8935.
   */
  async pushEvent(
    endpoint: string,
    set: string,
  ): Promise<{ delivered: boolean }> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/secevent+jwt",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: set,
    });

    if (response.status === 401) {
      throw new Error("FLAGSHIP: Invalid API key (401 Unauthorized)");
    }

    if (response.status === 429) {
      throw new Error("FLAGSHIP: Rate limit exceeded (429). Retry later.");
    }

    if (!response.ok) {
      throw new Error(
        `FLAGSHIP: Push failed with status ${response.status}`,
      );
    }

    return { delivered: true };
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
