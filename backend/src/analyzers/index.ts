import type { CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";
import type { CrawlResult } from "../crawler/crawler.js";
import { scanEventBus } from "../events.js";
import { HeadersChecker } from "./headers-checker.js";
import { CookiesChecker } from "./cookies-checker.js";
import { JwtExposureChecker } from "./jwt-checker.js";
import { ApiKeyChecker } from "./apikey-checker.js";
import { CsrfChecker } from "./csrf-checker.js";
import { MisconfigChecker } from "./misconfig-checker.js";
import { XssChecker } from "./xss-checker.js";
import { NetworkChecker } from "./network-checker.js";
import { TrackerChecker } from "./tracker-checker.js";

// Register all checkers
const checkers = [
  new HeadersChecker(),
  new CookiesChecker(),
  new JwtExposureChecker(),
  new ApiKeyChecker(),
  new CsrfChecker(),
  new MisconfigChecker(),
  new XssChecker(),
  new NetworkChecker(),
  new TrackerChecker(),
];

/**
 * Runs all registered security checkers against crawled data.
 * Returns a deduplicated, severity-sorted list of findings.
 */
export function analyzeResults(
  crawlResult: CrawlResult,
  targetUrl: string,
  scanId?: string
): Finding[] {
  const context: CheckContext = {
    crawledPages: crawlResult.crawledPages,
    networkResponses: crawlResult.networkResponses,
    targetUrl,
  };

  const allFindings: Finding[] = [];

  for (const checker of checkers) {
    try {
      if (scanId) {
        scanEventBus.emit(scanId, {
          type: "analyzer:checker-start",
          data: { checker: checker.name },
        });
      }

      const findings = checker.check(context);
      console.log(`[Analyzer] ${checker.name}: ${findings.length} finding(s)`);

      if (scanId) {
        scanEventBus.emit(scanId, {
          type: "analyzer:checker-result",
          data: { checker: checker.name, count: findings.length },
        });
      }

      // Emit each finding individually
      for (const finding of findings) {
        allFindings.push(finding);
        if (scanId) {
          scanEventBus.emit(scanId, {
            type: "analyzer:finding",
            data: {
              id: finding.id,
              title: finding.title,
              severity: finding.severity,
              category: finding.category,
              affectedUrl: finding.affectedUrl,
            },
          });
        }
      }
    } catch (err) {
      console.error(
        `[Analyzer] Error in ${checker.name}:`,
        (err as Error).message
      );
    }
  }

  // Sort by severity: critical > high > medium > low > info
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  allFindings.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  console.log(`[Analyzer] Total: ${allFindings.length} findings`);
  return allFindings;
}
