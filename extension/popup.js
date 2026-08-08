// ── Popup script — scan trigger ──

const DASHBOARD_URL = "http://localhost:3000";

const urlInput = document.getElementById("currentUrl");
const scanBtn = document.getElementById("scanBtn");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const actionsEl = document.getElementById("actions");
const viewReportBtn = document.getElementById("viewReportBtn");
const openPanelBtn = document.getElementById("openPanelBtn");
const currentPageBtn = document.getElementById("currentPageBtn");
const cancelScanBtn = document.getElementById("cancelScanBtn");
const sessionToggle = document.getElementById("sessionToggle");
// keep alias for any legacy refs
const urlEl = urlInput;

let currentTabUrl = "";
let activeScanId = null;

// Pre-fill with the current tab's URL
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url) {
    currentTabUrl = tabs[0].url;
    urlInput.value = currentTabUrl;
  }
});

// Check if there's an active scan stored — verify it's actually running
chrome.storage.local.get(["activeScanId", "activeScanUrl"], (data) => {
  if (data.activeScanId) {
    // Verify with backend before showing status
    chrome.runtime.sendMessage(
      { type: "GET_SCAN", scanId: data.activeScanId },
      (response) => {
        if (!response?.ok) {
          // Scan doesn't exist on backend — clear stale state
          chrome.storage.local.remove(["activeScanId", "activeScanUrl"]);
          return;
        }
        const scan = response.scan;
        const terminal = ["completed", "error", "aborted"];
        if (terminal.includes(scan.status)) {
          // Scan already finished — clear storage, don't show in-progress
          chrome.storage.local.remove(["activeScanId", "activeScanUrl"]);
          return;
        }
        // Scan is genuinely running
        activeScanId = data.activeScanId;
        if (data.activeScanUrl) urlInput.value = data.activeScanUrl;
        showStatus("info", "Scan in progress\u2026");
        scanBtn.disabled = true;        currentPageBtn.disabled = true;        urlInput.disabled = true;
        scanBtn.textContent = "Scanning\u2026";
        pollStatus();
      }
    );
  }
});

scanBtn.addEventListener("click", () => {
  const targetUrl = urlInput.value.trim();
  if (!targetUrl || scanBtn.disabled) return;

  // Basic URL validation
  let normalised = targetUrl;
  if (!/^https?:\/\//i.test(normalised)) normalised = "https://" + normalised;
  urlInput.value = normalised;

  scanBtn.disabled = true;
  currentPageBtn.disabled = true;
  urlInput.disabled = true;
  scanBtn.textContent = "Starting…";
  cancelScanBtn.classList.add("visible");
  showStatus("info", "Connecting to scanner…");

  chrome.runtime.sendMessage(
    { type: "START_SCAN", url: normalised, withSession: sessionToggle?.checked || false },
    (response) => {
      if (!response || !response.ok) {
        showStatus("error", response?.error || "Failed to start scan");
        scanBtn.disabled = false;
        currentPageBtn.disabled = false;
        urlInput.disabled = false;
        scanBtn.textContent = "Scan URL";
        return;
      }

      activeScanId = response.scanId;
      chrome.storage.local.set({
        activeScanId: response.scanId,
        activeScanUrl: normalised,
      });

      showStatus("info", "Scan started — opening live view…");
      scanBtn.textContent = "Scanning…";

      // Auto-open side panel
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.sidePanel.open({ tabId: tabs[0].id });
        }
      });

      pollStatus();
    }
  );
});

// ── Scan Current Page button ──
currentPageBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0]?.url || "";
    if (!tabUrl || tabUrl.startsWith("chrome://")) return;
    urlInput.value = tabUrl;
    scanBtn.click();
  });
});

// ── Cancel scan button ──
cancelScanBtn.addEventListener("click", () => {
  if (!activeScanId || cancelScanBtn.disabled) return;
  cancelScanBtn.disabled = true;
  cancelScanBtn.textContent = "Cancelling…";
  chrome.runtime.sendMessage({ type: "ABORT_SCAN", scanId: activeScanId }, () => {
    clearInterval(pollTimer);
    showStatus("info", "Scan cancelled");
    scanBtn.disabled = false;
    currentPageBtn.disabled = false;
    urlInput.disabled = false;
    scanBtn.textContent = "Scan URL";
    cancelScanBtn.classList.remove("visible");
    cancelScanBtn.disabled = false;
    cancelScanBtn.textContent = "Cancel Scan";
    chrome.storage.local.remove(["activeScanId", "activeScanUrl"]);
    activeScanId = null;
  });
});

viewReportBtn.addEventListener("click", () => {
  if (activeScanId) {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/scan/${activeScanId}` });
  }
});

openPanelBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.sidePanel.open({ tabId: tabs[0].id });
    }
  });
});

let pollTimer = null;

function pollStatus() {
  if (!activeScanId) return;
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(() => {
    chrome.runtime.sendMessage(
      { type: "GET_SCAN", scanId: activeScanId },
      (response) => {
        if (!response?.ok) return;
        const scan = response.scan;

        if (scan.status === "crawling") {
          showStatus("info", `Crawling… ${scan.pagesVisited} pages found`);
        } else if (scan.status === "analyzing") {
          showStatus("info", "Analyzing security…");
        } else if (scan.status === "generating-report") {
          showStatus("info", "Generating AI remediations…");
        } else if (scan.status === "completed") {
          clearInterval(pollTimer);
          const n = scan.findings?.length || 0;
          showStatus("success", `Complete — ${n} issue${n !== 1 ? "s" : ""} found`);
          showActions();
          scanBtn.disabled = false;
          currentPageBtn.disabled = false;
          urlInput.disabled = false;
          scanBtn.textContent = "Scan URL";
          cancelScanBtn.classList.remove("visible");
          chrome.storage.local.remove(["activeScanId", "activeScanUrl"]);
        } else if (scan.status === "aborted" || scan.status === "error") {
          clearInterval(pollTimer);
          showStatus(scan.status === "aborted" ? "info" : "error", scan.status === "aborted" ? "Scan cancelled" : "Scan failed");
          scanBtn.disabled = false;
          currentPageBtn.disabled = false;
          urlInput.disabled = false;
          scanBtn.textContent = "Scan URL";
          cancelScanBtn.classList.remove("visible");
          chrome.storage.local.remove(["activeScanId", "activeScanUrl"]);
        }
      }
    );
  }, 2000);
}

function showStatus(type, text) {
  statusEl.className = `status visible ${type}`;
  statusText.textContent = text;
}

function showActions() {
  actionsEl.className = "actions visible";
}
