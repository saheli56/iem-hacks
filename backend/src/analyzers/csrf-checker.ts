import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

/**
 * Detects forms that may be missing CSRF protection.
 * Focuses on state-changing forms (POST/PUT/DELETE) without CSRF tokens.
 */
export class CsrfChecker implements SecurityChecker {
  name = "CSRF Protection";

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    const checked = new Set<string>();

    for (const page of context.crawledPages) {
      for (const form of page.forms) {
        // Only check state-changing methods
        const method = form.method.toUpperCase();
        if (method === "GET") continue;

        const key = `${form.action}:${method}:${page.url}`;
        if (checked.has(key)) continue;
        checked.add(key);

        if (!form.hasCSRFToken) {
          // Check if the form has any password/sensitive inputs
          const hasSensitiveInputs = form.inputs.some((inp) =>
            /password|email|credit|card|ssn|account/i.test(inp.name || inp.type)
          );

          findings.push({
            id: uuidv4(),
            category: "csrf-missing",
            severity: hasSensitiveInputs ? "high" : "medium",
            title: `Form Missing CSRF Protection (${method} ${form.action || "same-page"})`,
            description:
              "This form submits data using a state-changing HTTP method but does not appear to include a CSRF token. Without CSRF protection, an attacker could trick authenticated users into submitting unintended requests.",
            affectedUrl: page.url,
            evidence: `Form action: ${form.action || "(same page)"}, method: ${method}, inputs: ${form.inputs.map((i) => i.name).filter(Boolean).join(", ") || "(none)"}`,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return findings;
  }
}
