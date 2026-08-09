import { Crawler, type CrawlResult } from "./crawler.js";
import { analyzeResults } from "../analyzers/index.js";
import { generateRemediations } from "../ai/remediation.js";
import { scanEventBus } from "../events.js";
import type { ScanResult, ScanConfig, ScanStatus } from "../types.js";

/**
 * Manages the lifecycle of a scan: crawl → (later) analyze → (later) report.
 * Mutates the ScanResult in-place so the API can poll for progress.
 */
export class ScanManager {
  // Store both the crawler and the scan so abort() can update scan.status immediately
  private activeCrawlers = new Map<string, { crawler: Crawler; scan: ScanResult }>();

  /** Kick off a scan. Mutates the passed ScanResult as it progresses. */
  async startScan(scan: ScanResult): Promise<void> {
    scan.status = "crawling";
    scan.progress = 0;

    scanEventBus.emit(scan.id, {
      type: "scan:started",
      data: { targetUrl: scan.config.targetUrl, config: scan.config },
    });

    const crawler = new Crawler(scan.config, scan.id, (progress) => {
      scan.pagesVisited = progress.pagesVisited;
      scan.progress = progress.progress;
    });

    this.activeCrawlers.set(scan.id, { crawler, scan });

    try {
      console.log(`[ScanManager] Starting crawl for scan ${scan.id}`);
      const result: CrawlResult = await crawler.run();

      // Bail immediately if the scan was aborted while crawling
      if ((scan.status as ScanStatus) === "aborted") return;

      scan.crawledPages = result.crawledPages;
      scan.pagesVisited = result.crawledPages.length;
      scan.progress = 100;

      // ── Phase 3: Heuristic Analysis ──
      scan.status = "analyzing";
      scanEventBus.emit(scan.id, {
        type: "scan:status-change",
        data: { status: "analyzing", pagesVisited: scan.pagesVisited },
      });
      console.log(`[ScanManager] Running heuristic analysis for scan ${scan.id}`);
      const findings = analyzeResults(result, scan.config.targetUrl, scan.id);

      if ((scan.status as ScanStatus) === "aborted") return;
      scan.findings = findings;

      // ── Phase 4: AI Remediation ──
      scan.status = "generating-report";
      scanEventBus.emit(scan.id, {
        type: "scan:status-change",
        data: { status: "generating-report", findingsCount: findings.length },
      });
      console.log(`[ScanManager] Generating AI remediations for scan ${scan.id}`);
      await generateRemediations(scan.findings, scan.id, (scan.config as any).geminiKey);

      if ((scan.status as ScanStatus) === "aborted") return;

      scan.status = "completed";
      scan.completedAt = new Date().toISOString();

      scanEventBus.emit(scan.id, {
        type: "scan:completed",
        data: {
          pagesVisited: scan.pagesVisited,
          findingsCount: scan.findings.length,
          duration: Date.now() - new Date(scan.startedAt).getTime(),
        },
      });

      console.log(
        `[ScanManager] Scan ${scan.id} completed — ${scan.pagesVisited} pages crawled`
      );
    } catch (err) {
      // Don't overwrite "aborted" status with "error"
      if ((scan.status as ScanStatus) !== "aborted") {
        scan.status = "error";
        scan.completedAt = new Date().toISOString();
        scanEventBus.emit(scan.id, {
          type: "scan:error",
          data: { error: (err as Error).message },
        });
        console.error(`[ScanManager] Scan ${scan.id} failed:`, (err as Error).message);
      }
    } finally {
      this.activeCrawlers.delete(scan.id);
    }
  }

  /** Abort a running scan — works in any phase (crawling, analyzing, AI) */
  abortScan(scanId: string): boolean {
    const entry = this.activeCrawlers.get(scanId);
    if (entry) {
      const { crawler, scan } = entry;
      crawler.abort();
      // Set status immediately so the startScan loop bails at its next check
      scan.status = "aborted";
      scan.completedAt = new Date().toISOString();
      scanEventBus.emit(scanId, {
        type: "scan:aborted",
        data: { message: "Scan cancelled by user" },
      });
      this.activeCrawlers.delete(scanId);
      return true;
    }
    return false;
  }
}

// Singleton instance
export const scanManager = new ScanManager();
