import { NextResponse } from "next/server";

// Intentionally Vulnerable Demo Page
// Served as raw HTML so Next.js does NOT inject any security headers,
// making all 6 checker categories fire cleanly during a scan.

const HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NexaFlow — Dashboard</title>

  <!-- ═══════════════════════════════════════════════════════
       VULN 1 — Exposed API keys in client-side config object
       Checker: ApiKeyChecker
       Patterns hit: Stripe sk_live, Google AIza, AWS AKIA,
                     aws_secret_key generic, api_key generic
       ═══════════════════════════════════════════════════════ -->
  <script>
    window.NEXAFLOW = {
      stripe_secret:   "sk_live_51NzFakeKeyForDemoXXXXXXXXXXXXXXXXXXX",
      google_maps_key: "AIzaSyDemoFakeKeyForTestingPurposesXXXX",
      aws_access_key:  "AKIAIOSFODNN7DEMOKEY",
      aws_secret_key:  "wJalrXUtnFEMI/K7MDENG/bPxRfiCYDEMOKEY",
      api_key:         "nexaflow-prod-api-key-v2-internal-secret",
      env:             "production",
    };
  </script>

  <!-- ═══════════════════════════════════════════════════════
       VULN 2 — JWT / auth token stored in localStorage
       Checker: JwtExposureChecker
       Patterns hit: localStorage.setItem("access_token", …)
                     sessionStorage.setItem("refresh_token", …)
       ═══════════════════════════════════════════════════════ -->
  <script>
    // Auth hydration — runs on every page load
    var _t = document.cookie.match(/auth_token=([^;]+)/);
    if (_t) {
      localStorage.setItem("access_token", _t[1]);
      sessionStorage.setItem("refresh_token", _t[1] + "_refresh");
    }
    function persistAuth(token) {
      localStorage.setItem("access_token", token);
      localStorage.setItem("user_auth", token);
    }
  </script>

  <!-- ═══════════════════════════════════════════════════════
       VULN 3 — Hardcoded JWT token + insecure document.cookie
       Checker: JwtExposureChecker (critical — eyJ…eyJ…sig)
       Checker: CookiesChecker (no HttpOnly / Secure / SameSite)
       ═══════════════════════════════════════════════════════ -->
  <script>
    // TODO(dev): remove before production — admin override token
    var _ADMIN_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNjE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    console.log("[debug] admin override active");

    // Session cookies — set without any security flags
    document.cookie = "session_id=nxf_sess_prod_a1b2c3d4e5f6; path=/";
    document.cookie = "auth_token=nxf_auth_bearer_xyz789_secret; path=/";
    document.cookie = "user_prefs=theme%3Ddark%26sidebar%3Dcollapsed; path=/";
    document.cookie = "remember_me=true; path=/";
  </script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #f4f6f8;
      --surface:  #ffffff;
      --border:   #e2e8f0;
      --text:     #1a202c;
      --muted:    #718096;
      --accent:   #4f46e5;
      --accent-h: #4338ca;
      --green:    #10b981;
      --red:      #ef4444;
      --amber:    #f59e0b;
      --sidebar-w: 228px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Demo Banner ── */
    .demo-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 100;
      background: #0f0a2e;
      color: #a5b4fc;
      text-align: center;
      padding: 7px 16px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .demo-banner code {
      background: rgba(99,102,241,0.25);
      border-radius: 3px;
      padding: 1px 5px;
      font-family: monospace;
      color: #c7d2fe;
    }

    /* ── Shell ── */
    .shell {
      display: flex;
      min-height: 100vh;
      padding-top: 31px;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: var(--sidebar-w);
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      position: fixed;
      top: 31px; left: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 18px 16px;
      border-bottom: 1px solid var(--border);
    }
    .logo-mark {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-size: 15px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .logo-name { font-size: 15px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
    .logo-tier {
      font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      background: #eef2ff; color: #4f46e5;
      padding: 2px 6px; border-radius: 10px;
      margin-left: auto;
    }

    .sidebar-section { padding: 16px 10px 4px; }
    .sidebar-section-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.07em; color: #94a3b8;
      padding: 0 8px 7px;
    }

    .nav-item {
      display: flex; align-items: center; gap: 9px;
      padding: 7px 10px;
      border-radius: 7px;
      font-size: 13px; font-weight: 500;
      color: #64748b;
      cursor: pointer; text-decoration: none;
      transition: all 0.1s;
      margin-bottom: 1px;
    }
    .nav-item:hover { background: #f8fafc; color: #1e293b; }
    .nav-item.active { background: #eef2ff; color: #4f46e5; }
    .nav-item.active .nav-icon { color: #4f46e5; }
    .nav-icon { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.7; }
    .nav-badge {
      margin-left: auto;
      background: #fef2f2; color: #ef4444;
      font-size: 10px; font-weight: 700;
      padding: 1px 6px; border-radius: 99px;
    }

    .sidebar-footer {
      margin-top: auto;
      padding: 12px 14px 16px;
      border-top: 1px solid var(--border);
    }
    .user-row {
      display: flex; align-items: center; gap: 9px;
      padding: 7px 8px; border-radius: 8px; cursor: pointer;
    }
    .user-row:hover { background: #f8fafc; }
    .user-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .user-name { font-size: 13px; font-weight: 600; color: #1e293b; }
    .user-plan { font-size: 11px; color: #94a3b8; margin-top: 1px; }

    /* ── Main ── */
    .main {
      margin-left: var(--sidebar-w);
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* ── Topbar ── */
    .topbar {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 28px;
      height: 54px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
      position: sticky; top: 31px; z-index: 50;
    }
    .topbar-left { display: flex; align-items: center; gap: 16px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; }
    .breadcrumb span { color: #1e293b; font-weight: 600; margin-left: 4px; }
    .topbar-right { display: flex; align-items: center; gap: 8px; }

    .status-pill {
      display: inline-flex; align-items: center; gap: 5px;
      background: #f0fdf4; color: #16a34a;
      font-size: 11px; font-weight: 600;
      padding: 4px 10px; border-radius: 99px;
      border: 1px solid #bbf7d0;
    }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #16a34a; animation: blink 2s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }

    .icon-btn {
      width: 32px; height: 32px; border-radius: 8px;
      background: transparent; border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #64748b; font-size: 15px;
      transition: all 0.1s;
    }
    .icon-btn:hover { background: var(--bg); color: #1e293b; }
    .notif-wrap { position: relative; }
    .notif-dot {
      position: absolute; top: 4px; right: 4px;
      width: 7px; height: 7px; border-radius: 50%;
      background: #ef4444; border: 1.5px solid #fff;
    }

    /* ── Page content ── */
    .content { padding: 28px; max-width: 1180px; }

    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
    .page-sub { font-size: 13px; color: #94a3b8; margin-top: 3px; }

    /* ── Cards ── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .card-body { padding: 20px 22px; }
    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 22px;
      border-bottom: 1px solid var(--border);
    }
    .card-title { font-size: 14px; font-weight: 600; color: #0f172a; }
    .card-sub-text { font-size: 12px; color: #94a3b8; margin-top: 2px; }

    /* ── Stats ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; }
    .stat-value { font-size: 26px; font-weight: 800; color: #0f172a; margin: 8px 0 4px; letter-spacing: -0.03em; }
    .stat-change { font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 3px; }
    .stat-change.up { color: #10b981; }
    .stat-change.dn { color: #ef4444; }
    .stat-sparkline { height: 36px; margin-top: 10px; display: flex; align-items: flex-end; gap: 3px; }
    .spark-bar { flex: 1; background: #e0e7ff; border-radius: 2px; max-height: 36px; }
    .spark-bar.active { background: #4f46e5; }

    /* ── Grid layouts ── */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .grid-3-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }

    /* ── Table ── */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: #94a3b8; padding: 10px 16px;
      background: #f8fafc; border-bottom: 1px solid var(--border);
    }
    th:first-child { border-radius: 0; }
    td {
      padding: 11px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #475569;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafafa; }
    .td-primary { color: #1e293b; font-weight: 500; }
    .td-mono { font-family: monospace; font-size: 12px; color: #4f46e5; }

    /* ── Badges ── */
    .chip {
      display: inline-flex; align-items: center;
      font-size: 11px; font-weight: 600;
      padding: 3px 8px; border-radius: 99px;
    }
    .chip-green { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .chip-red { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .chip-amber { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .chip-blue { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .chip-gray { background: #f8fafc; color: #64748b; border: 1px solid var(--border); }

    /* ── Vuln-tag (shows scanner category visually) ── */
    .vuln-tag {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      padding: 3px 8px; border-radius: 4px; margin-bottom: 10px;
    }
    .vt-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .vt-high { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
    .vt-medium { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }

    /* ── Forms ── */
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 5px; }
    .form-hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .form-input {
      width: 100%; padding: 8px 12px;
      background: #f8fafc; border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: #1e293b;
      outline: none; transition: border-color 0.15s;
      font-family: inherit;
    }
    .form-input:focus { border-color: #4f46e5; background: #fff; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
    .form-input.mono { font-family: monospace; font-size: 12px; }
    .form-row { display: flex; gap: 12px; }
    .form-row .form-group { flex: 1; }

    /* ── Buttons ── */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px;
      font-size: 13px; font-weight: 600;
      cursor: pointer; border: none;
      transition: all 0.1s; font-family: inherit;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-h); }
    .btn-danger { background: var(--red); color: #fff; }
    .btn-danger:hover { background: #dc2626; }
    .btn-ghost {
      background: #fff; color: #374151;
      border: 1px solid var(--border);
    }
    .btn-ghost:hover { background: var(--bg); }
    .btn-sm { padding: 5px 12px; font-size: 12px; border-radius: 6px; }

    /* ── Alert boxes ── */
    .alert {
      border-radius: 8px; padding: 12px 14px;
      font-size: 12px; margin-bottom: 16px;
      display: flex; align-items: flex-start; gap: 10px;
      line-height: 1.6;
    }
    .alert-icon { flex-shrink: 0; font-size: 15px; margin-top: 1px; }
    .alert-warn { background: #fffbeb; border: 1px solid #fde68a; color: #78350f; }
    .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
    .alert-danger { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .alert b { font-weight: 700; }

    /* ── Key / secret display row ── */
    .secret-row {
      display: flex; align-items: center; gap: 0;
      background: #f8fafc; border: 1px solid var(--border);
      border-radius: 8px; overflow: hidden; margin-bottom: 8px;
    }
    .secret-key {
      font-size: 11px; font-weight: 600; color: #94a3b8;
      padding: 9px 12px;
      border-right: 1px solid var(--border);
      width: 130px; flex-shrink: 0;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .secret-val {
      font-family: monospace; font-size: 12px; color: #475569;
      padding: 9px 12px; flex: 1;
      word-break: break-all;
    }
    .secret-copy {
      padding: 0 12px; font-size: 11px; color: #4f46e5;
      cursor: pointer; flex-shrink: 0; font-weight: 600;
    }
    .secret-copy:hover { color: var(--accent-h); }

    /* ── Token debug box ── */
    .token-box {
      background: #0f172a; border-radius: 8px; padding: 14px;
      font-family: monospace; font-size: 11px; line-height: 1.7;
      margin-bottom: 12px; overflow-x: auto;
    }
    .tk-comment { color: #475569; }
    .tk-key { color: #7dd3fc; }
    .tk-val { color: #86efac; }
    .tk-str { color: #fde68a; word-break: break-all; }

    /* ── Cookie table rows ── */
    .yes { color: var(--green); font-weight: 600; }
    .no { color: var(--red); font-weight: 600; }

    /* ── Chart placeholder ── */
    .chart-bars {
      display: flex; align-items: flex-end; gap: 6px;
      height: 120px; margin-top: 12px;
    }
    .chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .chart-bar {
      width: 100%; border-radius: 4px 4px 0 0;
      background: #e0e7ff; transition: background 0.1s;
    }
    .chart-bar:hover { background: #4f46e5; }
    .chart-bar.primary { background: #4f46e5; }
    .chart-lbl { font-size: 10px; color: #94a3b8; font-weight: 500; }

    /* ── Activity feed ── */
    .feed-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .feed-item:last-child { border-bottom: none; }
    .feed-dot {
      width: 8px; height: 8px; border-radius: 50%;
      flex-shrink: 0; margin-top: 5px;
    }
    .feed-text { font-size: 12px; color: #475569; line-height: 1.5; }
    .feed-text b { color: #1e293b; font-weight: 600; }
    .feed-time { font-size: 11px; color: #94a3b8; margin-top: 2px; }

    /* ── Misc ── */
    .divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
    .mt-16 { margin-top: 16px; }
    .mt-20 { margin-top: 20px; }
    .mb-16 { margin-bottom: 16px; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .gap-8 { gap: 8px; }
    .gap-12 { gap: 12px; }
    .muted { color: #94a3b8; font-size: 12px; }
    .fw-600 { font-weight: 600; }
    .text-sm { font-size: 12px; }
    .progress-track { background: #f1f5f9; border-radius: 99px; height: 6px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 99px; }
  </style>
  <!-- ═══════════════════════════════════════════════════════
       VULN 9 — Third-Party Trackers
       Checker: TrackerChecker
       Patterns hit: google-analytics.com, mixpanel.com
       ═══════════════════════════════════════════════════════ -->
  <script src="https://www.google-analytics.com/analytics.js"></script>
  <script src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"></script>
</head>
<body>

  <!-- ── Demo Banner ── -->
  <div class="demo-banner">
    ⚠ INTENTIONALLY VULNERABLE DEMO TARGET &nbsp;·&nbsp;
    Scan this URL with Trust Issue: <code>http://localhost:3000/demo/</code> &nbsp;·&nbsp;
    All issues are deliberate — 6 vulnerability categories embedded
  </div>

  <div class="shell">

    <!-- ══════════════════ SIDEBAR ══════════════════ -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-mark">N</div>
        <span class="logo-name">NexaFlow</span>
        <span class="logo-tier">Pro</span>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Overview</div>
        <a class="nav-item active" href="#">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke-width="2"/></svg>
          Dashboard
        </a>
        <a class="nav-item" href="#">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
          Transactions
          <span class="nav-badge">3</span>
        </a>
        <a class="nav-item" href="#">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M3 3h18v12a2 2 0 01-2 2H5a2 2 0 01-2-2V3zM3 9h18"/></svg>
          Payments
        </a>
        <a class="nav-item" href="#">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Analytics
        </a>
        <a class="nav-item" href="#">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          Webhooks
        </a>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Account</div>
        <a class="nav-item" href="#api-section">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          API Keys
        </a>
        <a class="nav-item" href="#auth-section">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Authentication
        </a>
        <a class="nav-item" href="#profile-section">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          Profile
        </a>
        <a class="nav-item" href="#">
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>
          Settings
        </a>
      </div>

      <div class="sidebar-footer">
        <div class="user-row">
          <div class="user-avatar">JD</div>
          <div>
            <div class="user-name">John Doe</div>
            <div class="user-plan">Pro Plan · Admin</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- ══════════════════ MAIN ══════════════════ -->
    <div class="main">

      <!-- ── Topbar ── -->
      <header class="topbar">
        <div class="topbar-left">
          <div class="breadcrumb">NexaFlow / <span>Dashboard</span></div>
        </div>
        <div class="topbar-right">
          <div class="status-pill">
            <span class="status-dot"></span>
            All systems operational
          </div>
          <div class="notif-wrap">
            <div class="icon-btn">🔔</div>
            <div class="notif-dot"></div>
          </div>
          <div class="icon-btn">⚙</div>
          <div class="user-avatar" style="cursor:pointer">JD</div>
        </div>
      </header>

      <!-- ── Page Content ── -->
      <div class="content">

        <div class="page-header">
          <div class="page-title">Dashboard Overview</div>
          <div class="page-sub">Welcome back, John. Here's your activity for February 2026.</div>
        </div>

        <!-- Stats strip -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Revenue</div>
            <div class="stat-value">$84,320</div>
            <div class="stat-change up">↑ 12.4% vs last month</div>
            <div class="stat-sparkline">
              <div class="spark-bar" style="height:40%"></div>
              <div class="spark-bar" style="height:55%"></div>
              <div class="spark-bar" style="height:45%"></div>
              <div class="spark-bar" style="height:70%"></div>
              <div class="spark-bar" style="height:60%"></div>
              <div class="spark-bar" style="height:80%"></div>
              <div class="spark-bar active" style="height:100%"></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Transactions</div>
            <div class="stat-value">2,841</div>
            <div class="stat-change up">↑ 8.1% vs last month</div>
            <div class="stat-sparkline">
              <div class="spark-bar" style="height:50%"></div>
              <div class="spark-bar" style="height:65%"></div>
              <div class="spark-bar" style="height:55%"></div>
              <div class="spark-bar" style="height:75%"></div>
              <div class="spark-bar" style="height:70%"></div>
              <div class="spark-bar" style="height:90%"></div>
              <div class="spark-bar active" style="height:100%"></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Failed Charges</div>
            <div class="stat-value">37</div>
            <div class="stat-change dn">↑ 3.2% — investigate</div>
            <div class="stat-sparkline">
              <div class="spark-bar" style="height:30%"></div>
              <div class="spark-bar" style="height:20%"></div>
              <div class="spark-bar" style="height:35%"></div>
              <div class="spark-bar" style="height:25%"></div>
              <div class="spark-bar" style="height:40%"></div>
              <div class="spark-bar" style="height:55%"></div>
              <div class="spark-bar active" style="height:100%; background:#ef4444;"></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Active Users</div>
            <div class="stat-value">1,209</div>
            <div class="stat-change up">↑ 5.7% vs last month</div>
            <div class="stat-sparkline">
              <div class="spark-bar" style="height:60%"></div>
              <div class="spark-bar" style="height:65%"></div>
              <div class="spark-bar" style="height:70%"></div>
              <div class="spark-bar" style="height:75%"></div>
              <div class="spark-bar" style="height:80%"></div>
              <div class="spark-bar" style="height:90%"></div>
              <div class="spark-bar active" style="height:100%"></div>
            </div>
          </div>
        </div>

        <!-- ── Recent Transactions + Activity ── -->
        <div class="grid-3-1 mb-16">

          <!-- Transactions table -->
          <div class="card mb-16">
            <div class="card-header">
              <div>
                <div class="card-title">Recent Transactions</div>
                <div class="card-sub-text">Last 7 payment events</div>
              </div>
              <button class="btn btn-ghost btn-sm">Export CSV</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="td-mono">txn_3NzA1b2c3d4e</td>
                    <td class="td-primary">Alice Johnson</td>
                    <td class="fw-600">$249.00</td>
                    <td><span class="chip chip-blue">Visa ···4242</span></td>
                    <td><span class="chip chip-green">Paid</span></td>
                    <td class="muted">Feb 27, 2026</td>
                  </tr>
                  <tr>
                    <td class="td-mono">txn_3NzB5f6g7h8i</td>
                    <td class="td-primary">Bob Williams</td>
                    <td class="fw-600">$89.00</td>
                    <td><span class="chip chip-blue">MC ···8421</span></td>
                    <td><span class="chip chip-green">Paid</span></td>
                    <td class="muted">Feb 26, 2026</td>
                  </tr>
                  <tr>
                    <td class="td-mono">txn_3NzC9j0k1l2m</td>
                    <td class="td-primary">Carol Martinez</td>
                    <td class="fw-600">$450.00</td>
                    <td><span class="chip chip-gray">Amex ···0005</span></td>
                    <td><span class="chip chip-red">Failed</span></td>
                    <td class="muted">Feb 26, 2026</td>
                  </tr>
                  <tr>
                    <td class="td-mono">txn_3NzD3n4o5p6q</td>
                    <td class="td-primary">David Chen</td>
                    <td class="fw-600">$1,200.00</td>
                    <td><span class="chip chip-blue">Visa ···1111</span></td>
                    <td><span class="chip chip-green">Paid</span></td>
                    <td class="muted">Feb 25, 2026</td>
                  </tr>
                  <tr>
                    <td class="td-mono">txn_3NzE7r8s9t0u</td>
                    <td class="td-primary">Emma Wilson</td>
                    <td class="fw-600">$599.00</td>
                    <td><span class="chip chip-blue">Visa ···3344</span></td>
                    <td><span class="chip chip-amber">Pending</span></td>
                    <td class="muted">Feb 25, 2026</td>
                  </tr>
                  <tr>
                    <td class="td-mono">txn_3NzF1v2w3x4y</td>
                    <td class="td-primary">Frank Lee</td>
                    <td class="fw-600">$75.00</td>
                    <td><span class="chip chip-blue">MC ···9900</span></td>
                    <td><span class="chip chip-green">Paid</span></td>
                    <td class="muted">Feb 24, 2026</td>
                  </tr>
                  <tr>
                    <td class="td-mono">txn_3NzG5z6a7b8c</td>
                    <td class="td-primary">Grace Kim</td>
                    <td class="fw-600">$320.00</td>
                    <td><span class="chip chip-gray">Bank ACH</span></td>
                    <td><span class="chip chip-green">Paid</span></td>
                    <td class="muted">Feb 24, 2026</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Activity feed -->
          <div class="card mb-16" style="align-self:start;">
            <div class="card-header">
              <div>
                <div class="card-title">Activity</div>
                <div class="card-sub-text">Real-time events</div>
              </div>
            </div>
            <div class="card-body" style="padding-top:8px;">
              <div class="feed-item">
                <div class="feed-dot" style="background:#10b981"></div>
                <div>
                  <div class="feed-text"><b>Webhook delivered</b> to api.nexaflow.io/events</div>
                  <div class="feed-time">2 min ago</div>
                </div>
              </div>
              <div class="feed-item">
                <div class="feed-dot" style="background:#ef4444"></div>
                <div>
                  <div class="feed-text"><b>Payment failed</b> for Carol Martinez — card declined</div>
                  <div class="feed-time">14 min ago</div>
                </div>
              </div>
              <div class="feed-item">
                <div class="feed-dot" style="background:#4f46e5"></div>
                <div>
                  <div class="feed-text"><b>New customer</b> Emma Wilson signed up</div>
                  <div class="feed-time">1 hour ago</div>
                </div>
              </div>
              <div class="feed-item">
                <div class="feed-dot" style="background:#10b981"></div>
                <div>
                  <div class="feed-text"><b>Payout</b> of $4,210 sent to bank ···7890</div>
                  <div class="feed-time">3 hours ago</div>
                </div>
              </div>
              <div class="feed-item">
                <div class="feed-dot" style="background:#f59e0b"></div>
                <div>
                  <div class="feed-text"><b>Rate limit</b> warning on /api/charge endpoint</div>
                  <div class="feed-time">5 hours ago</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Revenue chart -->
        <div class="card mb-16">
          <div class="card-header">
            <div>
              <div class="card-title">Revenue — Feb 2026</div>
              <div class="card-sub-text">Daily gross volume</div>
            </div>
            <div class="flex gap-8">
              <button class="btn btn-ghost btn-sm">7D</button>
              <button class="btn btn-primary btn-sm">30D</button>
              <button class="btn btn-ghost btn-sm">90D</button>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-bars">
              <div class="chart-col"><div class="chart-bar" style="height:48px"></div><div class="chart-lbl">1</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:62px"></div><div class="chart-lbl">3</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:55px"></div><div class="chart-lbl">5</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:78px"></div><div class="chart-lbl">7</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:44px"></div><div class="chart-lbl">9</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:95px"></div><div class="chart-lbl">11</div></div>
              <div class="chart-col"><div class="chart-bar primary" style="height:110px"></div><div class="chart-lbl">13</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:88px"></div><div class="chart-lbl">15</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:72px"></div><div class="chart-lbl">17</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:105px"></div><div class="chart-lbl">19</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:90px"></div><div class="chart-lbl">21</div></div>
              <div class="chart-col"><div class="chart-bar primary" style="height:118px"></div><div class="chart-lbl">23</div></div>
              <div class="chart-col"><div class="chart-bar" style="height:85px"></div><div class="chart-lbl">25</div></div>
              <div class="chart-col"><div class="chart-bar primary" style="height:120px"></div><div class="chart-lbl">27</div></div>
            </div>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════
             SECTION: API Keys — VULN 1 (ApiKeyChecker)
             Stripe sk_live, Google AIza, AWS AKIA, generic api_key
             all extracted from window.NEXAFLOW in the head script
             ════════════════════════════════════════════════════════ -->
        <div id="api-section" class="card mb-16">
          <div class="card-header">
            <div>
              <span class="vuln-tag vt-critical">⚡ Critical &amp; High · API Keys Exposed</span>
              <div class="card-title">API Configuration</div>
              <div class="card-sub-text">Production credentials — embedded in client-side JS bundle</div>
            </div>
            <button class="btn btn-ghost btn-sm">Regenerate Keys</button>
          </div>
          <div class="card-body">
            <div class="alert alert-danger">
              <span class="alert-icon">🚨</span>
              <div>
                <b>Critical exposure:</b> These credentials are defined in <code>&lt;script&gt;</code> tags and readable by anyone who views the page source or opens DevTools. An attacker can use the Stripe key to create charges, the AWS key to read S3 buckets, and the Google key to exhaust your billing quota.
              </div>
            </div>

            <div class="secret-row">
              <div class="secret-key">Stripe Secret</div>
              <div class="secret-val">sk_live_51NzFakeKeyForDemoXXXXXXXXXXXXXXXXXXX</div>
              <div class="secret-copy">Copy</div>
            </div>
            <div class="secret-row">
              <div class="secret-key">Google Maps</div>
              <div class="secret-val">AIzaSyDemoFakeKeyForTestingPurposesXXXX</div>
              <div class="secret-copy">Copy</div>
            </div>
            <div class="secret-row">
              <div class="secret-key">AWS Access Key</div>
              <div class="secret-val">AKIAIOSFODNN7DEMOKEY</div>
              <div class="secret-copy">Copy</div>
            </div>
            <div class="secret-row">
              <div class="secret-key">AWS Secret Key</div>
              <div class="secret-val">wJalrXUtnFEMI/K7MDENG/bPxRfiCYDEMOKEY</div>
              <div class="secret-copy">Copy</div>
            </div>
            <div class="secret-row">
              <div class="secret-key">Internal API Key</div>
              <div class="secret-val">nexaflow-prod-api-key-v2-internal-secret</div>
              <div class="secret-copy">Copy</div>
            </div>
            <p class="muted mt-16">Move all secrets to server-side environment variables. Use Stripe's Publishable Key (pk_live_) on the frontend — never the secret key.</p>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════
             SECTION: Auth — VULN 2+3 (JwtExposureChecker)
             localStorage.setItem("access_token") in head script
             Hardcoded eyJ... JWT also in head script
             ════════════════════════════════════════════════════════ -->
        <div id="auth-section" class="card mb-16">
          <div class="card-header">
            <div>
              <span class="vuln-tag vt-critical">⚡ Critical · JWT Exposed + localStorage</span>
              <div class="card-title">Authentication &amp; Token Management</div>
              <div class="card-sub-text">Tokens stored in localStorage, admin JWT hardcoded in JS</div>
            </div>
          </div>
          <div class="card-body">

            <div class="alert alert-danger">
              <span class="alert-icon">🔓</span>
              <div>
                <b>Hardcoded Admin JWT detected</b> in the page's inline script. Additionally, <code>access_token</code> is written to <code>localStorage</code> on every load — readable by any JavaScript running on this origin (XSS attack vector).
              </div>
            </div>

            <div class="token-box">
              <div class="tk-comment">// Hardcoded in &lt;script&gt; — dev token never cleaned up</div>
              <div><span class="tk-key">var _ADMIN_JWT = </span><span class="tk-str">"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9</span></div>
              <div><span class="tk-str">.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIiwicm9sZSI6ImFkbWluIn0</span></div>
              <div><span class="tk-str">.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"</span>;</div>
              <br>
              <div class="tk-comment">// Written to localStorage on every page load</div>
              <div><span class="tk-key">localStorage</span><span class="tk-val">.setItem</span>(<span class="tk-str">"access_token"</span>, token);</div>
              <div><span class="tk-key">sessionStorage</span><span class="tk-val">.setItem</span>(<span class="tk-str">"refresh_token"</span>, token + <span class="tk-str">"_refresh"</span>);</div>
            </div>

            <!-- Sign-in form — VULN 5a CSRF -->
            <hr class="divider">
            <div class="flex gap-8 items-center mb-16">
              <span class="vuln-tag vt-high" style="margin-bottom:0">⚠ High · CSRF — Login Form</span>
              <span class="muted">POST /api/auth/login · no CSRF token · has password field</span>
            </div>

            <form action="/api/auth/login" method="POST">
              <!-- Intentionally: no <input type="hidden" name="csrf_token"> -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email address</label>
                  <input class="form-input" type="email" name="email" placeholder="you@company.com">
                </div>
                <div class="form-group">
                  <label class="form-label">Password</label>
                  <input class="form-input" type="password" name="password" placeholder="••••••••">
                </div>
              </div>
              <div class="flex gap-8 items-center">
                <button type="submit" class="btn btn-primary">Sign In</button>
                <span class="muted">No anti-CSRF token present → cross-origin form submission possible</span>
              </div>
            </form>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════
             SECTION: Manual Charge + Profile — VULN 5b + 5c CSRF
             POST forms with credit_card / password inputs, no token
             ════════════════════════════════════════════════════════ -->
        <div class="grid-2 mb-16">

          <!-- Payment form — CSRF high (credit_card input) -->
          <div class="card">
            <div class="card-header">
              <div>
                <span class="vuln-tag vt-high">⚠ High · CSRF — Payment Form</span>
                <div class="card-title">Manual Charge</div>
                <div class="card-sub-text">POST /api/payment/charge · no CSRF protection</div>
              </div>
            </div>
            <div class="card-body">
              <form action="/api/payment/charge" method="POST">
                <!-- No CSRF token -->
                <div class="form-group">
                  <label class="form-label">Cardholder Name</label>
                  <input class="form-input" type="text" name="cardholder_name" placeholder="Alice Johnson">
                </div>
                <div class="form-group">
                  <label class="form-label">Card Number</label>
                  <input class="form-input mono" type="text" name="credit_card" placeholder="4242 4242 4242 4242">
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Expiry</label>
                    <input class="form-input mono" type="text" name="expiry" placeholder="12/27">
                  </div>
                  <div class="form-group">
                    <label class="form-label">CVC</label>
                    <input class="form-input mono" type="text" name="cvc" placeholder="123">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Amount (USD)</label>
                  <input class="form-input" type="number" name="amount" placeholder="0.00" step="0.01">
                  <div class="form-hint">Charged immediately to the card above</div>
                </div>
                <div class="flex gap-8">
                  <button type="submit" class="btn btn-danger">Process Payment</button>
                  <button type="button" class="btn btn-ghost">Cancel</button>
                </div>
              </form>
            </div>
          </div>

          <!-- Profile form — CSRF high (email + password) -->
          <div class="card">
            <div class="card-header">
              <div>
                <span class="vuln-tag vt-high">⚠ High · CSRF — Profile Update</span>
                <div class="card-title">Update Profile</div>
                <div class="card-sub-text">POST /api/user/profile · no CSRF protection</div>
              </div>
            </div>
            <div class="card-body">
              <form action="/api/user/profile" method="POST">
                <!-- No CSRF token -->
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Full Name</label>
                    <input class="form-input" type="text" name="full_name" placeholder="John Doe" value="John Doe">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Company</label>
                    <input class="form-input" type="text" name="company" placeholder="Acme Inc." value="NexaFlow Inc.">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Email address</label>
                  <input class="form-input" type="email" name="email" placeholder="john@nexaflow.io" value="john@nexaflow.io">
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">New Password</label>
                    <input class="form-input" type="password" name="password" placeholder="••••••••">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Confirm Password</label>
                    <input class="form-input" type="password" name="confirm_password" placeholder="••••••••">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Website</label>
                  <input class="form-input" type="url" name="website" placeholder="https://yourdomain.com">
                </div>
                <button type="submit" class="btn btn-primary">Save Changes</button>
              </form>
            </div>
          </div>

        </div>

        <!-- ════════════════════════════════════════════════════════
             SECTION: Cookies — VULN 4 (CookiesChecker)
             session_id, auth_token, user_prefs, remember_me
             set via document.cookie without Secure/HttpOnly/SameSite
             ════════════════════════════════════════════════════════ -->
        <div id="profile-section" class="card mb-16">
          <div class="card-header">
            <div>
              <span class="vuln-tag vt-medium">▲ Medium/High · Insecure Cookies</span>
              <div class="card-title">Session &amp; Cookie Audit</div>
              <div class="card-sub-text">All session cookies set without security flags</div>
            </div>
          </div>
          <div class="card-body">
            <div class="alert alert-warn">
              <span class="alert-icon">⚠</span>
              <div>
                Cookies below are set via <code>document.cookie</code> with no <code>Secure</code>, <code>HttpOnly</code>, or <code>SameSite</code> flags.
                <b>HttpOnly missing</b> → readable by any script (XSS theft). <b>Secure missing</b> → sent over plain HTTP.
                <b>SameSite missing</b> → sent in cross-site requests (CSRF).
              </div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cookie Name</th>
                    <th>Value Preview</th>
                    <th>HttpOnly</th>
                    <th>Secure</th>
                    <th>SameSite</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="td-primary"><code>session_id</code></td>
                    <td class="td-mono">nxf_sess_prod_a1b2…</td>
                    <td class="no">✗ Missing</td>
                    <td class="no">✗ Missing</td>
                    <td class="no">Not set</td>
                    <td><span class="chip chip-red">High</span></td>
                  </tr>
                  <tr>
                    <td class="td-primary"><code>auth_token</code></td>
                    <td class="td-mono">nxf_auth_bearer_xyz…</td>
                    <td class="no">✗ Missing</td>
                    <td class="no">✗ Missing</td>
                    <td class="no">Not set</td>
                    <td><span class="chip chip-red">High</span></td>
                  </tr>
                  <tr>
                    <td class="td-primary"><code>remember_me</code></td>
                    <td class="td-mono">true</td>
                    <td class="no">✗ Missing</td>
                    <td class="no">✗ Missing</td>
                    <td class="no">Not set</td>
                    <td><span class="chip chip-amber">Medium</span></td>
                  </tr>
                  <tr>
                    <td class="td-primary"><code>user_prefs</code></td>
                    <td class="td-mono">theme=dark&amp;sideba…</td>
                    <td class="no">✗ Missing</td>
                    <td class="no">✗ Missing</td>
                    <td class="no">Not set</td>
                    <td><span class="chip chip-amber">Medium</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════
             SECTION: Security Headers — VULN 6 (HeadersChecker)
             All 7 HTTP security headers absent from this response
             ════════════════════════════════════════════════════════ -->
        <div class="card mb-16">
          <div class="card-header">
            <div>
              <span class="vuln-tag vt-high">⚠ High → Info · Missing 7 Security Headers</span>
              <div class="card-title">HTTP Security Header Audit</div>
              <div class="card-sub-text">None of the recommended security response headers are present</div>
            </div>
          </div>
          <div class="card-body">
            <div class="alert alert-warn">
              <span class="alert-icon">⚠</span>
              <div>
                The server's HTTP response includes <b>none</b> of the 7 OWASP-recommended security headers.
                This page intentionally omits them to demonstrate scanner detection.
              </div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Header</th>
                    <th>Status</th>
                    <th>Severity</th>
                    <th>Attack vector blocked</th>
                    <th>Recommended value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="td-mono">Content-Security-Policy</td>
                    <td class="no">MISSING</td>
                    <td><span class="chip chip-red">High</span></td>
                    <td>XSS, inline script injection</td>
                    <td class="muted">default-src 'self'</td>
                  </tr>
                  <tr>
                    <td class="td-mono">Strict-Transport-Security</td>
                    <td class="no">MISSING</td>
                    <td><span class="chip chip-red">High</span></td>
                    <td>Protocol downgrade, MITM</td>
                    <td class="muted">max-age=31536000; includeSubDomains</td>
                  </tr>
                  <tr>
                    <td class="td-mono">X-Content-Type-Options</td>
                    <td class="no">MISSING</td>
                    <td><span class="chip chip-amber">Medium</span></td>
                    <td>MIME sniffing / drive-by download</td>
                    <td class="muted">nosniff</td>
                  </tr>
                  <tr>
                    <td class="td-mono">X-Frame-Options</td>
                    <td class="no">MISSING</td>
                    <td><span class="chip chip-amber">Medium</span></td>
                    <td>Clickjacking via iframe</td>
                    <td class="muted">SAMEORIGIN</td>
                  </tr>
                  <tr>
                    <td class="td-mono">Referrer-Policy</td>
                    <td class="no">MISSING</td>
                    <td><span class="chip chip-blue">Low</span></td>
                    <td>URL leakage to third parties</td>
                    <td class="muted">strict-origin-when-cross-origin</td>
                  </tr>
                  <tr>
                    <td class="td-mono">Permissions-Policy</td>
                    <td class="no">MISSING</td>
                    <td><span class="chip chip-blue">Low</span></td>
                    <td>Unconstrained camera/mic/geo APIs</td>
                    <td class="muted">geolocation=(), camera=(), microphone=()</td>
                  </tr>
                  <tr>
                    <td class="td-mono">X-XSS-Protection</td>
                    <td class="no">MISSING</td>
                    <td><span class="chip chip-gray">Info</span></td>
                    <td>Legacy XSS filter in older browsers</td>
                    <td class="muted">1; mode=block</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Summary card -->
        <div class="card mb-16">
          <div class="card-body" style="padding: 24px 28px;">
            <div class="page-title" style="font-size:16px; margin-bottom:6px;">Security Vulnerability Summary</div>
            <div class="page-sub" style="margin-bottom:20px;">Expected findings when scanned with Trust Issue</div>

            <div style="display:grid; grid-template-columns: repeat(5,1fr); gap:12px; text-align:center;">
              <div style="background:#fef2f2; border-radius:10px; padding:14px 10px; border:1px solid #fecaca">
                <div style="font-size:28px; font-weight:800; color:#dc2626">3</div>
                <div style="font-size:11px; font-weight:700; color:#dc2626; text-transform:uppercase; letter-spacing:.05em; margin-top:3px">Critical</div>
              </div>
              <div style="background:#fff7ed; border-radius:10px; padding:14px 10px; border:1px solid #fed7aa">
                <div style="font-size:28px; font-weight:800; color:#c2410c">9+</div>
                <div style="font-size:11px; font-weight:700; color:#c2410c; text-transform:uppercase; letter-spacing:.05em; margin-top:3px">High</div>
              </div>
              <div style="background:#fffbeb; border-radius:10px; padding:14px 10px; border:1px solid #fde68a">
                <div style="font-size:28px; font-weight:800; color:#b45309">8+</div>
                <div style="font-size:11px; font-weight:700; color:#b45309; text-transform:uppercase; letter-spacing:.05em; margin-top:3px">Medium</div>
              </div>
              <div style="background:#eff6ff; border-radius:10px; padding:14px 10px; border:1px solid #bfdbfe">
                <div style="font-size:28px; font-weight:800; color:#1d4ed8">2</div>
                <div style="font-size:11px; font-weight:700; color:#1d4ed8; text-transform:uppercase; letter-spacing:.05em; margin-top:3px">Low</div>
              </div>
              <div style="background:#f8fafc; border-radius:10px; padding:14px 10px; border:1px solid #e2e8f0">
                <div style="font-size:28px; font-weight:800; color:#64748b">1</div>
                <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-top:3px">Info</div>
              </div>
            </div>
          </div>
        </div>

        <div style="text-align:center; padding:16px 0 40px; color:#94a3b8; font-size:11px;">
          NexaFlow Demo · Intentionally Vulnerable Target ·
          <code style="background:#f1f5f9; padding:1px 5px; border-radius:3px;">http://localhost:3000/demo/</code>
        </div>

      </div><!-- /content -->
    </div><!-- /main -->
  </div><!-- /shell -->

</body>
</html>`;

export async function GET() {
  return new NextResponse(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Intentionally no security headers — that's the vulnerability being demonstrated
    },
  });
}
