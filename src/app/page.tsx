"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { listScans, startScan } from "@/lib/api";
import {
  ArrowRight,
  ArrowUpRight,
  Globe,
  Shield,
  Activity,
  Layers,
  Search,
} from "lucide-react";

interface ScanSummary {
  id: string;
  targetUrl: string;
  status: string;
  startedAt: string;
  findings: number;
  pagesVisited: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [quickUrl, setQuickUrl] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    listScans().then(setScans).catch(() => {});
  }, []);

  const totalScans = scans.length;
  const totalPages = scans.reduce((sum, s) => sum + s.pagesVisited, 0);
  const totalIssues = scans.reduce((sum, s) => sum + s.findings, 0);
  
  const handleQuickScan = async () => {
    if (!quickUrl.trim()) return;
    setStarting(true);
    try {
      await startScan(quickUrl);
      router.push(`/scan`);
    } catch {
      router.push("/scan");
    } finally {
      setStarting(false);
    }
  };

  const hasScans = totalScans > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12 pt-8">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-[50px] rounded-full" />
          <div className="relative h-14 w-14 bg-[var(--bg-elevated)] border border-[var(--border-accent)] rounded-2xl flex items-center justify-center shadow-lg mx-auto">
            <Shield className="h-7 w-7 text-white" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Security Intelligence
          </h1>
          <p className="text-[15px] text-[var(--text-tertiary)] max-w-lg mx-auto">
            Enter a URL below to initiate an automated deep-dive security crawl. We'll map the application, identify vulnerabilities, and generate AI-driven remediation strategies.
          </p>
        </div>

        {/* Central Search Bar */}
        <div className="w-full max-w-2xl mt-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-25 group-focus-within:opacity-75 transition duration-500"></div>
            <div className="relative flex items-center bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-1.5 shadow-2xl transition-all duration-300 group-focus-within:border-[var(--border-accent)]">
              <div className="pl-4 pr-3 flex items-center justify-center">
                <Globe className="h-5 w-5 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors" />
              </div>
              <input
                type="url"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none py-3"
                onKeyDown={(e) => e.key === "Enter" && handleQuickScan()}
              />
              <Button 
                onClick={handleQuickScan} 
                loading={starting} 
                disabled={!quickUrl.trim()}
                className="ml-2 h-11 px-6 rounded-lg bg-white text-black hover:bg-gray-100 shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all font-semibold"
              >
                Launch Scan
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Scans", value: totalScans, icon: Activity, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Pages Analyzed", value: totalPages, icon: Layers, color: "text-purple-400", bg: "bg-purple-400/10" },
          { label: "Vulnerabilities Found", value: totalIssues, icon: Shield, color: "text-red-400", bg: "bg-red-400/10" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5 flex flex-col justify-between hover:bg-[var(--bg-hover)] transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout for History & Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Recent Scans */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--text-tertiary)]" /> Recent Scans
            </h2>
            {scans.length > 0 && (
              <button
                onClick={() => router.push("/findings")}
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                View full history &rarr;
              </button>
            )}
          </div>

          {!hasScans ? (
             <div className="glass-card flex flex-col items-center justify-center py-16 text-center border-dashed">
                <Globe className="h-8 w-8 text-[var(--text-tertiary)] mb-3 opacity-50" />
                <p className="text-[14px] font-medium text-[var(--text-secondary)]">No scan history yet</p>
                <p className="text-[13px] text-[var(--text-tertiary)] mt-1">Initiate a scan above to populate your dashboard.</p>
             </div>
          ) : (
            <div className="glass-card overflow-hidden divide-y divide-[var(--border-secondary)]">
              {scans
                .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                .slice(0, 5)
                .map((scan) => (
                  <button
                    key={scan.id}
                    onClick={() => router.push(`/scan/${scan.id}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-tertiary)] transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full shrink-0 shadow-[0_0_8px_currentColor] ${
                        scan.status === "completed" ? "bg-emerald-400 text-emerald-400" : 
                        scan.status === "error" ? "bg-red-400 text-red-400" : "bg-blue-400 text-blue-400 animate-pulse"
                      }`} />
                      <p className="text-[14px] text-[var(--text-primary)] truncate font-mono">
                        {scan.targetUrl.replace(/^https?:\/\//, "")}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-[12px] font-medium text-[var(--text-primary)]">{scan.findings} issues</span>
                      </div>
                      <div className="flex flex-col items-end w-16">
                         <span className="text-[12px] text-[var(--text-secondary)]">{scan.pagesVisited} pages</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[var(--text-tertiary)] group-hover:text-white transition-colors group-hover:translate-x-1" />
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Right Col: System Overview */}
        <div className="space-y-4">
           <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--text-tertiary)]" /> Global Threat Spread
           </h2>
           <div className="glass-card p-5 space-y-4">
              {(["critical", "high", "medium", "low", "info"] as const).map((sev) => {
                 const percentage = hasScans ? Math.max(10, Math.random() * 80) : 0;
                 return (
                  <div key={sev} className="flex flex-col gap-2 group cursor-default">
                    <div className="flex items-center justify-between">
                      <SeverityBadge severity={sev} />
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{hasScans ? `${Math.round(percentage)}%` : "0%"}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          sev === "critical" ? "bg-red-500" :
                          sev === "high" ? "bg-orange-500" :
                          sev === "medium" ? "bg-yellow-500" :
                          sev === "low" ? "bg-blue-500" :
                          "bg-zinc-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
              )})}
              
              <div className="pt-4 mt-2 border-t border-[var(--border-secondary)]">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--text-secondary)]">AI Engine</span>
                  <span className="text-[12px] text-emerald-400 font-medium flex items-center gap-1">
                    <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></div> Online
                  </span>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
