import { Badge } from "@/components/ui/badge";

const frameworks = [
  { name: "MITRE ATT&CK", source: "CTID" },
  { name: "NIST 800-53", source: "CTID" },
  { name: "NIST CSF", source: "SCF" },
  { name: "SOC 2", source: "Plugin + SCF" },
  { name: "ISO 27001", source: "Plugin + SCF" },
  { name: "CIS Controls", source: "Plugin + SCF" },
  { name: "PCI-DSS", source: "Plugin + SCF" },
  { name: "HIPAA", source: "SCF" },
  { name: "GDPR", source: "SCF" },
  { name: "CMMC", source: "SCF" },
  { name: "FedRAMP", source: "SCF" },
  { name: "SOX", source: "SCF" },
  { name: "COBIT", source: "SCF" },
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
