import * as vscode from "vscode";
import type { SessionInfo, SourceLocation } from "./types.js";
import { ConsoleBuffer } from "./console-buffer.js";
import { DEFAULT_CONSOLE_BUFFER_SIZE, CONFIG_SECTION } from "./constants.js";

/** Per-session pause state tracked via debug adapter messages. */
export interface PauseState {
  paused: boolean;
  reason?: "breakpoint" | "exception" | "step" | "pause";
  location?: SourceLocation;
}

/**
 * Tracks active debug sessions, their console buffers, and pause state.
 */
export class SessionManager implements vscode.Disposable {
  private sessions = new Map<string, vscode.DebugSession>();
  private consoleBuffers = new Map<string, ConsoleBuffer>();
  private pauseStates = new Map<string, PauseState>();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.debug.onDidStartDebugSession((session) => {
        this.sessions.set(session.id, session);
        this.pauseStates.set(session.id, { paused: false });
        const bufferSize =
          vscode.workspace
            .getConfiguration(CONFIG_SECTION)
            .get<number>("consoleBufferSize") ?? DEFAULT_CONSOLE_BUFFER_SIZE;
        this.consoleBuffers.set(session.id, new ConsoleBuffer(bufferSize));
      }),
      vscode.debug.onDidTerminateDebugSession((session) => {
        this.sessions.delete(session.id);
        this.consoleBuffers.delete(session.id);
        this.pauseStates.delete(session.id);
      }),
    );

    // Register debug adapter tracker to capture stopped/continued events
    this.disposables.push(
      vscode.debug.registerDebugAdapterTrackerFactory("*", {
        createDebugAdapterTracker: (session: vscode.DebugSession) => {
          return {
            onDidSendMessage: (message: DebugProtocolMessage) => {
              if (message.type !== "event") return;

              if (message.event === "stopped") {
                const body = message.body as StoppedEventBody | undefined;
                const rawReason = body?.reason ?? "pause";
                const reason = mapStopReason(rawReason);
                this.pauseStates.set(session.id, {
                  paused: true,
                  reason,
                  // Location will be populated lazily via getState() DAP calls;
                  // the stopped event doesn't include source location.
                });
              } else if (message.event === "continued") {
                this.pauseStates.set(session.id, { paused: false });
              }
            },
          };
        },
      }),
    );

    // Register existing sessions
    if (vscode.debug.activeDebugSession) {
      const s = vscode.debug.activeDebugSession;
      this.sessions.set(s.id, s);
      this.pauseStates.set(s.id, { paused: false });
      this.consoleBuffers.set(
        s.id,
        new ConsoleBuffer(DEFAULT_CONSOLE_BUFFER_SIZE),
      );
    }
  }

  getSession(sessionId: string): vscode.DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  getConsoleBuffer(sessionId: string): ConsoleBuffer | undefined {
    return this.consoleBuffers.get(sessionId);
  }

  getPauseState(sessionId: string): PauseState | undefined {
    return this.pauseStates.get(sessionId);
  }

  getAllSessions(): Map<string, vscode.DebugSession> {
    return this.sessions;
  }

  getSessionInfoList(): SessionInfo[] {
    const list: SessionInfo[] = [];
    for (const [id, session] of this.sessions) {
      const ps = this.pauseStates.get(id);
      list.push({
        id,
        name: session.name,
        type: session.type,
        status: ps?.paused ? "paused" : "running",
        pauseReason: ps?.paused ? ps.reason : undefined,
        pauseLocation: ps?.paused ? ps.location : undefined,
      });
    }
    return list;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.sessions.clear();
    this.consoleBuffers.clear();
    this.pauseStates.clear();
  }
}

// --- Internal types for DAP messages ---

interface DebugProtocolMessage {
  type: string;
  event?: string;
  body?: unknown;
}

interface StoppedEventBody {
  reason: string;
  threadId?: number;
}

function mapStopReason(
  reason: string,
): "breakpoint" | "exception" | "step" | "pause" {
  switch (reason) {
    case "breakpoint":
    case "function breakpoint":
    case "data breakpoint":
      return "breakpoint";
    case "exception":
      return "exception";
    case "step":
      return "step";
    default:
      return "pause";
  }
}
