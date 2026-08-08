// ── Side Panel — Viewport-first real-time scan monitor ──

const WS_URL = "ws://localhost:3001/ws";
const API_BASE = "http://localhost:3001";
const DASHBOARD_URL = "http://localhost:3000";

// DOM refs
const liveBadge = document.getElementById("liveBadge");
const headerStatus = document.getElementById("headerStatus");
const headerStatusText = document.getElementById("headerStatusText");
const statusBar = document.getElementById("statusBar");
const statusBarText = document.getElementById("statusBarText");
const statusBarPages = document.getElementById("statusBarPages");
const browserChrome = document.getElementById("browserChrome");
const urlBar = document.getElementById("urlBar");
const urlText = document.getElementById("urlText");
const stepBar = document.getElementById("stepBar");
const progressTrack = document.getElementById("progressTrack");
const progressFill = document.getElementById("progressFill");
const idleView = document.getElementById("idleView");
const viewport = document.getElementById("viewport");
const viewportImg = document.getElementById("viewportImg");
const viewportEmpty = document.getElementById("viewportEmpty");
const navOverlay = document.getElementById("navOverlay");
const navLabel = document.getElementById("navLabel");
const ticker = document.getElementById("ticker");
const tickerScroll = document.getElementById("tickerScroll");
const tickerCount = document.getElementById("tickerCount");
const findingsBar = document.getElementById("findingsBar");
const findingsPills = document.getElementById("findingsPills");
const findingsTotal = document.getElementById("findingsTotal");
const completeBanner = document.getElementById("completeBanner");
const completeSubtext = document.getElementById("completeSubtext");
const viewReportBtn = document.getElementById("viewReportBtn");
const idleScanBtn = document.getElementById("idleScanBtn");
const idleUrlInput = document.getElementById("idleUrlInput");
const idleCurrentBtn = document.getElementById("idleCurrentBtn");
const sessionToggle = document.getElementById("sessionToggle");
const cancelBtn = document.getElementById("cancelBtn");

// Steps
const sCrawl = document.getElementById("sCrawl");
const sAnalyze = document.getElementById("sAnalyze");
const sAI = document.getElementById("sAI");
const sDone = document.getElementById("sDone");

let ws = null;
let activeScanId = null;
let eventCount = 0;
let findingsCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
let pagesVisited = 0;
let isRunning = false;
let navTimeout = null;
let liveTabId = null;

// Pre-fill URL input from current tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url && idleUrlInput) idleUrlInput.value = tabs[0].url;
});

// ── Idle scan button ──
function startScanFromIdle(targetUrl) {
  if (!targetUrl) return;
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = "https://" + targetUrl;
  if (idleUrlInput) idleUrlInput.value = targetUrl;

  idleScanBtn.disabled = true;
  idleCurrentBtn.disabled = true;
  if (idleUrlInput) idleUrlInput.disabled = true;
  idleScanBtn.textContent = "Starting…";
  idleCurrentBtn.textContent = "Starting…";
  chrome.runtime.sendMessage(
    { type: "START_SCAN", url: targetUrl, withSession: sessionToggle?.checked || false },
    (response) => {
      if (response?.ok) {
        beginMonitoring(response.scanId);
      } else {
        idleScanBtn.textContent = "Failed — Try Again";
        idleCurrentBtn.textContent = "Scan Current Page";
        idleScanBtn.disabled = false;
        idleCurrentBtn.disabled = false;
        if (idleUrlInput) idleUrlInput.disabled = false;
      }
    }
  );
}

idleScanBtn.addEventListener("click", () => {
  startScanFromIdle(idleUrlInput ? idleUrlInput.value.trim() : "");
});

idleCurrentBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0]?.url || "";
    if (!tabUrl || tabUrl.startsWith("chrome://")) return;
    if (idleUrlInput) idleUrlInput.value = tabUrl;
    startScanFromIdle(tabUrl);
  });
});

// ── Listen for scan start from popup ──
chrome.storage.local.get(["activeScanId"], (data) => {
  if (data.activeScanId) beginMonitoring(data.activeScanId);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.activeScanId?.newValue) beginMonitoring(changes.activeScanId.newValue);
});

// ── Client-side findings ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLIENT_FINDINGS_FORWARD" && message.findings) {
    for (const f of message.findings) {
      addFindingCount(f.severity);
    }
  }
});

