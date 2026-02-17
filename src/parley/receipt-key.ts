/**
 * Receipt Key Resolver — resolve public key PEM for process receipts.
 *
 * Prefers DID:web key resolution via JWT kid, falls back to local trusted keys.
 */

import { decodeProtectedHeader, importJWK, exportSPKI } from "jose";
import type { KeyManager } from "./marque-key-manager";
import { resolveDIDDocument } from "./did-resolver";

export async function resolveReceiptPublicKeyPem(
  jwt: string,
  keyManager: KeyManager,
  extraTrustedKeys?: Buffer[],
  fetchFn?: typeof fetch,
): Promise<string | null> {
  const jwtToUse = jwt.includes("~")
    ? (await import("./sd-jwt")).parseSDJWT(jwt).jwt
    : jwt;

  let kid: string | undefined;
  try {
    const header = decodeProtectedHeader(jwtToUse);
    kid = typeof header.kid === "string" ? header.kid : undefined;
  } catch {
    kid = undefined;
  }

  if (kid && kid.includes("did:web:")) {
    const did = kid.split("#")[0];
    const resolution = await resolveDIDDocument(did, fetchFn);
    const vm = resolution.didDocument?.verificationMethod.find(m => m.id === kid);
    if (vm?.publicKeyJwk) {
      try {
        const key = await importJWK(vm.publicKeyJwk, "EdDSA");
        return await exportSPKI(key);
      } catch {
        // fall through to local keys
      }
    }
  }

  if (extraTrustedKeys && extraTrustedKeys.length > 0) {
    return extraTrustedKeys[0]!.toString();
  }

  const keypair = await keyManager.loadKeypair();
  if (!keypair) return null;
  return keypair.publicKey.toString();
}

