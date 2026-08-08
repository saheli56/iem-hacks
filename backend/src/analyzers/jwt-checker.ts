import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

/**
 * Detects JWT tokens stored in localStorage/sessionStorage by analyzing
 * inline script content for common storage patterns.
 */
export class JwtExposureChecker implements SecurityChecker {
  name = "JWT in Client Storage";

  // Patterns that indicate JWT being stored in browser storage
  private readonly storagePatterns = [
    /localStorage\.setItem\s*\(\s*['"`]([^'"`]*(?:token|jwt|auth|access|refresh)[^'"`]*)['"`]/gi,
    /sessionStorage\.setItem\s*\(\s*['"`]([^'"`]*(?:token|jwt|auth|access|refresh)[^'"`]*)['"`]/gi,
    /localStorage\[['"`]([^'"`]*(?:token|jwt|auth|access|refresh)[^'"`]*)['"`]\]\s*=/gi,
    /sessionStorage\[['"`]([^'"`]*(?:token|jwt|auth|access|refresh)[^'"`]*)['"`]\]\s*=/gi,
  ];

  // Pattern to detect actual JWT tokens (header.payload.signature)
  private readonly jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];

    for (const page of context.crawledPages) {
      for (const script of page.scripts) {
        if (!script.startsWith("[inline]")) continue;
        const content = script.replace("[inline] ", "");

        // Check for storage of tokens
        for (const pattern of this.storagePatterns) {
          pattern.lastIndex = 0;
          const match = pattern.exec(content);
          if (match) {
            findings.push({
              id: uuidv4(),
              category: "jwt-exposure",
              severity: "high",
              title: "JWT/Auth Token Stored in Browser Storage",
              description:
                "Storing authentication tokens in localStorage or sessionStorage exposes them to XSS attacks. Any script running on the page can read these tokens. Use HTTP-only cookies for token storage instead.",
              affectedUrl: page.url,
              evidence: `Found token storage pattern: ${match[0].substring(0, 100)}`,
              detectedAt: new Date().toISOString(),
            });
            break; // One finding per page per pattern type
          }
        }

        // Check for hardcoded JWT tokens in scripts
        const jwtMatch = this.jwtPattern.exec(content);
        if (jwtMatch) {
          findings.push({
            id: uuidv4(),
            category: "jwt-exposure",
            severity: "critical",
            title: "Hardcoded JWT Token Found in Frontend Code",
            description:
              "A JWT token appears to be hardcoded in client-side JavaScript. This token could be used by attackers to impersonate users or access protected resources.",
            affectedUrl: page.url,
            evidence: `JWT found: ${jwtMatch[0].substring(0, 40)}...`,
            detectedAt: new Date().toISOString(),
          });
        }
        this.jwtPattern.lastIndex = 0;
      }
    }

    return findings;
  }
}
