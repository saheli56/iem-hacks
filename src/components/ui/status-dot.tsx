import { cn } from "@/lib/utils";
import { type ScanStatus } from "@/types/scan";

interface StatusDotProps {
  status: ScanStatus;
  className?: string;
}

const statusStyles: Record<ScanStatus, { dot: string; label: string }> = {
  idle: { dot: "bg-zinc-600", label: "Idle" },
  crawling: { dot: "bg-blue-400 animate-pulse", label: "Crawling" },
  analyzing: { dot: "bg-amber-400 animate-pulse", label: "Analyzing" },
  "generating-report": { dot: "bg-amber-300 animate-pulse", label: "Report" },
  completed: { dot: "bg-emerald-400", label: "Done" },
  error: { dot: "bg-red-400", label: "Error" },
  aborted: { dot: "bg-zinc-500", label: "Aborted" },
};

export function StatusDot({ status, className }: StatusDotProps) {
  const config = statusStyles[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px]", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      <span className="text-[var(--text-tertiary)] font-medium">{config.label}</span>
    </span>
  );
}
