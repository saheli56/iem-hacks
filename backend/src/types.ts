// ── Shared types mirrored from frontend ──
// Kept in sync manually for now; can be extracted to a shared package later.

export type Severity = "critical" | "high" | "medium" | "low" | "info";

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

export interface AiRemediation {
  explanation: string;
  fix: string;
  cursorPrompt: string;
}

export interface CrawledPage {
  url: string;
  status: number;
  headers: Record<string, string>;
  cookies: CookieInfo[];
  forms: FormInfo[];
  scripts: string[];
  timestamp: string;
  /** Results from active form-probing with injection payloads */
  formSubmissions: FormSubmissionResult[];
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

export interface FormSubmissionResult {
  /** URL of the page where the form was found */
  sourceUrl: string;
  /** Resolved action URL the form was submitted to */
  formAction: string;
  /** HTTP method (GET or POST) */
  method: string;
  /** The probe payload that was injected */
  payloadUsed: string;
  /** Category of the payload: 'xss' | 'sqli' */
  payloadType: "xss" | "sqli";
  /** True when the raw payload was found verbatim in the response body */
  reflectedInResponse: boolean;
  /** Short snippet of response text containing the reflection (if any) */
  responseSnippet?: string;
}

export type ScanStatus =
  | "idle"
  | "crawling"
  | "analyzing"
  | "generating-report"
  | "completed"
  | "aborted"
  | "error";

export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

export interface ScanConfig {
  targetUrl: string;
  maxDepth: number;
  maxPages: number;
  sessionCookies?: SessionCookie[];
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
  progress: number;
}
