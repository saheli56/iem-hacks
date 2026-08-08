import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

/**
 * Detects common misconfigurations:
 * - Mixed content (HTTP resources on HTTPS pages)
 * - Directory listing indicators
 * - Sensitive file exposure
 * - Server version disclosure
 * - Open redirect patterns
 */
export class MisconfigChecker implements SecurityChecker {
  name = "Misconfigurations";

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    const seen = new Set<string>();

    for (const page of context.crawledPages) {
      this.checkMixedContent(page.url, page.scripts, findings, seen);
      this.checkDirectoryListing(page, findings, seen);
      this.checkServerVersionDisclosure(page, findings, seen);
      this.checkReflectedInput(page, findings, seen);
    }

    this.checkSensitiveEndpoints(context, findings, seen);

    return findings;
  }

  /** Detect HTTP resources loaded on HTTPS pages */
  private checkMixedContent(
    pageUrl: string,
    scripts: string[],
    findings: Finding[],
    seen: Set<string>
  ) {
    if (!pageUrl.startsWith("https://")) return;

    for (const script of scripts) {
      if (script.startsWith("[external]")) {
        const src = script.replace("[external] ", "");
        if (src.startsWith("http://")) {
          const key = `mixed:${src}`;
          if (seen.has(key)) continue;
          seen.add(key);

          findings.push({
            id: uuidv4(),
            category: "mixed-content",
            severity: "medium",
            title: "Mixed Content: HTTP Resource on HTTPS Page",
            description:
              "An HTTP resource is being loaded on an HTTPS page. This can be blocked by browsers and undermines the security of the HTTPS connection.",
            affectedUrl: pageUrl,
            evidence: `HTTP script source: ${src}`,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  /** Detect directory listing indicators in HTML */
  private checkDirectoryListing(
    page: { url: string; scripts: string[] },
    findings: Finding[],
    seen: Set<string>
  ) {
    const dirPatterns = /Index of \/|Directory listing for|Parent Directory/i;
    for (const script of page.scripts) {
      if (script.startsWith("[inline]") && dirPatterns.test(script)) {
        const key = `dir:${page.url}`;
        if (seen.has(key)) continue;
        seen.add(key);

        findings.push({
          id: uuidv4(),
          category: "misconfiguration",
          severity: "medium",
          title: "Directory Listing Detected",
          description:
            "The server appears to have directory listing enabled, which exposes file structure and potentially sensitive files to anyone.",
          affectedUrl: page.url,
          evidence: "Page content matches directory listing patterns",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  /** Detect server version numbers in headers */
  private checkServerVersionDisclosure(
    page: { url: string; headers: Record<string, string> },
    findings: Finding[],
    seen: Set<string>
  ) {
    const versionHeaders = ["server", "x-aspnet-version", "x-aspnetmvc-version"];
    const versionPattern = /\d+\.\d+/;

    for (const header of versionHeaders) {
      const value = page.headers[header];
      if (value && versionPattern.test(value)) {
        const key = `version:${header}:${page.url}`;
        if (seen.has(key)) continue;
        seen.add(key);

        findings.push({
          id: uuidv4(),
          category: "misconfiguration",
          severity: "low",
          title: `Server Version Disclosed via '${header}' Header`,
          description:
            "The server reveals its version number in response headers. This information helps attackers identify known vulnerabilities for that specific version.",
          affectedUrl: page.url,
          evidence: `${header}: ${value}`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  /** Basic reflected input detection — look for URL params echoed in scripts */
  private checkReflectedInput(
    page: { url: string; scripts: string[] },
    findings: Finding[],
    seen: Set<string>
  ) {
    try {
      const url = new URL(page.url);
      if (url.search.length < 2) return;

      for (const [, value] of url.searchParams) {
        if (value.length < 4) continue;
        for (const script of page.scripts) {
          if (script.startsWith("[inline]") && script.includes(value)) {
            const key = `reflected:${value}:${page.url}`;
            if (seen.has(key)) continue;
            seen.add(key);

            findings.push({
              id: uuidv4(),
              category: "reflected-input",
              severity: "high",
              title: "Potential Reflected Input in Page Content",
              description:
                "A URL query parameter value appears to be reflected in an inline script on the page. This may indicate a reflected XSS vulnerability where user-controlled input is not properly sanitized.",
              affectedUrl: page.url,
              evidence: `URL parameter value '${value.substring(0, 40)}' found in inline script`,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // Invalid URL, skip
    }
  }

  /** Check for sensitive endpoints based on network responses */
  private checkSensitiveEndpoints(
    context: CheckContext,
    findings: Finding[],
    seen: Set<string>
  ) {
    const sensitivePatterns = [
      { pattern: /\/\.env/i, name: ".env file" },
      { pattern: /\/\.git\//i, name: ".git directory" },
      { pattern: /\/wp-admin/i, name: "WordPress admin" },
      { pattern: /\/phpinfo/i, name: "PHP info page" },
      { pattern: /\/actuator/i, name: "Spring Boot actuator" },
      { pattern: /\/debug/i, name: "Debug endpoint" },
      { pattern: /\/swagger|\/api-docs/i, name: "API documentation" },
    ];

    for (const resp of context.networkResponses) {
      if (resp.status >= 200 && resp.status < 300) {
        for (const rule of sensitivePatterns) {
          if (rule.pattern.test(resp.url)) {
            const key = `sensitive:${rule.name}:${resp.url}`;
            if (seen.has(key)) continue;
            seen.add(key);

            findings.push({
              id: uuidv4(),
              category: "misconfiguration",
              severity: "high",
              title: `Sensitive Endpoint Accessible: ${rule.name}`,
              description: `The endpoint '${resp.url}' appears to expose ${rule.name}, which may contain sensitive configuration or debugging information.`,
              affectedUrl: resp.fromPage,
              evidence: `HTTP ${resp.status} response from ${resp.url}`,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }
}
