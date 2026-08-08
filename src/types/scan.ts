// ── Severity levels for findings ──
export type Severity = "critical" | "high" | "medium" | "low" | "info";

// ── Vulnerability categories ──
export type VulnerabilityCategory =
  | "missing-header"
  | "insecure-cookie"
  | "jwt-exposure"
  | "api-key-leak"
  | "reflected-input"
  | "xss-reflected"
  | "sqli-reflected"
  | "csrf-missing"
  | "mixed-content"
  | "misconfiguration"
  | "sensitive-exposure"
  | "information-leak"
  | "cors-misconfiguration";

// ── Individual security finding ──
export interface Finding {
  id: string;
  category: VulnerabilityCategory;
  severity: Severity;
  title: string;
  description: string;
  affectedUrl: string;
  evidence?: string;
  remediation?: AiRemediation;
  detectedAt: string;
}

// ── AI-generated remediation ──
export interface AiRemediation {
  explanation: string;
  fix: string;
  cursorPrompt: string;
}

// ── Page data collected during crawl ──
export interface CrawledPage {
  url: string;
  status: number;
  headers: Record<string, string>;
  cookies: CookieInfo[];
  forms: FormInfo[];
  scripts: string[];
  timestamp: string;
}

export interface CookieInfo {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

export interface FormInfo {
  action: string;
  method: string;
  hasCSRFToken: boolean;
  inputs: { name: string; type: string }[];
}

// ── Scan lifecycle ──
export type ScanStatus =
  | "idle"
  | "crawling"
  | "analyzing"
  | "generating-report"
  | "completed"
  | "error"
  | "aborted";

export interface ScanConfig {
  targetUrl: string;
  maxDepth: number;
  maxPages: number;
}

export interface ScanResult {
  id: string;
  config: ScanConfig;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  pagesVisited: number;
  crawledPages: CrawledPage[];
  findings: Finding[];
  progress: number; // 0-100
}

// ── Severity metadata (for UI) ──
export const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; color: string; bg: string; border: string }
> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bg: "bg-red-500/8",
    border: "border-red-500/10",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-500/8",
    border: "border-orange-500/10",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    bg: "bg-yellow-500/8",
    border: "border-yellow-500/10",
  },
  low: {
    label: "Low",
    color: "text-sky-400",
    bg: "bg-sky-500/8",
    border: "border-sky-500/10",
  },
  info: {
    label: "Info",
    color: "text-zinc-400",
    bg: "bg-zinc-500/8",
    border: "border-zinc-500/10",
  },
};
