/**
 * JWKS Endpoint
 *
 * GET /.well-known/jwks.json — Key discovery for CPOE verification
 *
 * Serves the JSON Web Key Set containing the Ed25519 public key(s)
 * used to sign CPOEs. Includes the active key plus any retired keys
 * (for verifying older CPOEs signed before key rotation).
 *
 * This is the CA public key bundle equivalent in the DigiCert model.
 */

import type { KeyManager } from "../src/parley/marque-key-manager";

export interface JWKSJsonDeps {
  keyManager: KeyManager;
  domain: string;
}

/**
 * Create the JWKS handler.
 * Returns all active and retired keys in JWKS format.
 */
export function createJWKSJsonHandler(
  deps: JWKSJsonDeps,
): (req: Request) => Promise<Response> {
  const { keyManager, domain } = deps;

  return async (_req: Request): Promise<Response> => {
    try {
      const keys: JsonWebKey[] = [];

      // Active key
      const keypair = await keyManager.loadKeypair();
      if (keypair) {
        const activeJWK = await keyManager.exportJWK(keypair.publicKey);
        keys.push({
          ...activeJWK,
          kid: `did:web:${domain.replace(/:/g, "%3A")}#key-1`,
          use: "sig",
          alg: "EdDSA",
        });
      }

      // Retired keys (for verifying older CPOEs)
      const retired = await keyManager.getRetiredKeys();
      for (let i = 0; i < retired.length; i++) {
        const retiredJWK = await keyManager.exportJWK(retired[i]);
        keys.push({
          ...retiredJWK,
          kid: `did:web:${domain.replace(/:/g, "%3A")}#key-retired-${i + 1}`,
          use: "sig",
          alg: "EdDSA",
        });
      }

      return Response.json(
        { keys },
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=3600",
          },
        },
      );
    } catch {
      return Response.json(
        { error: "No signing keys configured." },
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    }
  };
}
