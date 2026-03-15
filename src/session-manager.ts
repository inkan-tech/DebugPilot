import { EventEmitter } from "node:events";
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
 * Events emitted by SessionManager for debug state changes.
 *
 * - "sessionStarted"   — { sessionId, name, type }
 * - "sessionTerminated" — { sessionId }
 * - "stopped"           — { sessionId, reason } (breakpoint hit, exception, step, pause)
 * - "continued"         — { sessionId }
 * - "consoleOutput"     — { sessionId, message } (console output from debug adapter)
 * - "diagnosticsChanged" — { files } (VS Code diagnostics changed)
 */
export interface SessionManagerEvents {
  sessionStarted: [{ sessionId: string; name: string; type: string }];
  sessionTerminated: [{ sessionId: string }];
  stopped: [{ sessionId: string; reason: "breakpoint" | "exception" | "step" | "pause" }];
  continued: [{ sessionId: string }];
  consoleOutput: [{ sessionId: string; message: import("./types.js").ConsoleMessage }];
  diagnosticsChanged: [{ files: string[] }];
}

/**
 * Tracks active debug sessions, their console buffers, and pause state.
 */
/** Metadata for a terminated session whose console is still available. */
export interface TerminatedSessionInfo {
  id: string;
  name: string;
  type: string;
  terminatedAt: string;
}

const MAX_HISTORY = 10;

export class SessionManager implements vscode.Disposable {
  private sessions = new Map<string, vscode.DebugSession>();
  private consoleBuffers = new Map<string, ConsoleBuffer>();
  private pauseStates = new Map<string, PauseState>();
  /** Console buffers preserved after session termination. */
  private history = new Map<string, { info: TerminatedSessionInfo; buffer: ConsoleBuffer }>();
  private disposables: vscode.Disposable[] = [];
  private readonly _emitter = new EventEmitter();

  /** Typed event emitter for debug state changes. */
  get events(): EventEmitter {
    return this._emitter;
  }

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

        // Auto-configure Dart/Flutter to only break on unhandled exceptions
        // Dart sessions fire caught MissingPluginExceptions frequently (platform channels)
        if (session.type === "dart") {
          Promise.resolve(session.customRequest("setExceptionBreakpoints", { filters: ["Unhandled"] })).catch(() => {});
        }

        this._emitter.emit("sessionStarted", {
          sessionId: session.id,
          name: session.name,
          type: session.type,
        });
      }),
      vscode.debug.onDidTerminateDebugSession((session) => {
        // Preserve console buffer in history before removing
        const buffer = this.consoleBuffers.get(session.id);
        if (buffer && buffer.size > 0) {
          this.history.set(session.id, {
            info: {
              id: session.id,
              name: session.name,
              type: session.type,
              terminatedAt: new Date().toISOString(),
            },
            buffer,
          });
          // Evict oldest if over limit
          if (this.history.size > MAX_HISTORY) {
            const oldest = this.history.keys().next().value;
            if (oldest) this.history.delete(oldest);
          }
        }
        this.sessions.delete(session.id);
        this.consoleBuffers.delete(session.id);
        this.pauseStates.delete(session.id);
        this._emitter.emit("sessionTerminated", { sessionId: session.id });
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
                this._emitter.emit("stopped", {
                  sessionId: session.id,
                  reason,
                });
              } else if (message.event === "continued") {
                this.pauseStates.set(session.id, { paused: false });
                this._emitter.emit("continued", { sessionId: session.id });
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

  /** Get console buffer from a terminated session. */
  getHistoryBuffer(sessionId: string): ConsoleBuffer | undefined {
    return this.history.get(sessionId)?.buffer;
  }

  /** Get all terminated sessions with preserved console output. */
  getTerminatedSessions(): TerminatedSessionInfo[] {
    return [...this.history.values()].map((h) => h.info);
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
    this._emitter.removeAllListeners();
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
