"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { listScans, getScan } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/severity-badge";
import type { Severity } from "@/types/scan";
import { Search, Globe, ShieldAlert, Clock, Loader2, ArrowRight } from "lucide-react";

// ── Types ──

type ScanResult = {
  kind: "scan";
  id: string;
  targetUrl: string;
  status: string;
  findings: number;
  startedAt: string;
};

type FindingResult = {
  kind: "finding";
  findingId: string;
  scanId: string;
  title: string;
  severity: Severity;
  affectedUrl: string;
  targetUrl: string;
  category: string;
};

type Result = ScanResult | FindingResult;

// ── Helpers ──

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Component ──

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allResults, setAllResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  // ── Fetch all data once on first open ──
  const fetchData = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    try {
      const scans = await listScans();
      const results: Result[] = scans.map((s) => ({
        kind: "scan",
        id: s.id,
        targetUrl: s.targetUrl,
        status: s.status,
        findings: s.findings,
        startedAt: s.startedAt,
      }));

      // Enrich with findings from completed scans
      const completed = scans.filter((s) => s.status === "completed");
      const findingResults: FindingResult[] = [];
      await Promise.all(
        completed.map(async (s) => {
          try {
            const full = await getScan(s.id);
            for (const f of full.findings) {
              findingResults.push({
                kind: "finding",
                findingId: f.id,
                scanId: s.id,
                title: f.title,
                severity: f.severity,
                affectedUrl: f.affectedUrl,
                targetUrl: s.targetUrl,
                category: f.category,
              });
            }
          } catch { /* skip */ }
        })
      );

      setAllResults([...results, ...findingResults]);
    } catch { /* leave empty */ } finally {
      setLoading(false);
    }
  }, []);

  // ── Open/close ──
  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setSelectedIndex(0);
    fetchData();
  }, [fetchData]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  // ── ⌘K / Ctrl+K global shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      }
      if (e.key === "Escape" && open) closePalette();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, openPalette, closePalette]);

  // ── Focus input when opened ──
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // ── Filter results ──
  const filtered: Result[] = query.trim() === ""
    ? allResults.slice(0, 12)
    : allResults.filter((r) => {
        const q = query.toLowerCase();
        if (r.kind === "scan") {
          return r.targetUrl.toLowerCase().includes(q) || r.status.toLowerCase().includes(q);
        }
        return (
          r.title.toLowerCase().includes(q) ||
          r.affectedUrl.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.targetUrl.toLowerCase().includes(q) ||
          r.severity.toLowerCase().includes(q)
        );
      }).slice(0, 20);

  const scanResults = filtered.filter((r): r is ScanResult => r.kind === "scan");
  const findingResults = filtered.filter((r): r is FindingResult => r.kind === "finding");

  // Build flat list for keyboard nav (scans first, then findings)
  const flatList = [...scanResults, ...findingResults];

  // ── Keyboard navigation ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatList[selectedIndex]) {
      navigate(flatList[selectedIndex]);
    }
  };

  // Reset selection when query changes
  useEffect(() => setSelectedIndex(0), [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ── Navigate to result ──
  const navigate = (result: Result) => {
    closePalette();
    if (result.kind === "scan") {
      router.push(`/scan/${result.id}`);
    } else {
      router.push(`/scan/${result.scanId}`);
    }
  };

  if (!open) {
    return (
      <button
        onClick={openPalette}
        className="flex items-center gap-2 rounded-md bg-transparent border border-[var(--border-primary)] px-3 py-1.5 w-64 text-[13px] text-[var(--text-tertiary)] hover:border-[var(--border-accent)] transition-colors duration-100 cursor-text"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span>Search…</span>
        <kbd className="ml-auto text-[10px] text-[var(--text-tertiary)] font-mono">⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={closePalette}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[15vh] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden outline-none">

        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--border-secondary)]">
          {loading
            ? <Loader2 className="h-4 w-4 text-[var(--text-tertiary)] shrink-0 animate-spin" />
            : <Search className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search scans, findings, categories…"
            className="flex-1 bg-transparent py-3.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
          />
          <kbd
            onClick={closePalette}
            className="text-[10px] text-[var(--text-tertiary)] font-mono border border-[var(--border-secondary)] rounded px-1.5 py-0.5 cursor-pointer hover:text-[var(--text-secondary)]"
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[min(420px,60vh)] overflow-y-auto py-2">

          {/* Empty / no data */}
          {!loading && flatList.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--text-tertiary)]">
              {query ? `No results for "${query}"` : "No scans yet"}
            </p>
          )}

          {/* Scans section */}
          {scanResults.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Scans
              </p>
              {scanResults.map((r) => {
                const idx = flatList.indexOf(r);
                const selected = idx === selectedIndex;
                return (
                  <button
                    key={r.id}
                    data-idx={idx}
                    onClick={() => navigate(r)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selected ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]/50"
                    }`}
                  >
                    <Globe className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--text-primary)] truncate font-mono">
                        {shortUrl(r.targetUrl)}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                        {r.findings} {r.findings === 1 ? "finding" : "findings"} · {r.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                        <Clock className="h-3 w-3" />
                        {timeAgo(r.startedAt)}
                      </span>
                      {selected && <ArrowRight className="h-3.5 w-3.5 text-[var(--text-secondary)]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Findings section */}
          {findingResults.length > 0 && (
            <div className={scanResults.length > 0 ? "mt-1 border-t border-[var(--border-secondary)] pt-1" : ""}>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Findings
              </p>
              {findingResults.map((r) => {
                const idx = flatList.indexOf(r);
                const selected = idx === selectedIndex;
                return (
                  <button
                    key={r.findingId}
                    data-idx={idx}
                    onClick={() => navigate(r)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selected ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]/50"
                    }`}
                  >
                    <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--text-primary)] truncate">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono truncate">
                        {shortUrl(r.affectedUrl)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SeverityBadge severity={r.severity} />
                      {selected && <ArrowRight className="h-3.5 w-3.5 text-[var(--text-secondary)]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {flatList.length > 0 && (
          <div className="border-t border-[var(--border-secondary)] px-4 py-2 flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        )}
      </div>
    </>
  );
}