// ── Cancel button ──
cancelBtn.addEventListener("click", () => {
  if (!activeScanId || cancelBtn.disabled) return;
  cancelBtn.disabled = true;
  cancelBtn.textContent = "Cancelling…";
  fetch(`${API_BASE}/api/scan/${activeScanId}/abort`, { method: "POST" })
    .then(() => {
      isRunning = false;
      chrome.storage.local.remove(["activeScanId", "activeScanUrl"]);
      resetToIdle();
    })
    .catch(() => {
      cancelBtn.disabled = false;
      cancelBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel`;
    });
});

function closeLiveTab() {
  if (liveTabId !== null) {
    chrome.tabs.remove(liveTabId, () => { chrome.runtime.lastError; /* ignore if already closed */ });
    liveTabId = null;
  }
}

function resetToIdle() {
  if (ws) { ws.close(); ws = null; }
  closeLiveTab();
  activeScanId = null;
  isRunning = false;
  eventCount = 0;
  pagesVisited = 0;
  findingsCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  // Reset UI
  idleView.style.display = "flex";
  browserChrome.style.display = "none";
  progressTrack.style.display = "none";
  progressFill.style.width = "0%";
  statusBar.style.display = "none";
  viewport.style.display = "none";
  ticker.style.display = "none";
  findingsBar.classList.remove("visible");
  completeBanner.classList.remove("visible");
  stepBar.classList.remove("visible");
  headerStatus.classList.remove("visible");
  cancelBtn.classList.remove("visible");
  cancelBtn.disabled = false;
  cancelBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel`;
  tickerScroll.innerHTML = "";
  tickerCount.textContent = "0";
  findingsPills.innerHTML = "";
  findingsTotal.textContent = "0";
  viewportImg.style.display = "none";
  if (viewportEmpty) viewportEmpty.style.display = "flex";

  // Re-fill URL from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url && idleUrlInput) idleUrlInput.value = tabs[0].url;
  });
}

// ── View report button ──
viewReportBtn.addEventListener("click", () => {
  if (activeScanId) {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/scan/${activeScanId}` });
  }
});

// ── Begin monitoring ──
function beginMonitoring(scanId) {
  activeScanId = scanId;
  isRunning = true;

  // Switch from idle to scan UI
  idleView.style.display = "none";
  browserChrome.style.display = "block";
  progressTrack.style.display = "block";
  viewport.style.display = "flex";
  ticker.style.display = "flex";
  stepBar.classList.add("visible");
  statusBar.style.display = "flex";
  headerStatus.classList.add("visible");
  cancelBtn.classList.add("visible");

  connectWebSocket(scanId);
}

function connectWebSocket(scanId) {
  if (ws) ws.close();

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    liveBadge.classList.add("visible");
    headerStatusText.textContent = "Connected";
    ws.send(JSON.stringify({ type: "subscribe", scanId }));
  };

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      if (event.type === "connected") return;
      handleEvent(event);
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    liveBadge.classList.remove("visible");
    headerStatus.classList.remove("visible");
    if (isRunning) setTimeout(() => connectWebSocket(scanId), 2000);
  };

  ws.onerror = () => ws.close();
}

// ── Event handler ──
function handleEvent(event) {
  // Screenshot → viewport image (the hero!)
  if (event.type === "crawler:screenshot") {
    updateViewport(event.data.screenshot, event.data.url);
    return;
  }

  // Add to ticker
  addTickerEntry(event);

  // URL bar: show navigating state
  if (event.type === "crawler:page-navigating") {
    showNavigating(event.data.url);
    statusBarText.textContent = `Navigating to ${shortUrl(event.data.url)}`;
    // Mirror navigation in a real Chrome tab
    if (liveTabId === null) {
      chrome.tabs.create({ url: event.data.url, active: false }, (tab) => {
        liveTabId = tab.id;
      });
    } else {
      chrome.tabs.update(liveTabId, { url: event.data.url }, () => {
        if (chrome.runtime.lastError) liveTabId = null; // tab was closed by user
      });
    }
  }

  // Page loaded: update URL bar, hide nav overlay
  if (event.type === "crawler:page-loaded") {
    pagesVisited = event.data.pagesVisited || (pagesVisited + 1);
    statusBarPages.textContent = `${pagesVisited} pg`;
    urlBar.classList.remove("navigating");
    hideNavOverlay();
    setUrlDisplay(event.data.url);
    statusBarText.textContent = `Loaded ${shortUrl(event.data.url)}`;
  }

  // Findings
  if (event.type === "analyzer:finding") {
    addFindingCount(event.data.severity);
    statusBarText.textContent = `Found: ${event.data.title}`;
  }

  // Checker events
  if (event.type === "analyzer:checker-start") {
    statusBarText.textContent = `Analyzing: ${event.data.checker}`;
  }

  // AI events
  if (event.type === "ai:batch-start") {
    statusBarText.textContent = `AI fixing ${event.data.total} issues`;
  }
  if (event.type === "ai:finding-start") {
    statusBarText.textContent = `AI: ${event.data.title}`;
  }
  if (event.type === "ai:complete") {
    statusBarText.textContent = `${event.data.total} fixes ready`;
  }

  // Step progress
  updateSteps(event);

  // Progress bar
  if (event.type === "scan:status-change") {
    const s = event.data.status;
    if (s === "crawling") { progressFill.style.width = "15%"; statusBarText.textContent = "Crawling pages…"; }
    else if (s === "analyzing") { progressFill.style.width = "50%"; statusBarText.textContent = "Analyzing for vulnerabilities…"; }
    else if (s === "generating-report") { progressFill.style.width = "75%"; statusBarText.textContent = "Generating AI remediations…"; }
  }

  // Completion
  if (event.type === "scan:completed") {
    isRunning = false;
    liveBadge.classList.remove("visible");
    headerStatus.classList.remove("visible");
    cancelBtn.classList.remove("visible");
    statusBar.style.display = "none";
    urlBar.classList.remove("navigating");
    hideNavOverlay();
    progressFill.style.width = "100%";
    closeLiveTab();
    showCompletion(event.data.pagesVisited, event.data.findingsCount);
  }
  if (event.type === "scan:aborted" || event.type === "scan:error") {
    isRunning = false;
    liveBadge.classList.remove("visible");
    headerStatus.classList.remove("visible");
    cancelBtn.classList.remove("visible");
    statusBar.style.display = "none";
    closeLiveTab();
    if (event.type === "scan:aborted") resetToIdle();
  }
}

// ── Viewport update ──
function updateViewport(base64, url) {
  if (viewportEmpty) viewportEmpty.style.display = "none";
  viewportImg.style.display = "block";
  viewportImg.src = `data:image/jpeg;base64,${base64}`;
  hideNavOverlay();
  if (url) setUrlDisplay(url);
}

// ── URL bar helpers ──
function showNavigating(url) {
  urlBar.classList.add("navigating");
  setUrlDisplay(url);
  showNavOverlay(url);
}

function setUrlDisplay(url) {
  try {
    const u = new URL(url);
    urlText.innerHTML = `<span class="domain">${escapeHtml(u.hostname)}</span>${escapeHtml(u.pathname + u.search)}`;
  } catch {
    urlText.textContent = url;
  }
}

function showNavOverlay(url) {
  if (navTimeout) clearTimeout(navTimeout);
  try {
    navLabel.textContent = `Navigating to ${new URL(url).hostname}…`;
  } catch {
    navLabel.textContent = "Navigating…";
  }
  navOverlay.classList.add("visible");
  // Auto-hide after 4s if screenshot doesn't arrive first
  navTimeout = setTimeout(() => hideNavOverlay(), 4000);
}

function hideNavOverlay() {
  navOverlay.classList.remove("visible");
  if (navTimeout) { clearTimeout(navTimeout); navTimeout = null; }
}

// ── Ticker (event log) ──
const STATUS_LABELS = {
  "crawling":          "Crawling",
  "analyzing":         "Analyzing",
  "generating-report": "AI Remediation",
  "completed":         "Completed",
};

function tickTag(event) {
  switch (event.type) {
    case "scan:started":           return { label: "START",  cls: "start" };
    case "scan:status-change":     return { label: "STATUS", cls: "status" };
    case "crawler:page-navigating":return { label: "CRAWL",  cls: "crawl" };
    case "crawler:page-loaded":    return { label: "LOADED", cls: "loaded" };
    case "crawler:page-error":     return { label: "ERROR",  cls: "error" };
    case "analyzer:checker-start":  return { label: "CHECK",  cls: "check" };
    case "analyzer:checker-result": return { label: "CHECK",  cls: "check" };
    case "analyzer:finding": {
      const sev = (event.data.severity || "info").toLowerCase();
      return { label: sev.toUpperCase(), cls: sev };
    }
    case "ai:batch-start":
    case "ai:finding-start":
    case "ai:finding-done":
    case "ai:complete":            return { label: "AI",     cls: "ai" };
    case "scan:completed":         return { label: "DONE",   cls: "done" };
    case "scan:error":             return { label: "ERROR",  cls: "error" };
    default:                       return { label: "EVENT",  cls: "info" };
  }
}

function tickText(event) {
  switch (event.type) {
    case "scan:started":           return `Scan started · ${shortUrl(event.data.targetUrl)}`;
    case "scan:status-change":     return STATUS_LABELS[event.data.status] || event.data.status;
    case "crawler:page-navigating":return shortUrl(event.data.url);
    case "crawler:page-loaded":    return `${shortUrl(event.data.url)}  ·  ${event.data.linksFound} link${event.data.linksFound !== 1 ? "s" : ""} found`;
    case "crawler:page-error":     return shortUrl(event.data.url);
    case "analyzer:checker-start": return event.data.checker;
    case "analyzer:checker-result":return `${event.data.checker}  ·  ${event.data.count} issue${event.data.count !== 1 ? "s" : ""}`;
    case "analyzer:finding":       return event.data.title;
    case "ai:batch-start":         return `Remediating ${event.data.total} finding${event.data.total !== 1 ? "s" : ""}`;
    case "ai:finding-start":       return event.data.title;
    case "ai:finding-done":        return event.data.title;
    case "ai:complete":            return `${event.data.total} remediation${event.data.total !== 1 ? "s" : ""} complete`;
    case "scan:completed":         return `${event.data.pagesVisited} pages  ·  ${event.data.findingsCount} issue${event.data.findingsCount !== 1 ? "s" : ""}`;
    case "scan:error":             return event.data.error || "Scan failed";
    default: return event.type;
  }
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 30) + (u.pathname.length > 30 ? "…" : "");
  } catch { return url; }
}

function addTickerEntry(event) {
  eventCount++;
  tickerCount.textContent = eventCount;

  const tag = tickTag(event);
  const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const row = document.createElement("div");
  row.className = "tick-entry";
  row.innerHTML = `<span class="tick-tag tick-tag-${tag.cls}">${tag.label}</span><span class="tick-text">${escapeHtml(tickText(event))}</span><span class="tick-time">${time}</span>`;

  tickerScroll.appendChild(row);
  tickerScroll.scrollTop = tickerScroll.scrollHeight;
}

// ── Findings count ──
function addFindingCount(severity) {
  const sev = (severity || "info").toLowerCase();
  if (findingsCounts[sev] !== undefined) findingsCounts[sev]++;
  else findingsCounts[sev] = 1;

  const total = Object.values(findingsCounts).reduce((a, b) => a + b, 0);
  findingsTotal.textContent = total;

  // Rebuild pills
  findingsPills.innerHTML = "";
  for (const [s, c] of Object.entries(findingsCounts)) {
    if (c === 0) continue;
    const pill = document.createElement("span");
    pill.className = `fb-pill fb-${s}`;
    pill.textContent = `${c} ${s}`;
    findingsPills.appendChild(pill);
  }

  findingsBar.classList.add("visible");
}

// ── Steps ──
function updateSteps(event) {
  if (event.type !== "scan:status-change" && event.type !== "scan:completed") return;
  const status = event.type === "scan:completed" ? "completed" : event.data.status;

  const steps = [
    { el: sCrawl, key: "crawling" },
    { el: sAnalyze, key: "analyzing" },
    { el: sAI, key: "generating-report" },
    { el: sDone, key: "completed" },
  ];
  const order = steps.map((s) => s.key);
  const idx = order.indexOf(status);

  steps.forEach((s, i) => {
    s.el.className = "step-pill";
    if (i < idx) s.el.classList.add("done");
    else if (i === idx) s.el.classList.add(status === "completed" ? "done" : "active");
  });

  stepBar.classList.add("visible");
}

// ── Completion ──
function showCompletion(pages, findings) {
  completeSubtext.textContent = `${pages} pages scanned · ${findings} issue${findings !== 1 ? "s" : ""} found`;
  completeBanner.classList.add("visible");

  // Replace viewport with the banner
  viewport.style.display = "none";
  ticker.style.display = "none";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
