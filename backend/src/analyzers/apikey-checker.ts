import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

interface ApiKeyPattern {
  name: string;
  pattern: RegExp;
  severity: "critical" | "high";
}

/**
 * Detects API keys, secrets, and credentials exposed in frontend JavaScript code.
 */
export class ApiKeyChecker implements SecurityChecker {
  name = "Exposed API Keys";

  private readonly patterns: ApiKeyPattern[] = [
    {
      name: "AWS Access Key",
      pattern: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
      severity: "critical",
    },
    {
      name: "AWS Secret Key",
      pattern: /(?:aws)?_?(?:secret)?_?(?:access)?_?key['"`\s]*[:=]\s*['"`]([A-Za-z0-9/+=]{40})['"`]/gi,
      severity: "critical",
    },
    {
      name: "Google API Key",
      pattern: /AIza[0-9A-Za-z_-]{35}/g,
      severity: "high",
    },
    {
      name: "GitHub Token",
      pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}/g,
      severity: "critical",
    },
    {
      name: "Stripe Secret Key",
      pattern: /sk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
      severity: "critical",
    },
    {
      name: "Stripe Publishable Key",
      pattern: /pk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
      severity: "high",
    },
    {
      name: "Slack Token",
      pattern: /xox[bpors]-[0-9a-zA-Z]{10,48}/g,
      severity: "critical",
    },
    {
      name: "Firebase API Key",
      pattern: /(?:firebase|FIREBASE).*?['"`]([A-Za-z0-9_-]{39})['"`]/gi,
      severity: "high",
    },
    {
      name: "Generic Secret/Password",
      pattern: /(?:password|secret|api[_-]?key|apikey|private[_-]?key|access[_-]?token)['"`\s]*[:=]\s*['"`]([^'"`\s]{8,})['"`]/gi,
      severity: "high",
    },
    {
      name: "Private Key Block",
      pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
      severity: "critical",
    },
    {
      name: "SendGrid API Key",
      pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
      severity: "critical",
    },
    {
      name: "Twilio API Key",
      pattern: /SK[0-9a-fA-F]{32}/g,
      severity: "high",
    },
  ];

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    const seen = new Set<string>();

    for (const page of context.crawledPages) {
      for (const script of page.scripts) {
        const content = script.startsWith("[inline]")
          ? script.replace("[inline] ", "")
          : script; // also check external script URLs for key leaks in query params

        for (const rule of this.patterns) {
          rule.pattern.lastIndex = 0;
          const match = rule.pattern.exec(content);
          if (match) {
            const matchText = match[0].substring(0, 60);
            const dedupeKey = `${rule.name}:${matchText}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);

            findings.push({
              id: uuidv4(),
              category: "api-key-leak",
              severity: rule.severity,
              title: `${rule.name} Exposed in Frontend Code`,
              description: `A ${rule.name} was found in client-side JavaScript. API keys and secrets in frontend code are visible to anyone and should be moved to server-side environment variables.`,
              affectedUrl: page.url,
              evidence: `Match: ${matchText}${match[0].length > 60 ? "..." : ""}`,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    return findings;
  }
}
