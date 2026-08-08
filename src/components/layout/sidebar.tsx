"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Scan,
  FileWarning,
  Settings,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scan", label: "New Scan", icon: Scan },
  { href: "/findings", label: "Findings", icon: FileWarning },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[280px] flex-col bg-[var(--bg-primary)] border-r border-[var(--border-secondary)]">
      {/* Logo — text only, no icon-in-circle */}
      <div className="flex h-14 items-center px-5">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Trust Issue
          </span>
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-[var(--border-secondary)]" />

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors duration-100",
                isActive
                  ? "text-[var(--text-primary)] bg-[var(--bg-hover)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              )}
            >
              <Icon className={cn(
                "h-[15px] w-[15px] shrink-0 transition-colors duration-100",
                isActive ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-3">
        <Link
          href="/help"
          className="group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors duration-100"
        >
          <HelpCircle className="h-[15px] w-[15px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
          Help
        </Link>
      </div>
    </aside>
  );
}
