"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { useScanPolling } from "@/hooks/use-scan-polling";
import { useScanStream, type ScanEvent } from "@/hooks/use-scan-stream";
import { abortScan, startScan } from "@/lib/api";
import type { ScanStatus, Severity } from "@/types/scan";
import {
  Globe,
  Layers,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Eye,
  Terminal,
} from "lucide-react";

// ── Phase config ──────────────────────────────────────────────

const PHASES: { key: ScanStatus; label: string; desc: string }[] = [
  { key: "crawling",          label: "Crawl",    desc: "Discovering pages" },
  { key: "analyzing",         label: "Analyze",  desc: "Running security checks" },
  { key: "generating-report", label: "AI Fixes", desc: "Generating remediations" },
  { key: "completed",         label: "Done",     desc: "Report ready" },
];

const PHASE_ORDER: ScanStatus[] = ["crawling", "analyzing", "generating-report", "completed"];

function phaseIndex(status: ScanStatus) {
  return PHASE_ORDER.indexOf(status);
}

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  crawling: "Crawling",
  analyzing: "Analyzing",
  "generating-report": "AI Fixes",
  completed: "Completed",
  error: "Error",
};

// ── Known security checkers ───────────────────────────────────

const CHECKER_LABELS: Record<string, string> = {
  HeadersChecker:     "Security Headers",
  CookiesChecker:     "Cookie Flags",
  JwtExposureChecker: "JWT Exposure",
  ApiKeyChecker:      "API Key Leaks",
  CsrfChecker:        "CSRF Protection",
  MisconfigChecker:   "Misconfigurations",
};

