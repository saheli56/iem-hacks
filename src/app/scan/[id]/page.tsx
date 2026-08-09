"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getScan, startScan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/severity-badge";
import type { ScanResult, Finding, Severity } from "@/types/scan";
import {
  ArrowLeft,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
} from "lucide-react";

export default function ScanResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"security" | "trackers" | "pages">("security");
  const [isRescanning, setIsRescanning] = useState(false);

  const handleRescan = async () => {
    if (!scan) return;
    setIsRescanning(true);
    try {
      const res = await startScan(scan.config.targetUrl, scan.config.maxDepth, scan.config.maxPages);
      router.push(`/scan/${res.scanId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRescanning(false);
    }
  };

  const handleExport = () => {
    if (!scan) return;
    const data = JSON.stringify(scan, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trustissue-report-${scan.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchScan = () => {
      getScan(id)
        .then((data) => {
          setScan(data);
          if (data.status === "completed" || data.status === "aborted" || data.status === "error") {
            clearInterval(intervalId);
          }
        })
        .catch((err) => {
          setError((err as Error).message);
          clearInterval(intervalId);
        })
        .finally(() => setLoading(false));
    };

    fetchScan(); // Initial fetch
    intervalId = setInterval(fetchScan, 1000); // Poll every second

    return () => clearInterval(intervalId);
  }, [id]);

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

  if (error || !scan) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-4">
          <p className="text-[13px] text-red-400">{error || "Scan not found"}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => router.push("/scan")}>
            <ArrowLeft className="h-3 w-3" /> Back
          </Button>
        </div>
      </div>
    );
  }

  const severityCounts = scan.findings.reduce(
    (acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; },
    {} as Record<Severity, number>
  );

  const duration = scan.completedAt
    ? `${Math.round((new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000)}s`
    : "—";

  const securityFindings = scan.findings.filter(f => f.category !== "trackers");
  const trackerFindings = scan.findings.filter(f => f.category === "trackers");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/scan")}
            className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-medium tracking-[-0.02em] text-[var(--text-primary)]">
              Scan Results
            </h1>
            <p className="text-[12px] text-[var(--text-secondary)] font-mono mt-0.5">
              {scan.config.targetUrl}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} disabled={scan?.status !== "completed"} variant="secondary" size="sm" className="gap-2">
            <Download className="h-3.5 w-3.5" /> 
            Export Report
          </Button>
          <Button onClick={handleRescan} disabled={isRescanning} size="sm" className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${isRescanning ? "animate-spin" : ""}`} /> 
            {isRescanning ? "Starting..." : "Rescan URL"}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-px bg-[var(--border-secondary)] rounded-lg overflow-hidden">
        {[
          { label: "Pages", value: scan.pagesVisited },
          { label: "Issues", value: scan.findings.length },
          { label: "Duration", value: duration },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--bg-primary)] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              {stat.label}
            </p>
            <p className="text-[20px] font-semibold text-[var(--text-primary)] mt-1 tabular-nums tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Severity bars */}
      <div className="glass-card p-4">
        <div className="flex gap-4">
          {(["critical", "high", "medium", "low", "info"] as const).map((sev) => (
            <div key={sev} className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <SeverityBadge severity={sev} />
                <span className="text-[11px] font-mono text-[var(--text-secondary)] tabular-nums">
                  {severityCounts[sev] || 0}
                </span>
              </div>
              <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sev === "critical" ? "bg-red-400/70" :
                    sev === "high" ? "bg-orange-400/70" :
                    sev === "medium" ? "bg-yellow-400/70" :
                    sev === "low" ? "bg-sky-400/70" : "bg-zinc-400/70"
                  }`}
                  style={{
                    width: `${scan.findings.length > 0 ? ((severityCounts[sev] || 0) / scan.findings.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-secondary)]">
        {(["security", "trackers", "pages"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-[13px] font-medium capitalize border-b-2 transition-colors cursor-pointer ${
              activeTab === tab
                ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab === "pages" ? "Crawled Pages" : tab} (
            {tab === "security"
              ? securityFindings.length
              : tab === "trackers"
              ? trackerFindings.length
              : scan.crawledPages.length}
            )
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "security" && (
        <div className="space-y-2">
          {securityFindings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
          {securityFindings.length === 0 && (
            <div className="glass-card p-6 text-center text-[var(--text-secondary)] text-[13px]">
              No security vulnerabilities found!
            </div>
          )}
        </div>
      )}

      {activeTab === "trackers" && (
        <div className="space-y-2">
          {trackerFindings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
          {trackerFindings.length === 0 && (
            <div className="glass-card p-6 text-center text-[var(--text-secondary)] text-[13px]">
              No third-party trackers detected.
            </div>
          )}
        </div>
      )}

      {activeTab === "pages" && (
        <div className="glass-card overflow-hidden divide-y divide-[var(--border-secondary)]">
          {scan.crawledPages.map((page, index) => (
            <div
              key={`${page.url}-${index}`}
              className="flex items-center gap-3 px-4 py-2.5 text-[12px]"
            >
              <span
                className={`font-mono font-medium tabular-nums ${
                  page.status >= 200 && page.status < 300
                    ? "text-emerald-400"
                    : page.status >= 400
                      ? "text-red-400"
                      : "text-yellow-400"
                }`}
              >
                {page.status}
              </span>
              <span className="text-[var(--text-secondary)] font-mono truncate flex-1">
                {page.url}
              </span>
              <span className="text-[var(--text-secondary)] shrink-0 tabular-nums">
                {page.cookies.length}c · {page.forms.length}f
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Finding Card ──

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="glass-card">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-3.5 cursor-pointer text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <SeverityBadge severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            {finding.title}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 font-mono truncate">
            {finding.affectedUrl}
          </p>
        </div>
        <span className="text-[10px] text-[var(--text-secondary)] font-mono bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
          {finding.category}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
        )}
      </button>

      {/* Details */}
      {expanded && (
        <div className="border-t border-[var(--border-secondary)]">

          {/* Description + Evidence */}
          <div className="px-3.5 py-3.5 space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Description</p>
              <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{finding.description}</p>
            </div>

            {finding.evidence && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Evidence</p>
                <code className="block text-[11px] text-yellow-400 bg-[var(--bg-inset)] rounded-md px-3 py-2.5 font-mono overflow-x-auto leading-relaxed">
                  {finding.evidence}
                </code>
              </div>
            )}
          </div>

          {/* Remediation panel */}
          {finding.remediation && (() => {
            return (
              <div className="border-t border-[var(--border-secondary)]">

                {/* Explanation */}
                <div className="px-3.5 py-3.5 space-y-1">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">
                    What's the risk
                  </p>
                  <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">
                    {finding.remediation.explanation}
                  </p>
                </div>

                {/* Cursor AI Prompt — primary CTA */}
                <div className="border-t border-indigo-500/30 bg-indigo-500/[0.06] px-3.5 py-4">
                  <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest mb-2.5">
                    Fix with Cursor AI
                  </p>
                  <div className="flex items-start gap-3">
                    <p className="text-[13px] text-[var(--text-primary)] leading-relaxed flex-1">
                      {finding.remediation.cursorPrompt}
                    </p>
                    <button
                      onClick={() => handleCopy(finding.remediation!.cursorPrompt, "cursor")}
                      className="flex items-center gap-1.5 shrink-0 text-[12px] font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-md px-3 py-1.5 transition-colors cursor-pointer mt-0.5"
                    >
                      {copied === "cursor" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === "cursor" ? "Copied" : "Copy prompt"}
                    </button>
                  </div>
                </div>

              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}
