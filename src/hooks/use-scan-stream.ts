"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

export interface ScanEvent {
  type: string;
  scanId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function useScanStream(scanId: string | null) {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setScreenshot(null);
  }, []);

  useEffect(() => {
    if (!scanId) return;

    const ws = new WebSocket(`${WS_BASE}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Subscribe to this specific scan
      ws.send(JSON.stringify({ type: "subscribe", scanId }));
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ScanEvent;
        if (event.type === "connected") return;

        // Screenshots are handled separately (large base64)
        if (event.type === "crawler:screenshot") {
          setScreenshot(event.data.screenshot as string);
          return;
        }

        setEvents((prev) => [...prev, event]);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [scanId]);

  return { events, screenshot, connected, clearEvents };
}
