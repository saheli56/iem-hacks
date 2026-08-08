import { EventEmitter } from "events";

// ── Granular scan event types ──

export type ScanEventType =
  | "scan:started"
  | "scan:status-change"
  | "crawler:page-navigating"
  | "crawler:page-loaded"
  | "crawler:page-error"
  | "crawler:screenshot"
  | "crawler:form-probe-result"
  | "analyzer:checker-start"
  | "analyzer:checker-result"
  | "analyzer:finding"
  | "ai:batch-start"
  | "ai:finding-start"
  | "ai:finding-done"
  | "ai:complete"
  | "scan:completed"
  | "scan:aborted"
  | "scan:error";

export interface ScanEvent {
  type: ScanEventType;
  scanId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

class ScanEventBus extends EventEmitter {
  emit(scanId: string, event: Omit<ScanEvent, "scanId" | "timestamp">): boolean {
    const full: ScanEvent = {
      ...event,
      scanId,
      timestamp: new Date().toISOString(),
    };
    return super.emit("scan-event", full);
  }

  onScanEvent(handler: (event: ScanEvent) => void) {
    this.on("scan-event", handler);
  }

  offScanEvent(handler: (event: ScanEvent) => void) {
    this.off("scan-event", handler);
  }
}

export const scanEventBus = new ScanEventBus();
