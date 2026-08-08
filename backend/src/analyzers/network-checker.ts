import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

/**
 * Inspects captured network response data for:
 * - Sensitive data exposure in API responses (passwords, tokens, secrets)
 * - Stack traces & debug info in error responses
 * - CORS misconfigurations (overly permissive origins)
 * - Information leakage via verbose error messages
 */
export class NetworkChecker implements SecurityChecker {
  name = "Network Response Analysis";

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    const seen = new Set<string>();

    for (const resp of context.networkResponses) {
      // Only inspect responses that have a captured body
      if (!resp.body) continue;

      this.checkSensitiveDataExposure(resp, findings, seen);
      this.checkStackTraces(resp, findings, seen);
      this.checkVerboseErrors(resp, findings, seen);
    }

    // CORS checks work on headers, don't need body
    for (const resp of context.networkResponses) {
      this.checkCorsMisconfiguration(resp, findings, seen);
    }

    return findings;
  }

  /** Detect sensitive field names in JSON API responses */
  private checkSensitiveDataExposure(
    resp: { url: string; body?: string; fromPage: string; contentType: string; status: number },
    findings: Finding[],
    seen: Set<string>
  ) {
    if (!resp.body) return;
    if (!resp.contentType.includes("json")) return;
    if (resp.status < 200 || resp.status >= 300) return;

    // Sensitive field patterns in JSON keys
    const sensitivePatterns: { pattern: RegExp; label: string; severity: "critical" | "high" | "medium" }[] = [
      { pattern: /"password"\s*:/i, label: "password", severity: "critical" },
      { pattern: /"passwd"\s*:/i, label: "passwd", severity: "critical" },
      { pattern: /"secret"\s*:/i, label: "secret", severity: "critical" },
      { pattern: /"private_?key"\s*:/i, label: "private key", severity: "critical" },
      { pattern: /"ssn"\s*:/i, label: "SSN", severity: "critical" },
      { pattern: /"credit_?card"\s*:/i, label: "credit card", severity: "critical" },
      { pattern: /"card_?number"\s*:/i, label: "card number", severity: "critical" },
      { pattern: /"access_?token"\s*:/i, label: "access token", severity: "high" },
      { pattern: /"refresh_?token"\s*:/i, label: "refresh token", severity: "high" },
      { pattern: /"api_?key"\s*:/i, label: "API key", severity: "high" },
      { pattern: /"api_?secret"\s*:/i, label: "API secret", severity: "high" },
      { pattern: /"auth_?token"\s*:/i, label: "auth token", severity: "high" },
      { pattern: /"session_?id"\s*:/i, label: "session ID", severity: "high" },
      { pattern: /"internal_?ip"\s*:/i, label: "internal IP", severity: "medium" },
      { pattern: /"database_?url"\s*:/i, label: "database URL", severity: "critical" },
      { pattern: /"db_?password"\s*:/i, label: "database password", severity: "critical" },
    ];

    for (const rule of sensitivePatterns) {
      if (rule.pattern.test(resp.body)) {
        const key = `sensitive:${rule.label}:${resp.url}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Extract a snippet around the match for evidence
        const match = resp.body.match(rule.pattern);
        const idx = match?.index ?? 0;
        const snippet = resp.body.substring(Math.max(0, idx - 10), idx + 50).replace(/\n/g, " ").trim();

        findings.push({
          id: uuidv4(),
          category: "sensitive-exposure",
          severity: rule.severity,
          title: `Sensitive Data in API Response: ${rule.label}`,
          description:
            `The API endpoint returns a JSON response containing a '${rule.label}' field. Exposing sensitive data in API responses can lead to credential theft, identity theft, or further exploitation of internal systems.`,
          affectedUrl: resp.url,
          evidence: `Found in response from ${resp.url} (requested by ${resp.fromPage}): ...${snippet}...`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  /** Detect stack traces and debug info in error responses */
  private checkStackTraces(
    resp: { url: string; body?: string; fromPage: string; status: number },
    findings: Finding[],
    seen: Set<string>
  ) {
    if (!resp.body) return;
    if (resp.status < 400) return;

    const tracePatterns: { pattern: RegExp; label: string }[] = [
      { pattern: /at\s+\S+\s+\([\w/\\.:]+:\d+:\d+\)/i, label: "JavaScript/Node.js stack trace" },
      { pattern: /Traceback \(most recent call last\)/i, label: "Python stack trace" },
      { pattern: /java\.\w+\.\w+Exception/i, label: "Java exception" },
      { pattern: /at\s+[\w.$]+\.[\w$]+\([\w]+\.java:\d+\)/i, label: "Java stack trace" },
      { pattern: /Fatal error:.*in\s+\/[\w/]+\.php/i, label: "PHP fatal error" },
      { pattern: /Stack trace:\s*#\d+/i, label: "PHP stack trace" },
      { pattern: /Microsoft\.AspNetCore/i, label: ".NET stack trace" },
      { pattern: /SQLSTATE\[/i, label: "SQL error with state code" },
      { pattern: /SQL syntax.*?near/i, label: "SQL syntax error" },
      { pattern: /ORA-\d{5}/i, label: "Oracle database error" },
      { pattern: /pg_query|pg_connect/i, label: "PostgreSQL error" },
      { pattern: /mysql_|mysqli_/i, label: "MySQL error" },
    ];

    for (const rule of tracePatterns) {
      if (rule.pattern.test(resp.body)) {
        const key = `trace:${rule.label}:${resp.url}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const match = resp.body.match(rule.pattern);
        const snippet = match ? match[0].substring(0, 120) : "";

        findings.push({
          id: uuidv4(),
          category: "information-leak",
          severity: resp.body.match(/sql|database|password|secret/i) ? "high" : "medium",
          title: `${rule.label} Exposed in Error Response`,
          description:
            `An error response from this endpoint contains a ${rule.label}. This reveals internal implementation details, file paths, and potentially database structure to attackers.`,
          affectedUrl: resp.url,
          evidence: `HTTP ${resp.status} response contains: ${snippet}`,
          detectedAt: new Date().toISOString(),
        });

        // One stack trace finding per URL is enough
        break;
      }
    }
  }

  /** Detect verbose error messages leaking internal details */
  private checkVerboseErrors(
    resp: { url: string; body?: string; fromPage: string; status: number },
    findings: Finding[],
    seen: Set<string>
  ) {
    if (!resp.body) return;
    if (resp.status < 400 || resp.status >= 600) return;

    const infoLeakPatterns: { pattern: RegExp; label: string }[] = [
      { pattern: /\/home\/[\w/]+|\/var\/[\w/]+|\/usr\/[\w/]+|C:\\[\w\\]+/i, label: "Internal file path" },
      { pattern: /mongodb:\/\/|postgres:\/\/|mysql:\/\/|redis:\/\//i, label: "Database connection string" },
      { pattern: /Invalid password for user|authentication failed for user/i, label: "User enumeration hint" },
      { pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i, label: "Internal service connectivity error" },
    ];

    for (const rule of infoLeakPatterns) {
      if (rule.pattern.test(resp.body)) {
        const key = `verbose:${rule.label}:${resp.url}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const match = resp.body.match(rule.pattern);
        const snippet = match ? match[0].substring(0, 80) : "";

        findings.push({
          id: uuidv4(),
          category: "information-leak",
          severity: rule.label.includes("Database") ? "critical" : "medium",
          title: `${rule.label} Leaked in Error Response`,
          description:
            `An error response reveals a ${rule.label.toLowerCase()}. This gives attackers insight into the internal architecture and may expose credentials or infrastructure details.`,
          affectedUrl: resp.url,
          evidence: `HTTP ${resp.status} — matched: ${snippet}`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  /** Detect overly permissive CORS configurations */
  private checkCorsMisconfiguration(
    resp: { url: string; responseHeaders: Record<string, string>; fromPage: string; contentType: string },
    findings: Finding[],
    seen: Set<string>
  ) {
    const acao = resp.responseHeaders["access-control-allow-origin"];
    if (!acao) return;

    // Only flag CORS on API-like endpoints (JSON or /api/ paths)
    const isApi = resp.contentType.includes("json") || /\/api\b|\/graphql\b/i.test(resp.url);
    if (!isApi) return;

    if (acao === "*") {
      const key = `cors-wildcard:${resp.url}`;
      if (seen.has(key)) return;
      seen.add(key);

      const allowsCreds = resp.responseHeaders["access-control-allow-credentials"] === "true";

      findings.push({
        id: uuidv4(),
        category: "cors-misconfiguration",
        severity: allowsCreds ? "critical" : "medium",
        title: `CORS Wildcard on API Endpoint${allowsCreds ? " with Credentials" : ""}`,
        description: allowsCreds
          ? "This API endpoint sets Access-Control-Allow-Origin: * AND allows credentials. This is a critical misconfiguration that lets any website read authenticated responses from your API."
          : "This API endpoint allows requests from any origin (Access-Control-Allow-Origin: *). If the endpoint returns sensitive data, any website can read those responses.",
        affectedUrl: resp.url,
        evidence: `Access-Control-Allow-Origin: *${allowsCreds ? ", Access-Control-Allow-Credentials: true" : ""} on ${resp.url}`,
        detectedAt: new Date().toISOString(),
      });
    }

    // Reflect-origin pattern: ACAO mirrors the request origin exactly (dangerous with credentials)
    const acac = resp.responseHeaders["access-control-allow-credentials"];
    if (acao !== "*" && acac === "true" && acao !== "null") {
      // If origin is reflected and credentials are allowed, that's a problem
      const key = `cors-reflect:${resp.url}`;
      if (seen.has(key)) return;
      seen.add(key);

      findings.push({
        id: uuidv4(),
        category: "cors-misconfiguration",
        severity: "high",
        title: "CORS Reflects Origin with Credentials Allowed",
        description:
          "This endpoint reflects the requesting origin in Access-Control-Allow-Origin and allows credentials. If the server doesn't validate allowed origins, any website could make authenticated requests to this API and read the responses.",
        affectedUrl: resp.url,
        evidence: `Access-Control-Allow-Origin: ${acao}, Access-Control-Allow-Credentials: true`,
        detectedAt: new Date().toISOString(),
      });
    }
  }
}
