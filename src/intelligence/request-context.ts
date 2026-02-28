import { createHash } from "crypto";
import type { CorsairAuthContext } from "../middleware/auth";
import type { SSFStreamOwner } from "../flagship/ssf-stream";

type RequestWithAuth = Request & { corsairAuth?: CorsairAuthContext };

export interface RequestActor {
  actorType: "api_key" | "oidc" | "anonymous" | "legacy";
  actorIdHash?: string;
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getForwardedIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const ip = forwarded.split(",")[0]?.trim();
  return ip || null;
}

export function getRequestActor(req: Request): RequestActor {
  const auth = (req as RequestWithAuth).corsairAuth;
  if (auth?.type === "api_key") {
    return {
      actorType: "api_key",
      actorIdHash: hashValue(auth.key),
    };
  }
  if (auth?.type === "oidc") {
    return {
      actorType: "oidc",
      actorIdHash: auth.oidc.subjectHash,
    };
  }

  const ip = getForwardedIp(req);
  if (ip) {
    return {
      actorType: "anonymous",
      actorIdHash: hashValue(ip),
    };
  }

  return { actorType: "anonymous" };
}

export function getSSFStreamOwner(req: Request): SSFStreamOwner | undefined {
  const auth = (req as RequestWithAuth).corsairAuth;
  if (!auth) return undefined;

  if (auth.type === "api_key") {
    return {
      type: "api_key",
      id: hashValue(auth.key),
    };
  }

  if (auth.type === "oidc") {
    return {
      type: "oidc",
      id: auth.oidc.subjectHash,
    };
  }

  return undefined;
}
