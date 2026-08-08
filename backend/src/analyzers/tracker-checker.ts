import { v4 as uuidv4 } from "uuid";
import type { SecurityChecker, CheckContext } from "./base-checker.js";
import type { Finding } from "../types.js";

const KNOWN_TRACKERS = [
  "google-analytics.com",
  "googletagmanager.com",
  "facebook.net",
  "hotjar.com",
  "mixpanel.com",
  "segment.com",
  "fullstory.com",
  "sentry.io",
  "datadoghq-browser-agent.com",
  "doubleclick.net",
  "pixel.facebook.com"
];

export class TrackerChecker implements SecurityChecker {
  name = "Third-Party Tracker Analysis";

  check(context: CheckContext): Finding[] {
    const findings: Finding[] = [];
    const seenDomains = new Set<string>();
    let trackerCount = 0;
    
    let targetOrigin = "";
    try {
      targetOrigin = new URL(context.targetUrl).origin;
    } catch {
      return [];
    }

    for (const resp of context.networkResponses) {
      try {
        const respUrl = new URL(resp.url);
        
        // Skip first-party requests
        if (respUrl.origin === targetOrigin) continue;

        const domain = respUrl.hostname;
        
        // Check if it's a known tracker
        const isTracker = KNOWN_TRACKERS.some(t => domain.includes(t));
        
        if (isTracker) {
          if (!seenDomains.has(domain)) {
            seenDomains.add(domain);
            trackerCount++;
          }
        }
      } catch {
        // invalid URL, ignore
      }
    }

    if (trackerCount > 0) {
      findings.push({
        id: uuidv4(),
        category: "trackers",
        severity: "info",
        title: `Third-Party Trackers Detected`,
        description: `This application relies on ${trackerCount} distinct third-party tracking/analytics services (e.g., ${Array.from(seenDomains).join(", ")}). While common, third-party scripts introduce supply-chain risks and privacy concerns. Ensure they are loaded securely and comply with privacy regulations (GDPR/CCPA).`,
        affectedUrl: context.targetUrl,
        evidence: `Detected trackers: ${Array.from(seenDomains).join(", ")}`,
        detectedAt: new Date().toISOString(),
      });
    }

    return findings;
  }
}
