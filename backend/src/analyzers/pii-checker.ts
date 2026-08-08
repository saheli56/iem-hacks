import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

/**
 * Detects Personally Identifiable Information (PII) leaks in network responses.
 * Looks for common patterns like Credit Card numbers, Social Security Numbers,
 * and high volumes of email addresses.
 */
export class PiiChecker implements SecurityChecker {
  name = "Sensitive Data Leak (PII)";

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    const seenData = new Set<string>();

    const patterns = [
      {
        type: "Credit Card Data",
        regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
        severity: "critical" as const,
      },
      {
        type: "Social Security Number (SSN)",
        regex: /\b(?!000|666)[0-8][0-9]{2}-(?!00)[0-9]{2}-(?!0000)[0-9]{4}\b/g,
        severity: "critical" as const,
      },
      {
        type: "High-Volume Email Leak",
        regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        severity: "high" as const,
      }
    ];

    for (const page of context.crawledPages) {
      if (!page.networkRequests) continue;

      for (const req of page.networkRequests) {
        // Only inspect API and Document responses for PII
        if (!req.responseBody || !["document", "fetch", "xhr"].includes(req.resourceType)) {
          continue;
        }

        for (const pattern of patterns) {
          const matches = req.responseBody.match(pattern.regex);
          
          if (matches && matches.length > 0) {
            // If it's emails, only flag if it looks like a bulk leak (e.g. > 5 unique emails)
            if (pattern.type === "High-Volume Email Leak") {
              const uniqueEmails = new Set(matches);
              if (uniqueEmails.size < 5) continue;
            }

            const matchSample = matches[0];
            const dedupKey = `${pattern.type}-${req.url}-${matchSample}`;
            
            if (!seenData.has(dedupKey)) {
              seenData.add(dedupKey);
              findings.push({
                id: uuidv4(),
                category: "pii-leak",
                severity: pattern.severity,
                title: `Sensitive Data Leak: ${pattern.type}`,
                description: `The application returned sensitive personal data (${pattern.type}) in a response from ${req.url}. Leaking this information can lead to severe compliance violations (GDPR, CCPA) and identity theft.`,
                affectedUrl: req.url,
                evidence: `Found matching data: "${matchSample}" (and potentially others) in the response body.`,
                detectedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return findings;
  }
}
