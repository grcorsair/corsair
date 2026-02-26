import { ImageResponse } from "next/og";
import { getRoastResultById } from "@/lib/roast-server";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

function verdictColor(verdict: string): string {
  if (verdict === "CORSAIR READY" || verdict === "VERIFICATION READY") return "#2ECC71";
  if (verdict === "GETTING THERE") return "#D4A853";
  if (verdict === "TRUST ME BRO") return "#7FDBCA";
  return "#E25A4B";
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const result = await getRoastResultById(id);

  const domain = result?.domain || "unknown-domain";
  const verdict = result?.verdict || "ROAST REPORT";
  const score = result ? `${result.compositeScore.toFixed(1)}/10` : "N/A";
  const accent = verdictColor(verdict);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(130deg, #050505 0%, #111111 48%, #1A0F0C 100%)",
          color: "#E8E2D6",
          padding: "56px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, letterSpacing: 2.5, color: "#D4A853" }}>CORSAIR ROAST</div>
          <div
            style={{
              fontSize: 18,
              color: accent,
              border: `1px solid ${accent}88`,
              borderRadius: 999,
              padding: "8px 16px",
            }}
          >
            {verdict}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 64, lineHeight: 1.04, fontWeight: 700 }}>{domain}</div>
          <div style={{ fontSize: 30, color: "#B7AEA2" }}>Composite Score: {score}</div>
          <div style={{ fontSize: 24, color: "#9D9488", maxWidth: 980 }}>
            Discoverability · Verifiability · Freshness · Machine Readability · Transparency
          </div>
        </div>

        <div style={{ fontSize: 20, color: "#7FDBCA", letterSpacing: 1 }}>
          Shareable report: grcorsair.com/roast/{id}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
