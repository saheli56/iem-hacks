import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { ScanConfig, ScanResult } from "../types.js";
import { scanManager } from "../crawler/scan-manager.js";
import { generateRemediation } from "../ai/remediation.js";

export const scanRouter = Router();

// In-memory scan store (will be replaced with proper state management later)
const scans = new Map<string, ScanResult>();

// POST /api/scan — Start a new scan
scanRouter.post("/", (req: Request, res: Response) => {
  console.log("[DEBUG] /api/scan hit with body:", req.body);
  const { targetUrl, maxDepth = 3, maxPages = 50, sessionCookies, geminiKey } = req.body as Partial<ScanConfig> & { sessionCookies?: { name: string; value: string; domain: string; path: string }[], geminiKey?: string };

  if (!targetUrl || typeof targetUrl !== "string") {
    console.error("[DEBUG] Invalid targetUrl. req.body:", req.body);
    res.status(400).json({ 
      error: "targetUrl is required", 
      debugBody: req.body,
      receivedType: typeof req.body 
    });
    return;
  }

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL format" });
    return;
  }

  // Only allow http/https schemes
  if (!["http:", "https:"].includes(parsed.protocol)) {
    res.status(400).json({ error: "Only HTTP and HTTPS URLs are supported" });
    return;
  }

  // Validate numeric parameters
  const depth = Math.min(Math.max(Number(maxDepth) || 3, 1), 10);
  const pages = Math.min(Math.max(Number(maxPages) || 50, 1), 500);

  const scanId = uuidv4();
  const scan: ScanResult = {
    id: scanId,
    config: { targetUrl: parsed.href, maxDepth: depth, maxPages: pages, geminiKey, ...(Array.isArray(sessionCookies) && sessionCookies.length ? { sessionCookies } : {}) } as any,
    status: "idle",
    startedAt: new Date().toISOString(),
    pagesVisited: 0,
    crawledPages: [],
    findings: [],
    progress: 0,
  };

  scans.set(scanId, scan);

  // Kick off the crawler asynchronously (don't await — let it run in background)
  scanManager.startScan(scan);

  res.status(201).json({ scanId, status: scan.status });
});

// GET /api/scan/:id — Get scan status & results
scanRouter.get("/:id", (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scan = scans.get(id);
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.json(scan);
});

// GET /api/scan — List all scans
scanRouter.get("/", (_req: Request, res: Response) => {
  const allScans = Array.from(scans.values()).map((s) => ({
    id: s.id,
    targetUrl: s.config.targetUrl,
    status: s.status,
    startedAt: s.startedAt,
    findings: s.findings.length,
    pagesVisited: s.pagesVisited,
  }));

  res.json(allScans);
});

// POST /api/scan/:id/abort — Abort a running scan
scanRouter.post("/:id/abort", (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scan = scans.get(id);
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  const aborted = scanManager.abortScan(id);
  if (aborted) {
    scan.status = "aborted";
    scan.completedAt = new Date().toISOString();
    res.json({ message: "Scan aborted", scanId: id });
  } else {
    res.status(400).json({ error: "Scan is not currently running" });
  }
});

// POST /api/scan/:id/finding/:findingId/remediate — Re-generate AI remediation for one finding
scanRouter.post(
  "/:id/finding/:findingId/remediate",
  async (req: Request, res: Response) => {
    const scanId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const findingId = Array.isArray(req.params.findingId)
      ? req.params.findingId[0]
      : req.params.findingId;

    const scan = scans.get(scanId);
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    const finding = scan.findings.find((f) => f.id === findingId);
    if (!finding) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    try {
      const { geminiKey } = req.body;
      const remediation = await generateRemediation(finding, geminiKey);
      finding.remediation = remediation;
      res.json({ findingId, remediation });
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to generate remediation" });
    }
  }
);
