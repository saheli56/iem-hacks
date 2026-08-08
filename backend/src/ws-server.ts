import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { scanEventBus, type ScanEvent } from "./events.js";

interface ClientInfo {
  ws: WebSocket;
  scanId: string | null; // which scan this client is watching (null = all)
}

const clients = new Set<ClientInfo>();

export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    const client: ClientInfo = { ws, scanId: null };
    clients.add(client);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Client can subscribe to a specific scan
        if (msg.type === "subscribe" && typeof msg.scanId === "string") {
          client.scanId = msg.scanId;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(client);
    });

    // Send welcome
    ws.send(JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }));
  });

  // Forward all scan events to matching WS clients
  scanEventBus.onScanEvent((event: ScanEvent) => {
    const payload = JSON.stringify(event);

    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      // Send if client is watching this scan or watching all
      if (!client.scanId || client.scanId === event.scanId) {
        client.ws.send(payload);
      }
    }
  });

  console.log("[WebSocket] Attached to server on /ws");
}
