import { describe, test, expect } from "bun:test";
import {
  createPgEventJournalWriter,
  noOpEventJournalWriter,
  writeEventBestEffort,
} from "../../src/intelligence/event-journal";

describe("event-journal", () => {
  test("writes event rows to Postgres writer with defaults", async () => {
    const calls: Array<{ query: string; values: unknown[] }> = [];
    const db = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ query: strings.join("?"), values });
      return [];
    };

    const writer = createPgEventJournalWriter(db as any);
    await writer.write({
      eventType: "verify.success",
      actorType: "api_key",
      actorIdHash: "hash-1",
      targetType: "issuer",
      targetId: "did:web:acme.com",
      metadata: { verified: true },
    });

    expect(calls.length).toBe(1);
    expect(calls[0].query).toContain("INSERT INTO event_journal");
    expect(calls[0].values[1]).toBe("verify.success");
    expect(calls[0].values[5]).toBe("api_key");
    expect(calls[0].values[6]).toBe("hash-1");
    expect(calls[0].values[8]).toBe("did:web:acme.com");
  });

  test("best-effort write does not throw when writer fails", async () => {
    const failingWriter = {
      async write(): Promise<void> {
        throw new Error("db down");
      },
    };

    const originalError = console.error;
    console.error = () => {};
    try {
      await writeEventBestEffort(failingWriter, {
        eventType: "sign.failure",
        status: "failure",
      });
    } finally {
      console.error = originalError;
    }
  });

  test("no-op writer accepts writes", async () => {
    await noOpEventJournalWriter.write({ eventType: "test.event" });
  });
});
