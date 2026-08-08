import type { ScanResult } from "@/types/scan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Start a new scan */
export function startScan(targetUrl: string, maxDepth = 3, maxPages = 50) {
  return fetchJSON<{ scanId: string; status: string }>(
    `${API_BASE}/api/scan`,
    {
      method: "POST",
      body: JSON.stringify({ targetUrl, maxDepth, maxPages }),
    }
  );
}

/** Get scan status & results */
export async function getScan(scanId: string) {
  try {
    const scan = await fetchJSON<ScanResult>(`${API_BASE}/api/scan/${encodeURIComponent(scanId)}`);
    // Cache completed or aborted scans to localStorage
    if (scan.status === "completed" || scan.status === "aborted") {
      try {
        localStorage.setItem(`trustissue_scan_${scan.id}`, JSON.stringify(scan));
      } catch (e) {
        /* ignore localStorage quota errors */
      }
    }
    return scan;
  } catch (err) {
    // If backend fails (e.g. 404 because it restarted), try to load from local cache!
    try {
      const cached = localStorage.getItem(`trustissue_scan_${scanId}`);
      if (cached) return JSON.parse(cached) as ScanResult;
    } catch (e) {
      /* ignore */
    }
    throw err;
  }
}

/** List all scans */
export async function listScans() {
  let backendScans: any[] = [];
  try {
    backendScans = await fetchJSON<any[]>(`${API_BASE}/api/scan`);
  } catch (err) {
    // If backend is entirely down, we can still show local scans
  }

  // Load local cached scans
  const localScans: any[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("trustissue_scan_")) {
        try {
          const scan = JSON.parse(localStorage.getItem(key)!) as ScanResult;
          localScans.push({
            id: scan.id,
            targetUrl: scan.config.targetUrl,
            status: scan.status,
            startedAt: scan.startedAt,
            findings: scan.findings.length,
            pagesVisited: scan.pagesVisited,
          });
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Merge backend and local scans, preferring backend if both exist
  const mergedMap = new Map<string, any>();
  localScans.forEach((s) => mergedMap.set(s.id, s));
  backendScans.forEach((s) => mergedMap.set(s.id, s));

  return Array.from(mergedMap.values());
}

/** Abort a running scan */
export function abortScan(scanId: string) {
  return fetchJSON<{ message: string }>(
    `${API_BASE}/api/scan/${encodeURIComponent(scanId)}/abort`,
    { method: "POST" }
  );
}

/** Re-generate AI remediation for a finding */
export function regenerateRemediation(scanId: string, findingId: string) {
  return fetchJSON<{ findingId: string; remediation: { explanation: string; fix: string; cursorPrompt: string } }>(
    `${API_BASE}/api/scan/${encodeURIComponent(scanId)}/finding/${encodeURIComponent(findingId)}/remediate`,
    { method: "POST" }
  );
}
