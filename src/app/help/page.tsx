const features = [
  {
    title: "Automated Crawling",
    description:
      "Playwright-powered headless browser crawls your app, following links and discovering pages. Configurable depth and page limits.",
  },
  {
    title: "Heuristic Analysis",
    description:
      "Six specialized checkers scan for missing security headers, insecure cookies, JWT exposure, API key leaks, CSRF vulnerabilities, and misconfigurations.",
  },
  {
    title: "AI Remediation",
    description:
      "Each finding includes an AI-generated explanation, a code fix, and a Cursor AI prompt. Powered by Gemini with curated fallback templates.",
  },
  {
    title: "Developer-First",
    description:
      "Built for developers during development. Copy fixes directly into your codebase. No security expertise required.",
  },
];

const checks = [
  {
    title: "Security Headers",
    items: [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-XSS-Protection",
      "X-Powered-By disclosure",
    ],
  },
  {
    title: "Cookie Security",
    items: [
      "HttpOnly flag",
      "Secure flag",
      "SameSite attribute",
      "Sensitive cookie detection",
    ],
  },
  {
    title: "Client-Side",
    items: [
      "JWT in localStorage / sessionStorage",
      "Hardcoded JWT tokens",
      "Exposed API keys (12 patterns)",
      "CSRF token presence in forms",
    ],
  },
  {
    title: "Server Config",
    items: [
      "Mixed content detection",
      "Directory listing",
      "Server version disclosure",
      "Sensitive endpoint exposure",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Trust Issue
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
          AI-powered security scanning for web developers
        </p>
      </div>

      {/* How it works */}
      <section className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)]">
          How It Works
        </h2>
        <div className="grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-[var(--border-primary)]">
          {[
            { step: "01", title: "Crawl", desc: "Enter a URL. Playwright crawls all discoverable pages." },
            { step: "02", title: "Analyze", desc: "Six security checkers scan for common vulnerabilities." },
            { step: "03", title: "Fix", desc: "AI generates explanations, code fixes, and prompts." },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-[var(--bg-secondary)] p-5"
            >
              <span className="text-xs font-mono text-[var(--text-tertiary)]">{item.step}</span>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-2">{item.title}</p>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)]">
          Features
        </h2>
        <div className="glass-card divide-y divide-[var(--border-secondary)]">
          {features.map((f) => (
            <div key={f.title} className="px-5 py-4">
              <p className="text-sm font-medium text-[var(--text-primary)]">{f.title}</p>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mt-1">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security checks */}
      <section className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)]">
          Checks Reference
        </h2>
        <div className="grid grid-cols-2 gap-6">
          {checks.map((group) => (
            <div key={group.title} className="glass-card p-5">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-3">{group.title}</p>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[13px] text-[var(--text-secondary)]">
                    <span className="h-1 w-1 rounded-full bg-[var(--text-secondary)] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Quick start */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-[var(--text-secondary)]">
          Quick Start
        </h2>
        <div className="rounded-lg bg-[var(--bg-inset)] border border-[var(--border-secondary)] p-4 space-y-2 font-mono text-[12px]">
          <div className="flex items-start gap-2">
            <span className="text-[var(--text-tertiary)] select-none">$</span>
            <span className="text-[var(--text-secondary)]">cd backend && cp .env.example .env</span>
          </div>
          <p className="text-[var(--text-secondary)] text-[11px] pl-4 font-sans"># Add Gemini API key (optional)</p>
          <div className="flex items-start gap-2">
            <span className="text-[var(--text-tertiary)] select-none">$</span>
            <span className="text-[var(--text-secondary)]">npm run dev</span>
          </div>
          <p className="text-[var(--text-secondary)] text-[11px] pl-4 font-sans"># Frontend :3000 · Backend :3001</p>
          <div className="flex items-start gap-2 pt-1 border-t border-[var(--border-secondary)]">
            <span className="text-[var(--text-tertiary)] select-none">→</span>
            <span className="text-[var(--text-secondary)]">localhost:3000</span>
          </div>
        </div>
      </section>
    </div>
  );
}
