/**
 * Pixel Art Loading Animations
 *
 * Spinning sword and pulsing diamond loaders in pixel art style.
 */

interface PixelLoaderProps {
  size?: number;
  className?: string;
  label?: string;
}

export function SwordLoader({ size = 32, className = "", label }: PixelLoaderProps) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="animate-spin" style={{ animationDuration: "1.5s" }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
        >
          {/* Sword blade (vertical) */}
          <rect x="7" y="0" width="2" height="2" fill="#00CFFF" />
          <rect x="7" y="2" width="2" height="2" fill="#00CFFF" />
          <rect x="7" y="4" width="2" height="2" fill="#00CFFF" />
          <rect x="7" y="6" width="2" height="2" fill="#00CFFF" />
          {/* Guard (horizontal crossbar) */}
          <rect x="4" y="8" width="2" height="2" fill="#D4A853" />
          <rect x="6" y="8" width="2" height="2" fill="#D4A853" />
          <rect x="8" y="8" width="2" height="2" fill="#D4A853" />
          <rect x="10" y="8" width="2" height="2" fill="#D4A853" />
          {/* Grip */}
          <rect x="7" y="10" width="2" height="2" fill="#8B2232" />
          <rect x="7" y="12" width="2" height="2" fill="#8B2232" />
          {/* Pommel */}
          <rect x="6" y="14" width="4" height="2" fill="#D4A853" />
        </svg>
      </div>
      {label && (
        <span className="font-pixel text-[7px] tracking-widest text-corsair-text-dim animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}

export function DiamondLoader({ size = 16, className = "" }: PixelLoaderProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 4 4"
            shapeRendering="crispEdges"
          >
            <rect x="1" y="0" width="2" height="1" fill="#00CFFF" />
            <rect x="0" y="1" width="4" height="2" fill="#00CFFF" />
            <rect x="1" y="1" width="2" height="2" fill="#D4A853" />
            <rect x="1" y="3" width="2" height="1" fill="#00CFFF" />
          </svg>
        </div>
      ))}
    </div>
  );
}
