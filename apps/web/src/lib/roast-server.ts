import { type RoastResult } from "@/lib/roast";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

export async function getRoastResultById(id: string): Promise<RoastResult | null> {
  if (!id) return null;

  try {
    const res = await fetch(`${API_BASE}/roast/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const payload = await res.json().catch(() => null) as { result?: RoastResult } | null;
    if (!payload?.result) return null;

    return payload.result;
  } catch {
    return null;
  }
}
