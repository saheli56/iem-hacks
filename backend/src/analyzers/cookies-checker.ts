import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

export class CookiesChecker implements SecurityChecker {
  name = "Insecure Cookies";

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    const checked = new Set<string>();

    for (const page of context.crawledPages) {
      for (const cookie of page.cookies) {
        const key = `${cookie.name}:${page.url}`;
        if (checked.has(key)) continue;
        checked.add(key);

        // Check HttpOnly flag
        if (!cookie.httpOnly) {
          const isSensitive = this.isSensitiveCookie(cookie.name);
          findings.push({
            id: uuidv4(),
            category: "insecure-cookie",
            severity: isSensitive ? "high" : "medium",
            title: `Cookie '${cookie.name}' Missing HttpOnly Flag`,
            description:
              "Without the HttpOnly flag, this cookie is accessible via JavaScript (document.cookie), making it vulnerable to theft through XSS attacks.",
            affectedUrl: page.url,
            evidence: `Cookie '${cookie.name}' — HttpOnly: false`,
            detectedAt: new Date().toISOString(),
          });
        }

        // Check Secure flag
        if (!cookie.secure) {
          findings.push({
            id: uuidv4(),
            category: "insecure-cookie",
            severity: "medium",
            title: `Cookie '${cookie.name}' Missing Secure Flag`,
            description:
              "Without the Secure flag, this cookie can be transmitted over unencrypted HTTP connections, making it vulnerable to interception.",
            affectedUrl: page.url,
            evidence: `Cookie '${cookie.name}' — Secure: false`,
            detectedAt: new Date().toISOString(),
          });
        }

        // Check SameSite attribute
        if (cookie.sameSite === "None" || !cookie.sameSite) {
          findings.push({
            id: uuidv4(),
            category: "insecure-cookie",
            severity: "medium",
            title: `Cookie '${cookie.name}' Has Weak SameSite Policy`,
            description:
              "SameSite=None allows the cookie to be sent in cross-site requests, which can facilitate CSRF attacks. Consider using 'Strict' or 'Lax'.",
            affectedUrl: page.url,
            evidence: `Cookie '${cookie.name}' — SameSite: ${cookie.sameSite || "not set"}`,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return findings;
  }

  /** Heuristic: does this cookie name look like a session or auth token? */
  private isSensitiveCookie(name: string): boolean {
    const sensitivePatterns =
      /session|sess|token|auth|jwt|sid|csrf|xsrf|connect\.sid|PHPSESSID|JSESSIONID/i;
    return sensitivePatterns.test(name);
  }
}
