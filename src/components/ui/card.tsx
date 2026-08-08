import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function Card({ children, className, hoverable }: CardProps) {
  return (
    <div
      className={cn(
        "glass-card p-4",
        hoverable && "glass-card-hover cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-3", className)}>
      <div>
        <h3 className="text-[13px] font-medium text-[var(--text-primary)] tracking-[-0.01em]">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
