import * as vscode from "vscode";
import type { SessionManager } from "./session-manager.js";
import type { ConsoleMessage } from "./types.js";

/**
 * Maps DAP output event categories to ConsoleMessage types.
 */
function mapCategory(
  category: string | undefined,
): ConsoleMessage["type"] {
  switch (category) {
    case "stdout":
      return "stdout";
    case "stderr":
      return "stderr";
    case "console":
      return "console";
    default:
      return "debug";
  }
}

/**
 * Intercepts DAP messages to capture console output into per-session ConsoleBuffers.
 */
export class DebugOutputTracker implements vscode.DebugAdapterTracker {
  constructor(
    private readonly sessionId: string,
    private readonly sessionManager: SessionManager,
  ) {}

  onDidSendMessage(message: unknown): void {
    if (!isOutputEvent(message)) return;

    const buffer = this.sessionManager.getConsoleBuffer(this.sessionId);
    if (!buffer) return;

    const text = message.body.output;
    if (!text) return;

    const consoleMessage = {
      type: mapCategory(message.body.category),
      text,
      timestamp: new Date().toISOString(),
    };

    buffer.push(consoleMessage);

    // Emit for WebSocket streaming
    this.sessionManager.events.emit("consoleOutput", {
      sessionId: this.sessionId,
      message: consoleMessage,
    });
  }
}

/**
 * Factory that creates a DebugOutputTracker for each debug session.
 */
export class DebugOutputTrackerFactory
  implements vscode.DebugAdapterTrackerFactory
{
  constructor(private readonly sessionManager: SessionManager) {}

  createDebugAdapterTracker(
    session: vscode.DebugSession,
  ): vscode.DebugAdapterTracker {
    return new DebugOutputTracker(session.id, this.sessionManager);
  }
}

// -- Type guard for DAP output events --

interface DapOutputEvent {
  type: "event";
  event: "output";
  body: {
    category?: string;
    output: string;
  };
}

function isOutputEvent(msg: unknown): msg is DapOutputEvent {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === "event" && m.event === "output" && typeof m.body === "object";
}
