// ── Content Script — Client-side security checks ──
// Runs in the context of every page the user visits.
// Detects issues only visible from the real user session (cookies, localStorage, DOM).

(function () {
  "use strict";

  const findings = [];

  // ── 1. Check cookies accessible via JS (non-HttpOnly) ──
  function checkCookies() {
    const cookies = document.cookie.split(";").map((c) => c.trim()).filter(Boolean);
    for (const cookie of cookies) {
      const name = cookie.split("=")[0];
      const value = cookie.split("=").slice(1).join("=");

      // Session tokens in JS-accessible cookies
      const sessionPatterns = /^(sess|session|sid|token|auth|jwt|PHPSESSID|JSESSIONID|csrftoken|_csrf)/i;
      if (sessionPatterns.test(name)) {
        findings.push({
          severity: "high",
          title: `Session cookie "${name}" accessible via JavaScript`,
          description: `The cookie "${name}" appears to be a session/auth cookie but is not marked HttpOnly, making it vulnerable to XSS-based theft.`,
          url: location.href,
          evidence: `Cookie: ${name}=${value.substring(0, 20)}…`,
        });
      }

      // JWTs in cookies
      if (value.split(".").length === 3 && value.startsWith("eyJ")) {
        findings.push({
          severity: "medium",
          title: `JWT token found in JS-accessible cookie "${name}"`,
          description: "A JWT token is stored in a cookie accessible via JavaScript. Consider using HttpOnly cookies.",
          url: location.href,
          evidence: `Cookie: ${name}=${value.substring(0, 30)}…`,
        });
      }
    }
  }

  // ── 2. Check localStorage / sessionStorage for sensitive data ──
  function checkStorage() {
    const sensitivePatterns = /token|jwt|auth|session|api[_-]?key|secret|password|credential|access[_-]?key/i;

    for (const [storageType, storage] of [["localStorage", localStorage], ["sessionStorage", sessionStorage]]) {
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key) continue;

          if (sensitivePatterns.test(key)) {
            const value = storage.getItem(key) || "";
            findings.push({
              severity: "medium",
              title: `Sensitive data in ${storageType}: "${key}"`,
              description: `The key "${key}" in ${storageType} may contain sensitive authentication data. Web storage is vulnerable to XSS attacks.`,
              url: location.href,
              evidence: `${storageType}["${key}"] = ${value.substring(0, 40)}…`,
            });
          }

          // Check for JWTs stored as values
          const val = storage.getItem(key) || "";
          if (val.split(".").length === 3 && val.startsWith("eyJ")) {
            findings.push({
              severity: "medium",
              title: `JWT token in ${storageType} (key: "${key}")`,
              description: `A JWT token is stored in ${storageType}. This is accessible via XSS. Consider using HttpOnly cookies instead.`,
              url: location.href,
              evidence: `${key}=${val.substring(0, 30)}…`,
            });
          }
        }
      } catch {
        // Storage access may be restricted
      }
    }
  }

  // ── 3. Check for password fields in non-HTTPS pages ──
  function checkPasswordFields() {
    if (location.protocol !== "https:") {
      const pwFields = document.querySelectorAll('input[type="password"]');
      if (pwFields.length > 0) {
        findings.push({
          severity: "critical",
          title: "Password field on non-HTTPS page",
          description: `This page contains ${pwFields.length} password field(s) but is served over HTTP. Credentials can be intercepted.`,
          url: location.href,
        });
      }
    }
  }

  // ── 4. Check for inline event handlers (XSS surface) ──
  function checkInlineHandlers() {
    const handlers = [
      "onclick", "onerror", "onload", "onmouseover", "onfocus",
      "onblur", "onsubmit", "onchange", "oninput",
    ];
    let count = 0;

    for (const handler of handlers) {
      const elements = document.querySelectorAll(`[${handler}]`);
      count += elements.length;
    }

    if (count > 10) {
      findings.push({
        severity: "low",
        title: `${count} inline event handlers detected`,
        description: "Excessive use of inline event handlers increases the XSS attack surface and prevents effective CSP deployment.",
        url: location.href,
      });
    }
  }

  // ── 5. Check for forms posting to external domains ──
  function checkExternalForms() {
    const forms = document.querySelectorAll("form[action]");
    const currentHost = location.hostname;

    for (const form of forms) {
      try {
        const actionUrl = new URL(form.action, location.href);
        if (actionUrl.hostname !== currentHost && actionUrl.hostname !== "") {
          findings.push({
            severity: "medium",
            title: `Form posts data to external domain: ${actionUrl.hostname}`,
            description: `A form on this page sends data to ${actionUrl.origin}, which is a different domain. Verify this is intentional.`,
            url: location.href,
            evidence: `<form action="${form.getAttribute("action")}" method="${form.method}">`,
          });
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  // ── 6. Check for mixed content (HTTP resources on HTTPS page) ──
  function checkMixedContent() {
    if (location.protocol !== "https:") return;

    const selectors = [
      "img[src^='http:']",
      "script[src^='http:']",
      "link[href^='http:']",
      "iframe[src^='http:']",
    ];

    let count = 0;
    for (const sel of selectors) {
      count += document.querySelectorAll(sel).length;
    }

    if (count > 0) {
      findings.push({
        severity: "medium",
        title: `${count} mixed content resource(s) detected`,
        description: "This HTTPS page loads resources over HTTP, which can be intercepted or modified by attackers.",
        url: location.href,
      });
    }
  }

  // ── Run all checks ──
  try {
    checkCookies();
    checkStorage();
    checkPasswordFields();
    checkInlineHandlers();
    checkExternalForms();
    checkMixedContent();
  } catch {
    // Don't break the page if checks fail
  }

  // Send findings to background script
  if (findings.length > 0) {
    chrome.runtime.sendMessage({
      type: "CLIENT_FINDINGS",
      findings: findings,
    });
  }
})();
