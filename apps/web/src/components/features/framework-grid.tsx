import { Badge } from "@/components/ui/badge";

const frameworks = [
  { name: "MITRE ATT&CK", source: "CTID" },
  { name: "NIST 800-53", source: "CTID" },
  { name: "NIST CSF", source: "SCF Crosswalk" },
  { name: "SOC 2", source: "CHART Engine" },
  { name: "ISO 27001", source: "CHART Engine" },
  { name: "CIS Controls", source: "CHART Engine" },
  { name: "PCI-DSS", source: "CHART Engine" },
  { name: "HIPAA", source: "SCF Crosswalk" },
  { name: "GDPR", source: "SCF Crosswalk" },
  { name: "CMMC", source: "SCF Crosswalk" },
  { name: "FedRAMP", source: "SCF Crosswalk" },
  { name: "SOX", source: "SCF Crosswalk" },
  { name: "COBIT", source: "SCF Crosswalk" },
];

export function FrameworkGrid() {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {frameworks.map((fw) => (
        <Badge
          key={fw.name}
          variant="outline"
          className="cursor-default rounded-lg border-corsair-border bg-corsair-surface px-4 py-3 font-mono text-sm font-semibold text-corsair-text transition-all hover:border-corsair-cyan hover:text-corsair-cyan hover:shadow-[0_0_10px_rgba(0,207,255,0.1)]"
        >
          {fw.name}
        </Badge>
      ))}
    </div>
  );
}
