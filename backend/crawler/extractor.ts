import type { Page } from "playwright";
import type { CrawledPage, CookieInfo, FormInfo } from "../types.js";

/**
 * Extracts all security-relevant data from a single page:
 * response headers, cookies, forms, inline/external scripts, and discovered links.
 */
export async function extractPageData(
  page: Page,
  response: { status: number; headers: Record<string, string> } | null
): Promise<{ pageData: CrawledPage; discoveredLinks: string[] }> {
  const url = page.url();

  // ── Headers ──
  const headers = response?.headers ?? {};

  // ── Cookies ──
  const rawCookies = await page.context().cookies(url);
  const cookies: CookieInfo[] = rawCookies.map((c) => ({
    name: c.name,
    value: c.value,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite ?? "None",
  }));

  // ── Forms ──
  const forms: FormInfo[] = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("form")).map((form) => {
      const inputs = Array.from(form.querySelectorAll("input, textarea, select")).map(
        (el) => ({
          name: (el as HTMLInputElement).name || "",
          type: (el as HTMLInputElement).type || "text",
        })
      );

      // Detect CSRF tokens: look for hidden inputs with common csrf-related names
      const csrfPatterns = /csrf|xsrf|_token|authenticity/i;
      const hasCSRFToken = inputs.some(
        (inp) => inp.type === "hidden" && csrfPatterns.test(inp.name)
      );

      return {
        action: form.action || "",
        method: (form.method || "GET").toUpperCase(),
        hasCSRFToken,
        inputs,
      };
    });
  });

  // ── Scripts (src URLs of external scripts + inline script content snippets) ──
  const scripts: string[] = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("script").forEach((s) => {
      if (s.src) {
        results.push(`[external] ${s.src}`);
      } else if (s.textContent && s.textContent.trim().length > 0) {
        // Capture first 500 chars of inline scripts for analysis
        results.push(`[inline] ${s.textContent.trim().substring(0, 500)}`);
      }
    });
    return results;
  });

  // ── Discover internal links ──
  const discoveredLinks: string[] = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    return anchors
      .map((a) => {
        try {
          return new URL((a as HTMLAnchorElement).href, document.location.origin).href;
        } catch {
          return null;
        }
      })
      .filter((href): href is string => href !== null);
  });

  const pageData: CrawledPage = {
    url,
    status: response?.status ?? 0,
    headers,
    cookies,
    forms,
    scripts,
    timestamp: new Date().toISOString(),
    formSubmissions: [], // populated by the form prober after extraction
  };

  return { pageData, discoveredLinks };
}
