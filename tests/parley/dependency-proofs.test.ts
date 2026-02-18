import { describe, test, expect } from "bun:test";
import { generateKeyPairSync } from "crypto";
import { SignJWT, exportJWK, importPKCS8, importSPKI } from "jose";
import { buildDependencyProof, parseDependencyProofs, verifyDependencyChain } from "../../src/parley/dependency-proofs";

async function createTestJwt(): Promise<{
  jwt: string;
  did: string;
  didDocument: Record<string, unknown>;
}> {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const did = "did:web:example.com";
  const kid = `${did}#key-1`;

  const jwt = await new SignJWT({
    vc: {
      "@context": ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/v1"],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: { id: did, name: "Example Issuer" },
      credentialSubject: {
        type: "CorsairCPOE",
        schemaVersion: "1.0",
        scope: "SOC 2 Type II — Infrastructure",
        provenance: { source: "tool" },
        summary: { controlsTested: 1, controlsPassed: 1, controlsFailed: 0, overallScore: 100 },
      },
    },
    parley: "2.1",
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "vc+jwt", kid })
    .setIssuer(did)
    .setSubject("marque-test")
    .setJti("marque-test")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(await importPKCS8(privateKey, "EdDSA"));

  const publicKeyJwk = await exportJWK(await importSPKI(publicKey, "EdDSA"));

  return {
    jwt,
    did,
    didDocument: {
      "@context": ["https://www.w3.org/ns/did/v1"],
      id: did,
      verificationMethod: [
        {
          id: kid,
          type: "JsonWebKey2020",
          controller: did,
          publicKeyJwk,
        },
      ],
      authentication: [],
      assertionMethod: [],
    },
  };
}

describe("dependency proofs", () => {
  test("buildDependencyProof extracts issuer and digest", async () => {
    const { jwt, did } = await createTestJwt();
    const dep = buildDependencyProof(jwt, { cpoeUrl: "https://dep.example.com/cpoe.jwt" });
    expect(dep.issuer).toBe(did);
    expect(dep.cpoe).toBe("https://dep.example.com/cpoe.jwt");
    expect(dep.digest.startsWith("sha256:")).toBe(true);
  });

  test("parseDependencyProofs filters invalid entries", () => {
    const payload = {
      vc: {
        credentialSubject: {
          dependencies: [
            { issuer: "did:web:valid.com", digest: "sha256:abc" },
            { issuer: "did:web:invalid.com" },
          ],
        },
      },
    } as Record<string, unknown>;

    const parsed = parseDependencyProofs(payload);
    expect(parsed.dependencies).toHaveLength(1);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  test("verifyDependencyChain validates dependency CPOE and digest", async () => {
    const { jwt, didDocument } = await createTestJwt();
    const dep = buildDependencyProof(jwt, { cpoeUrl: "https://dep.example.com/cpoe.jwt" });

    const fetchFn = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "https://example.com/.well-known/did.json") {
        return new Response(JSON.stringify(didDocument), { status: 200 });
      }
      if (url === "https://dep.example.com/cpoe.jwt") {
        return new Response(jwt, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const results = await verifyDependencyChain([dep], { depth: 1, fetchFn });
    expect(results[0]?.ok).toBe(true);

    const tampered = { ...dep, digest: "sha256:deadbeef" };
    const tamperedResults = await verifyDependencyChain([tampered], { depth: 1, fetchFn });
    expect(tamperedResults[0]?.ok).toBe(false);
    expect(tamperedResults[0]?.digestMatch).toBe(false);
  });
});
