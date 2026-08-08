// ── Trust Issue — Service Worker ──

const API_BASE = "http://localhost:3001";

// Open side panel when the extension icon is clicked (with Shift or via context menu)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_SCAN") {
    (async () => {
      let sessionCookies = undefined;
      if (message.withSession) {
        try {
          const url = new URL(message.url);
          const raw = await chrome.cookies.getAll({ domain: url.hostname });
          sessionCookies = raw.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || "/",
          }));
        } catch (e) {
          console.warn("[TrustIssue] Could not grab cookies:", e);
        }
      }
      return startScan(message.url, sessionCookies);
    })()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // async response
  }

  if (message.type === "GET_SCAN") {
    getScan(message.scanId)
      .then((scan) => sendResponse({ ok: true, scan }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "ABORT_SCAN") {
    abortScan(message.scanId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "CLIENT_FINDINGS") {
    // Forward client-side findings from content script
    chrome.runtime.sendMessage({
      type: "CLIENT_FINDINGS_FORWARD",
      tabUrl: sender.tab?.url,
      findings: message.findings,
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "OPEN_SIDE_PANEL") {
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    }
    sendResponse({ ok: true });
    return false;
  }
});

async function startScan(url, sessionCookies) {
  const payload = { targetUrl: url, maxDepth: 3, maxPages: 50 };
  if (sessionCookies?.length) payload.sessionCookies = sessionCookies;

  const res = await fetch(`${API_BASE}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function getScan(scanId) {
  const res = await fetch(`${API_BASE}/api/scan/${encodeURIComponent(scanId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function abortScan(scanId) {
  const res = await fetch(`${API_BASE}/api/scan/${encodeURIComponent(scanId)}/abort`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
