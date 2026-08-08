import type { CrawledPage, Finding } from "../types.js";
import type { NetworkResponseInfo } from "../crawler/crawler.js";

/**
 * Base interface for all security heuristic checkers.
 * Each checker receives the full set of crawled data and returns findings.
 */
export interface SecurityChecker {
  name: string;
  check(context: CheckContext): Finding[];
}

export interface CheckContext {
  crawledPages: CrawledPage[];
  networkResponses: NetworkResponseInfo[];
  targetUrl: string;
}
