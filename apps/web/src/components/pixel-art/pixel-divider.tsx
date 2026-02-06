/**
 * Pixel Art Crossed Swords Section Divider
 *
 * Decorative SVG separator featuring crossed scimitars
 * from the Corsair logo motif. Rendered as pixel art.
 */

interface PixelDividerProps {
  className?: string;
  variant?: "swords" | "diamond";
}

export function PixelDivider({ className = "", variant = "swords" }: PixelDividerProps) {
  if (variant === "diamond") {
    return <DiamondDivider className={className} />;
  }
  return <SwordsDivider className={className} />;
}

function SwordsDivider({ className }: { className: string }) {
  return (
    <div className={`flex items-center justify-center gap-0 ${className}`}>
      {/* Left gradient line */}
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-corsair-border to-corsair-cyan/30" />

      {/* Crossed swords pixel art */}
      <div className="mx-4 flex-shrink-0">
        <svg
          width="48"
          height="24"
          viewBox="0 0 48 24"
          shapeRendering="crispEdges"
          className="opacity-40"
        >
          {/* Left sword (blade going top-right to bottom-left) */}
          <rect x="4"  y="2"  width="2" height="2" fill="#C0392B" />
          <rect x="6"  y="2"  width="2" height="2" fill="#C0392B" />
          <rect x="8"  y="4"  width="2" height="2" fill="#00CFFF" />
          <rect x="10" y="6"  width="2" height="2" fill="#00CFFF" />
          <rect x="12" y="8"  width="2" height="2" fill="#00CFFF" />
          <rect x="14" y="10" width="2" height="2" fill="#00CFFF" />
          <rect x="16" y="10" width="2" height="2" fill="#D4A853" />
          <rect x="18" y="10" width="2" height="2" fill="#D4A853" />
          <rect x="20" y="12" width="2" height="2" fill="#00CFFF" />
          <rect x="22" y="14" width="2" height="2" fill="#00CFFF" />
          <rect x="24" y="16" width="2" height="2" fill="#00CFFF" />
          <rect x="26" y="18" width="2" height="2" fill="#00CFFF" />

          {/* Right sword (blade going top-left to bottom-right) */}
          <rect x="40" y="2"  width="2" height="2" fill="#C0392B" />
          <rect x="42" y="2"  width="2" height="2" fill="#C0392B" />
          <rect x="38" y="4"  width="2" height="2" fill="#00CFFF" />
          <rect x="36" y="6"  width="2" height="2" fill="#00CFFF" />
          <rect x="34" y="8"  width="2" height="2" fill="#00CFFF" />
          <rect x="32" y="10" width="2" height="2" fill="#00CFFF" />
          <rect x="28" y="10" width="2" height="2" fill="#D4A853" />
          <rect x="30" y="10" width="2" height="2" fill="#D4A853" />
          <rect x="26" y="12" width="2" height="2" fill="#00CFFF" />
          <rect x="24" y="14" width="2" height="2" fill="#00CFFF" />
          <rect x="22" y="16" width="2" height="2" fill="#00CFFF" />
          <rect x="20" y="18" width="2" height="2" fill="#00CFFF" />

          {/* Center diamond (where blades cross) */}
          <rect x="23" y="10" width="2" height="2" fill="#D4A853" />
          <rect x="22" y="11" width="4" height="2" fill="#D4A853" />
          <rect x="23" y="12" width="2" height="2" fill="#D4A853" />
        </svg>
      </div>

      {/* Right gradient line */}
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-corsair-border to-corsair-cyan/30" />
    </div>
  );
}

function DiamondDivider({ className }: { className: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-corsair-border to-corsair-cyan/30" />
      <div className="mx-4">
        <svg
          width="16"
          height="16"
          viewBox="0 0 8 8"
          shapeRendering="crispEdges"
          className="opacity-40"
        >
          <rect x="3" y="0" width="2" height="2" fill="#00CFFF" />
          <rect x="1" y="2" width="2" height="2" fill="#00CFFF" />
          <rect x="5" y="2" width="2" height="2" fill="#00CFFF" />
          <rect x="3" y="2" width="2" height="2" fill="#D4A853" />
          <rect x="3" y="4" width="2" height="2" fill="#00CFFF" />
          <rect x="1" y="4" width="2" height="2" fill="#00CFFF" />
          <rect x="5" y="4" width="2" height="2" fill="#00CFFF" />
          <rect x="3" y="6" width="2" height="2" fill="#00CFFF" />
        </svg>
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-corsair-border to-corsair-cyan/30" />
    </div>
  );
}
