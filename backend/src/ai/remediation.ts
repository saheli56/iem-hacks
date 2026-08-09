import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Finding, AiRemediation } from "../types.js";
import { scanEventBus } from "../events.js";

// ── Gemini client (lazy-initialized) ──

let genAI: GoogleGenerativeAI | null = null;

function getClient(providedKey?: string): GoogleGenerativeAI | null {
  if (genAI && !providedKey) return genAI;

  const apiKey = providedKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return null;
  }

  genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

// ── Prompt construction ──

function buildPrompt(finding: Finding): string {
  return `You are a senior application security engineer helping a developer fix a vulnerability found during an automated scan.

VULNERABILITY:
  Title: ${finding.title}
  Category: ${finding.category}
  Severity: ${finding.severity}
  Affected URL: ${finding.affectedUrl}
  Description: ${finding.description}
  Evidence: ${finding.evidence ?? "N/A"}

Respond with EXACTLY the following JSON structure (no markdown fences, no extra text):
{
  "explanation": "A clear 2-3 sentence developer-friendly explanation of why this is a security risk and what could be exploited.",
  "fix": "A concrete code snippet or configuration change that fixes this issue. Use the most common web framework conventions (Next.js / Express). Include the exact header, config line, or code paste.",
  "cursorPrompt": "A one-line prompt a developer can paste into Cursor AI to auto-fix this issue in their codebase."
}`;
}

// ── Fallback remediation (when no API key) ──

const FALLBACK_REMEDIATIONS: Record<string, AiRemediation> = {
  "missing-header": {
    explanation:
      "Security headers instruct browsers to enable protections like XSS filtering, clickjacking prevention, and content-type sniffing defense. Without them, your app is exposed to common client-side attacks.",
    fix: `// next.config.js — add security headers
module.exports = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};`,
    cursorPrompt:
      "Add all recommended security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) to next.config.js headers() function.",
  },
  "insecure-cookie": {
    explanation:
      "Cookies missing HttpOnly, Secure, or SameSite flags can be stolen via XSS, sent over insecure connections, or exploited in CSRF attacks. All session/auth cookies must use strict flags.",
    fix: `// Express example
res.cookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 3600000,
});`,
    cursorPrompt:
      "Ensure all session and authentication cookies are set with httpOnly: true, secure: true, and sameSite: 'strict' flags.",
  },
  "jwt-exposure": {
    explanation:
      "Storing JWTs in localStorage or sessionStorage exposes them to XSS attacks. Any script running on the page can read the token and impersonate the user.",
    fix: `// Instead of localStorage, use httpOnly cookies
// Server-side: set token in cookie
res.cookie("token", jwt, { httpOnly: true, secure: true, sameSite: "strict" });
// Client-side: cookies are sent automatically, no manual token handling needed`,
    cursorPrompt:
      "Refactor JWT storage from localStorage/sessionStorage to httpOnly secure cookies, updating both server-side token setting and client-side API calls.",
  },
  "api-key-leak": {
    explanation:
      "API keys or secrets hardcoded in client-side code are visible to anyone who inspects the page source. Attackers can use them to access your services, incur costs, or pivot to deeper attacks.",
    fix: `// Move secrets to environment variables (server-side only)
// .env
API_KEY=sk_live_...

// Use via server route, never expose to client
const key = process.env.API_KEY;`,
    cursorPrompt:
      "Move all hardcoded API keys and secrets to server-side environment variables. Create a .env file, add it to .gitignore, and update code to use process.env.",
  },
  "csrf-missing": {
    explanation:
      "Forms that perform state-changing operations (POST/PUT/DELETE) without CSRF tokens allow attackers to trick users into submitting forged requests from malicious sites.",
    fix: `// Express + csurf or custom token
import crypto from "crypto";
// Generate token
const csrfToken = crypto.randomBytes(32).toString("hex");
// Embed in form
<input type="hidden" name="_csrf" value="{csrfToken}" />
// Validate on POST
if (req.body._csrf !== session.csrfToken) return res.status(403).json({ error: "Invalid CSRF token" });`,
    cursorPrompt:
      "Add CSRF protection to all POST/PUT/DELETE forms using a hidden token field and server-side validation.",
  },
  misconfiguration: {
    explanation:
      "Server misconfigurations like version disclosure, directory listing, or exposed debug endpoints give attackers reconnaissance information to craft targeted exploits.",
    fix: `// Remove X-Powered-By in Express
app.disable("x-powered-by");

// Or in Next.js — next.config.js
module.exports = {
  poweredByHeader: false,
};`,
    cursorPrompt:
      "Disable server version disclosure by removing X-Powered-By header, hiding directory listings, and removing debug endpoints from production.",
  },
  "mixed-content": {
    explanation:
      "Loading HTTP resources on an HTTPS page allows man-in-the-middle attackers to tamper with those resources, potentially injecting malicious scripts or content.",
    fix: `// Update all resource URLs to use HTTPS or protocol-relative URLs
// Before: <script src="http://cdn.example.com/lib.js">
// After:  <script src="https://cdn.example.com/lib.js">

// Or add upgrade-insecure-requests CSP directive
Content-Security-Policy: upgrade-insecure-requests`,
    cursorPrompt:
      "Replace all HTTP resource URLs with HTTPS equivalents and add upgrade-insecure-requests to the Content-Security-Policy header.",
  },
  "reflected-input": {
    explanation:
      "User input reflected in page output without proper encoding is a classic XSS vector. Attackers can inject scripts that steal cookies, credentials, or perform actions on behalf of users.",
    fix: `// Always encode output — React does this by default for JSX expressions
// For dangerouslySetInnerHTML, use a sanitizer like DOMPurify:
import DOMPurify from "dompurify";
const safe = DOMPurify.sanitize(userInput);`,
    cursorPrompt:
      "Ensure all user-supplied input is properly sanitized/encoded before rendering. Use DOMPurify for any raw HTML output.",
  },
};

