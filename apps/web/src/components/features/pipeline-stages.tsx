const stages = [
  {
    name: "RECON",
    description: "Scout target configuration",
    icon: "🔭",
    color: "text-corsair-cyan",
  },
  {
    name: "SPYGLASS",
    description: "STRIDE threat modeling",
    icon: "🧭",
    color: "text-corsair-turquoise",
  },
  {
    name: "MARK",
    description: "Drift detection",
    icon: "⚓",
    color: "text-corsair-gold",
  },
  {
    name: "RAID",
    description: "Attack simulation",
    icon: "⚔️",
    color: "text-corsair-crimson",
  },
  {
    name: "PLUNDER",
    description: "Evidence extraction",
    icon: "📦",
    color: "text-corsair-cyan",
  },
  {
    name: "CHART",
    description: "Framework mapping",
    icon: "🗺️",
    color: "text-corsair-turquoise",
  },
  {
    name: "QUARTER",
    description: "Governance review",
    icon: "🏛️",
    color: "text-corsair-gold",
  },
  {
    name: "MARQUE",
    description: "Signed proof (Ed25519)",
    icon: "✍️",
    color: "text-corsair-green",
  },
];

export function PipelineStages() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
      {stages.map((stage, i) => (
        <div key={stage.name} className="group flex flex-col items-center">
          {/* Icon */}
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-corsair-border bg-corsair-surface text-2xl transition-all group-hover:border-corsair-cyan group-hover:shadow-[0_0_15px_rgba(0,207,255,0.15)]">
            {stage.icon}
          </div>

          {/* Name */}
          <span
            className={`mb-1 font-mono text-xs font-bold ${stage.color}`}
          >
            {stage.name}
          </span>

          {/* Description */}
          <span className="text-center text-xs text-corsair-text-dim">
            {stage.description}
          </span>

          {/* Connector arrow (not on last) */}
          {i < stages.length - 1 && (
            <span className="mt-2 hidden text-corsair-border lg:block">
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
