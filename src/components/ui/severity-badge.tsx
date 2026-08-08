import { cn } from "@/lib/utils";
import { type Severity, SEVERITY_CONFIG } from "@/types/scan";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-[2px] text-[11px] font-medium",
        config.color,
        config.bg,
        className
      )}
    >
      <span className={cn("h-1 w-1 rounded-full", config.color.replace("text-", "bg-"))} />
      {config.label}
    </span>
  );
}
