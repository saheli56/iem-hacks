"use client";

import { StatusDot } from "@/components/ui/status-dot";
import { CommandPalette } from "@/components/ui/command-palette";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-[var(--border-secondary)] bg-[var(--bg-primary)]/90 backdrop-blur-sm px-5">
      {/* Search */}
      <div className="flex items-center">
        <CommandPalette />
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <StatusDot status="idle" />
      </div>
    </header>
  );
}
