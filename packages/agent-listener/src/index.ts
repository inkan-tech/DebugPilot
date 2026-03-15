#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { WsClient } from "./ws-client.js";
import { Analyzer } from "./analyzer.js";

const config = loadConfig();

console.log("DebugPilot Agent Listener (hybrid)");
console.log(`  WebSocket:     ${config.wsUrl}`);
console.log(`  Triage:        Groq ${config.groqModel}`);
console.log(`  Deep analysis: claude CLI (--continue)`);
console.log(`  Escalation:    severity >= ${config.escalationThreshold}`);
console.log(`  Exceptions:    ${config.analyzeExceptions ? "on" : "off"}`);
console.log(`  Breakpoints:   ${config.analyzeBreakpoints ? "on" : "off"}`);
console.log("");

const ws = new WsClient(config.wsUrl, ["stopped", "session.started", "session.terminated"], config.verbose);
const analyzer = new Analyzer(ws, config);

ws.on("connected", () => {
  console.log("Connected to DebugPilot — waiting for debug events...\n");
});

ws.on("disconnected", () => {
  console.log("Disconnected — will reconnect...\n");
});

ws.on("event", (event) => {
  if (config.verbose) {
    console.error(`[event] ${event.type}`, JSON.stringify(event.data));
  }

  analyzer.onEvent(event).catch((err) => {
    console.error(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\nShutting down...");
  ws.dispose();
  await analyzer.dispose();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start
ws.connect();
