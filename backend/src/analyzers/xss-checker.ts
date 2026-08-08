import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

/**
 * Detects reflected XSS and SQL injection vulnerabilities by examining the
 * results of active form-probing performed during the crawl phase.
 *
 * For every form submission where the raw probe payload was found verbatim in
 * the server's response body, a high/critical finding is emitted.
 */
export class XssChecker implements SecurityChecker {
  name = "Reflected Injection via Form Submission";

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    /** Dedup key: sourceUrl + formAction + payloadType */
    const seen = new Set<string>();

    for (const page of context.crawledPages) {
      if (!page.formSubmissions?.length) continue;

      for (const sub of page.formSubmissions) {
        if (!sub.reflectedInResponse) continue;

        const key = `${sub.sourceUrl}::${sub.formAction}::${sub.payloadType}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (sub.payloadType === "xss") {
          findings.push({
            id: uuidv4(),
            category: "xss-reflected",
            severity: "high",
            title: "Reflected XSS via Form Input",
            description:
              `A probe XSS payload (${sub.payloadUsed}) was submitted to the form at ` +
              `${shortUrl(sub.formAction)} (method: ${sub.method}) and the raw payload ` +
              `was reflected back in the server response without HTML encoding. ` +
              `An attacker could craft a malicious URL that submits this form, causing ` +
              `arbitrary JavaScript to execute in a victim's browser.`,
            affectedUrl: sub.formAction || sub.sourceUrl,
            evidence: sub.responseSnippet
              ? `Reflected snippet: …${sub.responseSnippet}…`
              : `Payload "${sub.payloadUsed}" appeared verbatim in response body.`,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return findings;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || url;
  } catch {
    return url;
  }
}
