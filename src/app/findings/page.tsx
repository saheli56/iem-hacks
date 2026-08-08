"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listScans, getScan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/severity-badge";
import type { Finding, Severity } from "@/types/scan";
import {
  ArrowUpRight,
  Search,
} from "lucide-react";

interface EnrichedFinding extends Finding {
  scanId: string;
  targetUrl: string;
}

export default function FindingsPage() {
  const router = useRouter();
  const [findings, setFindings] = useState<EnrichedFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const scans = await listScans();
        const completedScans = scans.filter((s) => s.status === "completed");

        const allFindings: EnrichedFinding[] = [];
        for (const scan of completedScans) {
          const full = await getScan(scan.id);
          for (const f of full.findings) {
            allFindings.push({ ...f, scanId: scan.id, targetUrl: scan.targetUrl });
          }
        }

        const weights: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        allFindings.sort((a, b) => weights[a.severity] - weights[b.severity]);
        setFindings(allFindings);
      } catch {
        // no findings
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = findings.filter((f) => {
    if (filterSeverity !== "all" && f.severity !== filterSeverity) return false;
    if (searchQuery && !f.title.toLowerCase().includes(searchQuery.toLowerCase()) && !f.affectedUrl.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const severityCounts = findings.reduce(
    (acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; },
    {} as Record<Severity, number>
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 border-[1.5px] border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] text-[var(--text-tertiary)]">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em] text-[var(--text-primary)]">
          Findings
        </h1>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
          {findings.length} issue{findings.length !== 1 ? "s" : ""} across all scans
        </p>
      </div>

      {/* Severity filter pills */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setFilterSeverity("all")}
          className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors duration-100 cursor-pointer ${
            filterSeverity === "all"
              ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          }`}
        >
          All ({findings.length})
        </button>
        {(["critical", "high", "medium", "low", "info"] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(filterSeverity === sev ? "all" : sev)}
            className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors duration-100 cursor-pointer ${
              filterSeverity === sev
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            }`}
          >
            {sev.charAt(0).toUpperCase() + sev.slice(1)} ({severityCounts[sev] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-2 focus-within:border-[var(--border-accent)] transition-colors duration-100">
        <Search className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search findings..."
          className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
        />
        {filterSeverity !== "all" && (
          <button
            onClick={() => setFilterSeverity("all")}
            className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Findings list */}
      {filtered.length === 0 ? (
        <div className="glass-card flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-[13px] text-[var(--text-secondary)]">
              {findings.length === 0 ? "No findings yet" : "No matches"}
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
              {findings.length === 0 ? "Run a scan to discover issues" : "Try different search terms"}
            </p>
            {findings.length === 0 && (
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push("/scan")}>
                Start a scan
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden divide-y divide-[var(--border-secondary)]">
          {filtered.map((finding) => (
            <button
              key={`${finding.scanId}-${finding.id}`}
              onClick={() => router.push(`/scan/${finding.scanId}`)}
              className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors duration-100 text-left group"
            >
              <SeverityBadge severity={finding.severity} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">
                  {finding.title}
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono truncate">
                  {finding.affectedUrl}
                </p>
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded shrink-0">
                {finding.category}
              </span>
              <ArrowUpRight className="h-3 w-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
