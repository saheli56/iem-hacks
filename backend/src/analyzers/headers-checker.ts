import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding, Severity } from "../types.js";

interface HeaderRule {
  header: string;
  severity: Severity;
  title: string;
  description: string;
}

const REQUIRED_HEADERS: HeaderRule[] = [
  {
    header: "content-security-policy",
    severity: "high",
    title: "Missing Content-Security-Policy (CSP) Header",
    description:
      "CSP helps prevent XSS attacks by controlling which resources the browser is allowed to load. Without it, the application is vulnerable to inline script injection and unauthorized resource loading.",
  },
  {
    header: "strict-transport-security",
    severity: "high",
    title: "Missing Strict-Transport-Security (HSTS) Header",
    description:
      "HSTS forces browsers to use HTTPS connections, preventing protocol downgrade attacks and cookie hijacking. Without it, users may be vulnerable to man-in-the-middle attacks.",
  },
  {
    header: "x-content-type-options",
    severity: "medium",
    title: "Missing X-Content-Type-Options Header",
    description:
      "This header prevents browsers from MIME-sniffing a response away from the declared Content-Type, reducing exposure to drive-by download attacks.",
  },
  {
    header: "x-frame-options",
    severity: "medium",
    title: "Missing X-Frame-Options Header",
    description:
      "This header protects against clickjacking attacks by controlling whether the page can be embedded in iframes. Consider using 'DENY' or 'SAMEORIGIN'.",
  },
  {
    header: "referrer-policy",
    severity: "low",
    title: "Missing Referrer-Policy Header",
    description:
      "Controls how much referrer information is sent with requests. Without it, sensitive URL parameters may leak to third-party sites.",
  },
  {
    header: "permissions-policy",
    severity: "low",
    title: "Missing Permissions-Policy Header",
    description:
      "Permissions-Policy allows fine-grained control over browser features like camera, microphone, and geolocation. Without it, embedded content may access sensitive APIs.",
  },
  {
    header: "x-xss-protection",
    severity: "info",
    title: "Missing X-XSS-Protection Header",
    description:
      "While largely superseded by CSP, this header enables the browser's built-in XSS filter. Setting it to '1; mode=block' provides an extra layer of defense in older browsers.",
  },
];

export class HeadersChecker implements SecurityChecker {
  name = "Missing Security Headers";

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    const checked = new Set<string>();

    for (const page of context.crawledPages) {
      // Only check HTML responses
      const contentType = page.headers["content-type"] ?? "";
      if (!contentType.includes("text/html")) continue;

      // Skip non-200 responses for header checks
      if (page.status < 200 || page.status >= 300) continue;

      for (const rule of REQUIRED_HEADERS) {
        const key = `${rule.header}:${page.url}`;
        if (checked.has(key)) continue;
        checked.add(key);

        const headerValue = page.headers[rule.header];
        if (!headerValue) {
          findings.push({
            id: uuidv4(),
            category: "missing-header",
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            affectedUrl: page.url,
            evidence: `Response headers do not include '${rule.header}'`,
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // Check for X-Powered-By (information disclosure)
      if (page.headers["x-powered-by"]) {
        const key = `x-powered-by:${page.url}`;
        if (!checked.has(key)) {
          checked.add(key);
          findings.push({
            id: uuidv4(),
            category: "misconfiguration",
            severity: "low",
            title: "X-Powered-By Header Exposes Server Technology",
            description:
              "The X-Powered-By header reveals the server technology in use, which helps attackers target known vulnerabilities for that stack.",
            affectedUrl: page.url,
            evidence: `X-Powered-By: ${page.headers["x-powered-by"]}`,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return findings;
  }
}