function getFallbackRemediation(finding: Finding): AiRemediation {
  return (
    FALLBACK_REMEDIATIONS[finding.category] ?? {
      explanation: `This ${finding.severity} severity ${finding.category} issue should be reviewed and addressed to improve the security posture of your application.`,
      fix: `// Review and fix: ${finding.title}\n// See OWASP guidelines for ${finding.category} remediation.`,
      cursorPrompt: `Fix the ${finding.category} vulnerability: ${finding.title}`,
    }
  );
}

// ── Public API ──

/**
 * Generate AI-powered remediation for a single finding.
 * Falls back to curated templates if Gemini is unavailable.
 */
export async function generateRemediation(
  finding: Finding,
  geminiKey?: string
): Promise<AiRemediation> {
  const client = getClient(geminiKey);

  if (!client) {
    console.log("[AI] No Gemini API key — using fallback remediation");
    return getFallbackRemediation(finding);
  }

  try {
    const model = client.getGenerativeModel({ model: "gemini-3.6-flash" });
    const geminiTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini API timeout (10s)")), 10_000)
    );
    const result = await Promise.race([model.generateContent(buildPrompt(finding)), geminiTimeout]);
    const text = result.response.text().trim();

    // Strip markdown fences if the model wraps in ```json
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned) as AiRemediation;

    // Validate structure
    if (!parsed.explanation || !parsed.fix || !parsed.cursorPrompt) {
      throw new Error("Incomplete AI response structure");
    }

    return parsed;
  } catch (err) {
    const msg = (err as Error).message || "Unknown error";
    const short = msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
    console.warn(`[AI] Gemini call failed for "${finding.title}": ${short}`);
    return getFallbackRemediation(finding);
  }
}

/**
 * Generate remediations for all findings in a scan.
 * Processes findings in batches to respect rate limits.
 */
export async function generateRemediations(
  findings: Finding[],
  scanId?: string,
  geminiKey?: string
): Promise<Finding[]> {
  if (findings.length === 0) return findings;

  const client = getClient(geminiKey);
  const BATCH_SIZE = client ? 5 : findings.length; // process all instantly for fallback
  const mode = client ? "gemini" : "fallback";

  console.log(
    `[AI] Generating remediations for ${findings.length} finding(s)${client ? " via Gemini" : " (fallback mode)"}`
  );

  if (scanId) {
    scanEventBus.emit(scanId, {
      type: "ai:batch-start",
      data: { total: findings.length, mode },
    });
  }

  for (let i = 0; i < findings.length; i += BATCH_SIZE) {
    const batch = findings.slice(i, i + BATCH_SIZE);

    const remediations = await Promise.all(
      batch.map(async (f, j) => {
        if (scanId) {
          scanEventBus.emit(scanId, {
            type: "ai:finding-start",
            data: { findingId: f.id, title: f.title, index: i + j, total: findings.length },
          });
        }
        const result = await generateRemediation(f, geminiKey);
        if (scanId) {
          scanEventBus.emit(scanId, {
            type: "ai:finding-done",
            data: { findingId: f.id, title: f.title, index: i + j, total: findings.length, mode },
          });
        }
        return result;
      })
    );

    for (let j = 0; j < batch.length; j++) {
      batch[j].remediation = remediations[j];
    }

    // Small delay between batches for rate limiting (only when using API)
    if (client && i + BATCH_SIZE < findings.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (scanId) {
    scanEventBus.emit(scanId, {
      type: "ai:complete",
      data: { total: findings.length, mode },
    });
  }

  console.log(`[AI] Remediation generation complete`);
  return findings;
}
