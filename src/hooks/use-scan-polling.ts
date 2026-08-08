"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getScan } from "@/lib/api";
import type { ScanResult, ScanStatus } from "@/types/scan";

const TERMINAL_STATUSES: ScanStatus[] = ["completed", "error"];

export function useScanPolling(scanId: string | null, intervalMs = 1500) {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!scanId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getScan(scanId);
        if (cancelled) return;
        setScan(data);
        if (TERMINAL_STATUSES.includes(data.status)) {
          stop();
        }
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        stop();
      }
    };

    // Fetch immediately, then start interval
    poll();
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      stop();
    };
  }, [scanId, intervalMs, stop]);

  return { scan, error, stop };
}
