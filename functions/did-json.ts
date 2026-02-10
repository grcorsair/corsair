/**
 * DID Document Endpoint
 *
 * GET /.well-known/did.json — Trust anchor for CPOE verification
 *
 * Serves the DID Document for this Corsair instance, containing
 * the Ed25519 public key used to sign CPOEs. Any verifier can
 * resolve did:web:grcorsair.com to this endpoint and get the
 * public key needed to verify Corsair-signed CPOEs.
 *
 * This is the CA root certificate equivalent in the DigiCert model.
 */

import type { KeyManager } from "../src/parley/marque-key-manager";

export interface DIDJsonDeps {
  keyManager: KeyManager;
  domain: string;
}

/**
 * Create the DID document handler.
 * Generates the DID document dynamically from the active signing key.
 */
export function createDIDJsonHandler(
  deps: DIDJsonDeps,
): (req: Request) => Promise<Response> {
  const { keyManager, domain } = deps;

  return async (_req: Request): Promise<Response> => {
    try {
      const didDocument = await keyManager.generateDIDDocument(domain);

      return Response.json(didDocument, {
        status: 200,
        headers: {
          "content-type": "application/did+ld+json",
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=3600",
        },
      });
    } catch (err) {
      return Response.json(
        { error: "No signing key configured. Run key generation first." },
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    }
  };
}
