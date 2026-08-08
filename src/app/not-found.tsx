import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-[64px] font-semibold text-[var(--text-primary)] tracking-tighter leading-none">404</p>
      <p className="text-[13px] text-[var(--text-tertiary)] mt-2 mb-6">
        This page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--text-primary)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--bg-primary)] hover:bg-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Dashboard
      </Link>
    </div>
  );
}
