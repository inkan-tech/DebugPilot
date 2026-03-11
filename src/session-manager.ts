import * as vscode from "vscode";
import type { SessionInfo } from "./types.js";
import { ConsoleBuffer } from "./console-buffer.js";
import { DEFAULT_CONSOLE_BUFFER_SIZE, CONFIG_SECTION } from "./constants.js";

/**
 * Tracks active debug sessions and their console buffers.
 */
export class SessionManager implements vscode.Disposable {
  private sessions = new Map<string, vscode.DebugSession>();
  private consoleBuffers = new Map<string, ConsoleBuffer>();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.debug.onDidStartDebugSession((session) => {
        this.sessions.set(session.id, session);
        const bufferSize =
          vscode.workspace
            .getConfiguration(CONFIG_SECTION)
            .get<number>("consoleBufferSize") ?? DEFAULT_CONSOLE_BUFFER_SIZE;
        this.consoleBuffers.set(session.id, new ConsoleBuffer(bufferSize));
      }),
      vscode.debug.onDidTerminateDebugSession((session) => {
        this.sessions.delete(session.id);
        this.consoleBuffers.delete(session.id);
      }),
    );

    // Register existing sessions
    if (vscode.debug.activeDebugSession) {
      const s = vscode.debug.activeDebugSession;
      this.sessions.set(s.id, s);
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

  getAllSessions(): Map<string, vscode.DebugSession> {
    return this.sessions;
  }

  getSessionInfoList(): SessionInfo[] {
    const list: SessionInfo[] = [];
    for (const [id, session] of this.sessions) {
      list.push({
        id,
        name: session.name,
        type: session.type,
        status: "running", // Will be enriched by debug-adapter with actual pause state
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
  }
}
