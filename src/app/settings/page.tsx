"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Check } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [apiUrl, setApiUrl] = useState("http://localhost:3001");
  const [defaultDepth, setDefaultDepth] = useState(3);
  const [defaultPages, setDefaultPages] = useState(50);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em] text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
          Configuration and preferences
        </p>
      </div>

      {/* Backend */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-medium text-[var(--text-primary)]">Backend Connection</h2>
        <div className="flex items-center gap-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 focus-within:border-[var(--border-accent)] transition-colors duration-100">
          <Globe className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="flex-1 bg-transparent py-2 text-[13px] text-[var(--text-primary)] outline-none"
          />
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)]">
          Backend must be running for scans to work
        </p>
      </section>

      {/* Scan defaults */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-medium text-[var(--text-primary)]">Scan Defaults</h2>
        <div className="glass-card divide-y divide-[var(--border-secondary)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[13px] text-[var(--text-primary)]">Crawl Depth</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">How deep to follow links</p>
            </div>
            <select
              value={defaultDepth}
              onChange={(e) => setDefaultDepth(Number(e.target.value))}
              className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md px-2.5 py-1 text-[12px] text-[var(--text-secondary)] outline-none"
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>{d} level{d !== 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[13px] text-[var(--text-primary)]">Max Pages</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Maximum pages per scan</p>
            </div>
            <select
              value={defaultPages}
              onChange={(e) => setDefaultPages(Number(e.target.value))}
              className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md px-2.5 py-1 text-[12px] text-[var(--text-secondary)] outline-none"
            >
              {[10, 25, 50, 100, 200].map((p) => (
                <option key={p} value={p}>{p} pages</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* AI */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-medium text-[var(--text-primary)]">AI</h2>
        <div className="glass-card divide-y divide-[var(--border-secondary)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[13px] text-[var(--text-primary)]">AI Remediation</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Generate fix suggestions with Gemini</p>
            </div>
            <div className="flex h-5 w-9 items-center rounded-full bg-[var(--text-primary)] p-0.5 cursor-pointer">
              <div className="h-4 w-4 rounded-full bg-[var(--bg-primary)] translate-x-4 transition-transform" />
            </div>
          </div>

          <div className="px-4 py-3">
            <p className="text-[13px] text-[var(--text-primary)] mb-1">Gemini API Key</p>
            <p className="text-[11px] text-[var(--text-tertiary)] mb-2">
              Keys are stored securely in your browser's local storage and sent to the AI engine during scans.
            </p>
            <div className="rounded-md bg-[var(--bg-inset)] border border-[var(--border-secondary)] px-3 py-2">
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-transparent text-[11px] text-[var(--text-primary)] font-mono outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave}>
          {saved ? <><Check className="h-3.5 w-3.5" /> Saved</> : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
