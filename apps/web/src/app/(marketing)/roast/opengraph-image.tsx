import { ImageResponse } from "next/og";

export const alt = "Roast My Trust Center — Corsair";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
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
            "radial-gradient(circle at 20% 10%, #3B1D1D 0%, #0A0A0A 55%, #050505 100%)",
          color: "#E8E2D6",
          padding: "56px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, letterSpacing: 3, color: "#D4A853" }}>CORSAIR</div>
          <div
            style={{
              fontSize: 18,
              color: "#E25A4B",
              border: "1px solid rgba(226, 90, 75, 0.55)",
              borderRadius: 999,
              padding: "8px 16px",
            }}
          >
            TRUST CENTER INTELLIGENCE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 74, lineHeight: 1.04, fontWeight: 700 }}>Roast My Trust Center</div>
          <div style={{ fontSize: 30, color: "#B7AEA2", maxWidth: 980 }}>
            Deterministic scoring across discoverability, verifiability, freshness, machine readability, and transparency.
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#7FDBCA", letterSpacing: 1.5 }}>
          grcorsair.com/roast
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