export default function ScanPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(50);
  const [scanId, setScanId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  const { scan, error: pollError, stop } = useScanPolling(scanId);
  const { events, screenshot, clearEvents } = useScanStream(scanId);

  const handleStart = useCallback(async () => {
    setCancelFeedback(null);
    setStartError(null);
    setStarting(true);
    try {
      const result = await startScan(url, maxDepth, maxPages);
      setScanId(result.scanId);
    } catch (err) {
      setStartError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }, [url, maxDepth, maxPages]);

  const handleCancel = useCallback(async () => {
    if (!scanId || aborting) return;
    setCancelFeedback(null);
    setAborting(true);
    try {
      await abortScan(scanId);
      stop();
      clearEvents();
      setScanId(null);
      setCancelFeedback("Scan cancelled.");
    } catch (err) {
      setCancelFeedback((err as Error).message || "Unable to cancel scan.");
    } finally {
      setAborting(false);
    }
  }, [scanId, aborting, stop, clearEvents]);

  const isRunning = scan && !["completed", "error", "idle"].includes(scan.status);

  const liveFindings = events.filter((e) => e.type === "analyzer:finding");
  const liveSeverityCounts = liveFindings.reduce<Record<string, number>>((acc, e) => {
    const sev = e.data.severity as string;
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {});

  const severityCounts =
    scan?.findings && scan.findings.length > 0
      ? scan.findings.reduce<Record<string, number>>((acc, f) => {
          acc[f.severity] = (acc[f.severity] || 0) + 1;
          return acc;
        }, {})
      : liveSeverityCounts;

  const totalFindings = scan?.findings?.length || liveFindings.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium tracking-[-0.02em] text-[var(--text-primary)]">
            New Scan
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Configure target and watch the scan live
          </p>
        </div>
      </div>

      {/* Input bar */}
      <div className="space-y-3">
        <div className="flex gap-2.5">
          <div className="flex-1 flex items-center gap-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 focus-within:border-[var(--border-accent)] transition-colors duration-100 outline-none">
            <Globe className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 bg-transparent py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
              disabled={!!isRunning || aborting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && !isRunning) handleStart();
              }}
            />
          </div>
          {isRunning ? (
            <Button
              variant="danger"
              onClick={handleCancel}
              loading={aborting}
              disabled={aborting}
            >
              Cancel Scan
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              loading={starting}
              disabled={!url.trim() || aborting}
            >
              {scanId ? "Scanning…" : "Start Scan"}
            </Button>
          )}
        </div>

        {startError && (
          <p className="text-[12px] text-red-400">{startError}</p>
        )}

        {cancelFeedback && (
          <p className="text-[12px] text-[var(--text-secondary)]">{cancelFeedback}</p>
        )}

        <div className="flex items-center gap-5 text-[12px] text-[var(--text-tertiary)]">
          <label className="flex items-center gap-1.5">
            <Layers className="h-3 w-3" />
            Depth
            <select
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              disabled={!!isRunning || aborting}
              className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)] outline-none ml-1"
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            Pages
            <select
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              disabled={!!isRunning || aborting}
              className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)] outline-none ml-1"
            >
              {[10, 25, 50, 100, 200].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          <span className="text-[var(--text-tertiary)]">AI fixes enabled</span>
        </div>
      </div>

      {/* Live scan area */}
      {scanId && scan && (
        <>
          {/* Status strip */}
          <div className="glass-card flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 text-[var(--text-secondary)] animate-spin" />
              ) : scan.status === "completed" ? (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              ) : scan.status === "error" ? (
                <XCircle className="h-3.5 w-3.5 text-red-400" />
              ) : null}
              <span className="text-[13px] font-medium text-[var(--text-primary)]">
                {STATUS_LABELS[scan.status]}
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {scan.pagesVisited}p
                {totalFindings > 0 && ` · ${totalFindings} issues`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Progress steps */}
              <div className="hidden sm:flex items-center gap-0.5">
                {(["crawling", "analyzing", "generating-report", "completed"] as const).map((step, idx) => {
                  const stepOrder = ["crawling", "analyzing", "generating-report", "completed"];
                  const currentIdx = stepOrder.indexOf(scan.status);
                  const isDone = currentIdx > idx || (scan.status === step && step === "completed");
                  const isActive = scan.status === step && step !== "completed";

                  return (
                    <div
                      key={step}
                      className={`h-1 w-6 rounded-full ${
                        isDone ? "bg-emerald-400" :
                        isActive ? "bg-[var(--text-secondary)] animate-pulse" :
                        "bg-[var(--bg-elevated)]"
                      }`}
                    />
                  );
                })}
              </div>

              <span className="text-[12px] font-mono text-[var(--text-tertiary)] tabular-nums">
                {scan.progress}%
              </span>
            </div>
          </div>

          {/* Main: viewport + log + findings */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Left: viewport + log */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <BrowserViewport screenshot={screenshot} isRunning={!!isRunning} url={url} events={events} />
              <LiveActionLog events={events} compact />
            </div>

            {/* Right: findings */}
            <div className="lg:col-span-2">
              <LiveFindingsFeed events={events} severityCounts={severityCounts} />
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-px w-full bg-[var(--border-secondary)] overflow-hidden">
            <div
              className="h-full bg-[var(--text-primary)] transition-all duration-500 ease-out"
              style={{ width: `${scan.progress}%` }}
            />
          </div>
        </>
      )}

      {/* Completion */}
      {scan?.status === "completed" && (
        <div className="glass-card flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-[13px] font-medium text-[var(--text-primary)]">Scan complete</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {scan.pagesVisited} pages · {scan.findings.length} issues
              </p>
            </div>
          </div>
          <Button onClick={() => router.push(`/scan/${scan.id}`)}>
            View Report <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Error */}
      {(pollError || scan?.status === "error") && (
        <div className="glass-card flex items-center gap-2.5 px-4 py-3 border-red-500/10">
          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-red-400">Scan failed</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {pollError || "An error occurred during the scan"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function formatEvent(event: ScanEvent) {
  switch (event.type) {
    case "crawler:page-loaded":
    case "crawler:page-navigating":
      return { prefix: "GET", text: String(event.data.url || ""), color: "text-blue-400" };
    case "analyzer:finding":
      return { prefix: "VULN", text: String(event.data.title || ""), color: "text-red-400" };
    case "analyzer:check-started":
      return { prefix: "CHECK", text: `Running ${event.data.checkerId}`, color: "text-orange-400" };
    case "ai:generating-report":
      return { prefix: "AI", text: "Generating remediation…", color: "text-purple-400" };
    default:
      return { prefix: "INFO", text: String(event.type), color: "text-[var(--text-tertiary)]" };
  }
}

// ── Live Action Log ──

function LiveActionLog({ events, compact }: { events: ScanEvent[]; compact?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-secondary)]">
        <Terminal className="h-3 w-3 text-[var(--text-tertiary)]" />
        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Log</span>
        <span className="text-[10px] font-mono text-[var(--text-tertiary)] ml-auto tabular-nums">{events.length}</span>
      </div>
      <div
        ref={scrollRef}
        className={`${compact ? "h-[130px]" : "h-[380px]"} overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.6] bg-[var(--bg-inset)] space-y-px`}
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[var(--text-tertiary)] text-[11px]">Waiting for events…</span>
          </div>
        ) : (
          events.map((event, i) => {
            const { prefix, text, color } = formatEvent(event);
            const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            return (
              <div key={i} className="flex gap-2">
                <span className="text-[var(--text-tertiary)] shrink-0 select-none">{time}</span>
                <span className="text-[var(--text-tertiary)] shrink-0 w-10 text-right select-none">{prefix}</span>
                <span className={`${color} break-all`}>{text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Browser Viewport ──

function BrowserViewport({
  screenshot,
  isRunning,
  url,
  events,
}: {
  screenshot: string | null;
  isRunning: boolean;
  url: string;
  events: ScanEvent[];
}) {
  const lastNavEvent = [...events].reverse().find(
    (e) => e.type === "crawler:page-loaded" || e.type === "crawler:page-navigating"
  );
  const currentUrl = lastNavEvent ? (lastNavEvent.data.url as string) : url || "—";

  return (
    <div className="glass-card overflow-hidden">
      {/* Chrome */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[var(--bg-elevated)]" />
          <div className="w-2 h-2 rounded-full bg-[var(--bg-elevated)]" />
          <div className="w-2 h-2 rounded-full bg-[var(--bg-elevated)]" />
        </div>
        <div className="flex-1 flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--bg-inset)] text-[11px] font-mono text-[var(--text-tertiary)] truncate">
          {isRunning && <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" />}
          <span className="truncate">{currentUrl}</span>
        </div>
      </div>

      {/* Viewport */}
      <div className="h-[420px] bg-[var(--bg-inset)] flex items-center justify-center relative overflow-hidden">
        {screenshot ? (
          <img
            src={`data:image/jpeg;base64,${screenshot}`}
            alt="Browser viewport"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center">
            <Eye className="h-5 w-5 mx-auto text-[var(--text-secondary)] opacity-40 mb-1.5" />
            <p className="text-[11px] text-[var(--text-secondary)]">
              {isRunning ? "Waiting for screenshot…" : "Start a scan to view"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Live Findings Feed ──

function LiveFindingsFeed({ events, severityCounts }: { events: ScanEvent[]; severityCounts: Record<string, number> }) {
  const findings = events.filter((e) => e.type === "analyzer:finding");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [findings.length]);

  return (
    <div className="glass-card overflow-hidden h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-secondary)]">
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">
          Findings
        </span>
        <div className="flex items-center gap-1">
          {(["critical", "high", "medium", "low", "info"] as const).map((sev) => {
            const count = severityCounts[sev] || 0;
            if (count === 0) return null;
            return (
              <span
                key={sev}
                className={`text-[10px] font-mono px-1 py-px rounded ${
                  sev === "critical" ? "bg-red-500/10 text-red-400" :
                  sev === "high" ? "bg-orange-500/10 text-orange-400" :
                  sev === "medium" ? "bg-yellow-500/10 text-yellow-400" :
                  sev === "low" ? "bg-sky-500/10 text-sky-400" :
                  "bg-zinc-500/10 text-zinc-400"
                }`}
              >
                {count}
              </span>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-[560px] overflow-y-auto"
      >
        {findings.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-[var(--text-tertiary)]">No findings yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-secondary)]">
            {findings.map((event, i) => (
              <div key={i} className="px-3 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors duration-100">
                <div className="flex items-start gap-2">
                  <SeverityBadge severity={event.data.severity as Severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[var(--text-primary)] leading-snug">
                      {event.data.title as string}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 font-mono truncate">
                      {event.data.affectedUrl as string}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
