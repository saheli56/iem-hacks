"use client";

import { RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#09090b] text-[#ececee] flex items-center justify-center min-h-screen font-sans">
        <div className="max-w-sm w-full mx-4 text-center">
          <p className="text-[48px] font-semibold tracking-tighter leading-none text-[#ececee]">Error</p>
          <p className="text-[13px] text-[#4e4e52] mt-2 mb-6">
            Something went wrong. Please try again.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#ececee] px-3.5 py-1.5 text-[13px] font-medium text-[#09090b] hover:bg-white transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
