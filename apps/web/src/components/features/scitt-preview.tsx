import { Badge } from "@/components/ui/badge";
import { SCITTEntryCard, type SCITTEntry } from "@/components/features/scitt-entry-card";
import previewEntries from "@/content/samples/scitt-preview.json";

interface SCITTPreviewProps {
  className?: string;
  limit?: number;
}

const entries = previewEntries as SCITTEntry[];

export function SCITTPreview({ className, limit = 3 }: SCITTPreviewProps) {
  const shown = entries.slice(0, limit);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-corsair-gold" />
          <span className="font-mono text-xs text-corsair-text-dim">
            Demo transparency log
          </span>
        </div>
        <Badge
          variant="outline"
          className="font-mono text-[10px] text-corsair-text-dim border-corsair-border"
        >
          Sample entries
        </Badge>
      </div>
      <div className="space-y-2">
        {shown.map((entry) => (
          <SCITTEntryCard key={entry.entryId} entry={entry} />
        ))}
      </div>
    </div>
  );
}
