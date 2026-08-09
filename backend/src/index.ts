import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { scanRouter } from "./routes/scan.js";
import { attachWebSocket } from "./ws-server.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Attach WebSocket to the same HTTP server
attachWebSocket(server);

// Security: remove Express fingerprint
app.disable("x-powered-by");

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins for the hackathon (Vercel, localhost, extensions)
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Simple rate limiter — per-IP scan creation throttle
const scanRateMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000; // 1 minute
const MAX_SCANS_PER_WINDOW = 5;

function rateLimitScans(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const timestamps = (scanRateMap.get(ip) || []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );

  if (timestamps.length >= MAX_SCANS_PER_WINDOW) {
    res.status(429).json({ error: "Too many scans. Try again in a minute." });
    return;
  }

  timestamps.push(now);
  scanRateMap.set(ip, timestamps);
  next();
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes — rate limit on scan creation only
app.post("/api/scan", rateLimitScans);
app.use("/api/scan", scanRouter);

server.listen(PORT, () => {
  console.log(`[TrustIssue] Backend running on http://localhost:${PORT}`);
  console.log(`[TrustIssue] WebSocket available at ws://localhost:${PORT}/ws`);
});
