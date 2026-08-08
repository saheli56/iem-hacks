import { chromium, firefox, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import { extractPageData } from "./extractor.js";
import { submitFormsForProbing } from "./form-submitter.js";
import type { CrawledPage, ScanConfig } from "../types.js";
import { scanEventBus } from "../events.js";

export interface CrawlProgress {
  pagesVisited: number;
  totalQueued: number;
  currentUrl: string;
  progress: number; // 0-100
}

export interface CrawlResult {
  crawledPages: CrawledPage[];
  networkResponses: NetworkResponseInfo[];
}

export interface NetworkResponseInfo {
  url: string;
  status: number;
  contentType: string;
  fromPage: string;
  responseHeaders: Record<string, string>;
  body?: string;
}

interface QueueEntry {
  url: string;
  depth: number;
}

export class Crawler {
  private config: ScanConfig;
  private scanId: string;
  private visited = new Set<string>();
  private queue: QueueEntry[] = [];
  private crawledPages: CrawledPage[] = [];
  private networkResponses: NetworkResponseInfo[] = [];
  private browser: Browser | null = null;
  /** Stored so the form prober can open new tabs in the same session */
  private context: BrowserContext | null = null;
  private onProgress?: (progress: CrawlProgress) => void;
  private aborted = false;

  constructor(
    config: ScanConfig,
    scanId: string,
    onProgress?: (progress: CrawlProgress) => void
  ) {
    this.config = config;
    this.scanId = scanId;
    this.onProgress = onProgress;
  }

  /** Abort the crawl gracefully */
  abort() {
    this.aborted = true;
  }

  /** Run the full crawl and return results */
  async run(): Promise<CrawlResult> {
    try {
      console.log("[Crawler] Launching browser...");
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      console.log("[Crawler] Browser launched successfully");

      this.context = await this.browser.newContext({
        userAgent:
          "TrustIssue/0.1 (Security Scanner; developer-tool) Mozilla/5.0",
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
      });
      const context = this.context;

      // Inject session cookies if provided (authenticated scanning)
      if (this.config.sessionCookies?.length) {
        const seedUrl = new URL(this.config.targetUrl);
        await context.addCookies(
          this.config.sessionCookies.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || "/",
            secure: seedUrl.protocol === "https:",
          }))
        );
        console.log(`[Crawler] Injected ${this.config.sessionCookies.length} session cookies`);
      }

      // Seed the queue
      const seedUrl = this.normalizeUrl(this.config.targetUrl);
      this.queue.push({ url: seedUrl, depth: 0 });
      console.log(`[Crawler] Starting BFS from ${seedUrl}`);

      while (this.queue.length > 0 && !this.aborted) {
        if (this.visited.size >= this.config.maxPages) break;

        const entry = this.queue.shift()!;
        if (this.visited.has(entry.url)) continue;
        if (entry.depth > this.config.maxDepth) continue;

        this.visited.add(entry.url);

        // Report progress
        this.emitProgress(entry.url);

        const page = await context.newPage();

        try {
          console.log(`[Crawler] Visiting: ${entry.url} (depth: ${entry.depth})`);

          // Emit navigating event
          scanEventBus.emit(this.scanId, {
            type: "crawler:page-navigating",
            data: { url: entry.url, depth: entry.depth, pagesVisited: this.visited.size },
          });

          // Hard 60-second cap per page (navigation + form probing + screenshot combined)
          let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
          const work = (async () => {
            const pageData = await this.crawlPage(page, entry);
            if (!pageData) return;

            // ── Form probing: skip if scan was aborted while we were navigating ──
            if (!this.aborted && pageData.pageData.forms.length > 0 && this.context) {
              console.log(
                `[Crawler] Probing ${pageData.pageData.forms.length} form(s) on ${entry.url}`
              );
              try {
                const submissions = await submitFormsForProbing(
                  this.context,
                  entry.url,
                  pageData.pageData.forms
                );
                pageData.pageData.formSubmissions = submissions;

                const reflected = submissions.filter((s) => s.reflectedInResponse);
                if (reflected.length > 0) {
                  console.log(
                    `[Crawler] ⚠ ${reflected.length} reflected payload(s) detected on ${entry.url}`
                  );
                  scanEventBus.emit(this.scanId, {
                    type: "crawler:form-probe-result",
                    data: {
                      url: entry.url,
                      formsProbed: submissions.length,
                      reflectionsFound: reflected.length,
                    },
                  });
                }
              } catch (probeErr) {
                console.warn(
                  `[Crawler] Form probing failed for ${entry.url}:`,
                  (probeErr as Error).message
                );
              }
            }

            this.crawledPages.push(pageData.pageData);

            // Capture a viewport screenshot (low quality JPEG for speed)
            let screenshot: string | undefined;
            try {
              const buf = await page.screenshot({ type: "jpeg", quality: 40, timeout: 5000 });
              screenshot = buf.toString("base64");
            } catch {
              // Non-critical — skip screenshot on failure
            }

            // Emit page-loaded event
            scanEventBus.emit(this.scanId, {
              type: "crawler:page-loaded",
              data: {
                url: entry.url,
                status: pageData.pageData.status,
                linksFound: pageData.discoveredLinks.length,
                pagesVisited: this.visited.size,
              },
            });

            if (screenshot) {
              scanEventBus.emit(this.scanId, {
                type: "crawler:screenshot",
                data: { url: entry.url, screenshot },
              });
            }

            // Filter and enqueue discovered links
            for (const link of pageData.discoveredLinks) {
              const normalized = this.normalizeUrl(link);
              if (this.shouldFollow(normalized)) {
                this.queue.push({ url: normalized, depth: entry.depth + 1 });
              }
            }
          })();

          // Suppress unhandled rejection if page closes after timeout fires
          work.catch(() => {});

          await Promise.race([
            work,
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(
                () => reject(new Error("Page processing timed out (60s)")),
                60_000
              );
            }),
          ]).finally(() => clearTimeout(timeoutHandle));
        } catch (err) {
          console.error(`[Crawler] Error crawling ${entry.url}:`, (err as Error).message);
          scanEventBus.emit(this.scanId, {
            type: "crawler:page-error",
            data: { url: entry.url, error: (err as Error).message },
          });
        } finally {
          await page.close().catch(() => {}); // .catch() in case page already closed by timeout
        }
      }

      await context.close();
      return {
        crawledPages: this.crawledPages,
        networkResponses: this.networkResponses,
      };
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  /** Crawl a single page: navigate, intercept network, extract data */
  private async crawlPage(page: Page, entry: QueueEntry) {
    // Intercept network responses for analysis (capture body for text/JSON)
    page.on("response", (resp: Response) => {
      // Cap total captured responses to prevent memory explosion on resource-heavy sites
      if (this.networkResponses.length >= 500) return;

      const ct = resp.headers()["content-type"] ?? "";
      const info: NetworkResponseInfo = {
        url: resp.url(),
        status: resp.status(),
        contentType: ct,
        fromPage: entry.url,
        responseHeaders: resp.headers(),
      };

      // Push immediately (sync) so headers are always captured even if body fetch fails
      this.networkResponses.push(info);

      // Capture body for JSON/text API responses asynchronously
      const isTextual = ct.includes("json") || ct.includes("text/plain") || ct.includes("text/xml");
      if (isTextual) {
        resp.text().then((body) => {
          if (body.length <= 32_000) info.body = body;
        }).catch(() => { /* body unavailable for redirects/already-consumed responses */ });
      }
    });

    // Navigate with timeout
    const response = await page.goto(entry.url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Brief wait for dynamic content (SPAs, lazy-loaded elements)
    await page.waitForTimeout(500);

    const responseData = response
      ? {
          status: response.status(),
          headers: response.headers(),
        }
      : null;

    return extractPageData(page, responseData);
  }

  /** Normalize URL: strip hash, trailing slash consistency */
  private normalizeUrl(raw: string): string {
    try {
      const u = new URL(raw);
      u.hash = "";
      // Remove trailing slash for consistency (except root)
      if (u.pathname !== "/" && u.pathname.endsWith("/")) {
        u.pathname = u.pathname.slice(0, -1);
      }
      return u.href;
    } catch {
      return raw;
    }
  }

  /** Determine if a link should be followed (same-origin, not visited, etc.) */
  private shouldFollow(url: string): boolean {
    if (this.visited.has(url)) return false;

    try {
      const target = new URL(url);
      const seed = new URL(this.config.targetUrl);

      // Same origin only
      if (target.origin !== seed.origin) return false;

      // Skip common non-page resources
      const skipExtensions = /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff2?|ttf|eot|pdf|zip|mp4|mp3|webm)$/i;
      if (skipExtensions.test(target.pathname)) return false;

      // Skip mailto, tel, javascript links
      if (!["http:", "https:"].includes(target.protocol)) return false;

      return true;
    } catch {
      return false;
    }
  }

  /** Emit progress to callback */
  private emitProgress(currentUrl: string) {
    if (!this.onProgress) return;

    const pagesVisited = this.visited.size;
    const totalQueued = pagesVisited + this.queue.length;
    const progress = Math.min(
      Math.round((pagesVisited / Math.max(this.config.maxPages, 1)) * 100),
      100
    );

    this.onProgress({ pagesVisited, totalQueued, currentUrl, progress });
  }
}
