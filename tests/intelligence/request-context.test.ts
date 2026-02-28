import { describe, test, expect } from "bun:test";
import { createHash } from "crypto";
import { getRequestActor, getSSFStreamOwner } from "../../src/intelligence/request-context";

function withAuth(req: Request, auth: unknown): Request {
  (req as Request & { corsairAuth?: unknown }).corsairAuth = auth;
  return req;
}

describe("request-context", () => {
  test("extracts api_key actor with hashed identity", () => {
    const req = withAuth(new Request("http://localhost/test"), {
      type: "api_key",
      key: "secret-key-1",
    });

    const actor = getRequestActor(req);
    expect(actor.actorType).toBe("api_key");
    expect(actor.actorIdHash).toBe(
      createHash("sha256").update("secret-key-1").digest("hex"),
    );
  });

  test("extracts oidc actor with subject hash", () => {
    const req = withAuth(new Request("http://localhost/test"), {
      type: "oidc",
      oidc: { subjectHash: "oidc-subject-hash" },
    });

    const actor = getRequestActor(req);
    expect(actor.actorType).toBe("oidc");
    expect(actor.actorIdHash).toBe("oidc-subject-hash");
  });

  test("uses first forwarded IP for anonymous actor hash", () => {
    const req = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.10" },
    });

    const actor = getRequestActor(req);
    expect(actor.actorType).toBe("anonymous");
    expect(actor.actorIdHash).toBe(
      createHash("sha256").update("203.0.113.42").digest("hex"),
    );
  });

  test("returns anonymous actor without hash when no auth/IP", () => {
    const req = new Request("http://localhost/test");
    const actor = getRequestActor(req);
    expect(actor).toEqual({ actorType: "anonymous" });
  });
});

describe("getSSFStreamOwner", () => {
  test("returns api_key owner with hashed id", () => {
    const req = withAuth(new Request("http://localhost/test"), {
      type: "api_key",
      key: "stream-owner-key",
    });

    const owner = getSSFStreamOwner(req);
    expect(owner).toEqual({
      type: "api_key",
      id: createHash("sha256").update("stream-owner-key").digest("hex"),
    });
  });

  test("returns oidc owner with subject hash id", () => {
    const req = withAuth(new Request("http://localhost/test"), {
      type: "oidc",
      oidc: { subjectHash: "subject-hash-1" },
    });

    const owner = getSSFStreamOwner(req);
    expect(owner).toEqual({
      type: "oidc",
      id: "subject-hash-1",
    });
  });

  test("returns undefined when request is unauthenticated", () => {
    const req = new Request("http://localhost/test");
    expect(getSSFStreamOwner(req)).toBeUndefined();
  });
});
