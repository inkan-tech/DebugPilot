import type * as vscode from "vscode";
import type { SessionManager } from "./session-manager.js";

type DebugBarState = "idle" | "running" | "paused" | "exception";

/**
 * Keeps the status bar item in sync with debug session state.
 */
export class StatusBarController {
  private state: DebugBarState = "idle";
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly item: vscode.StatusBarItem,
    private readonly port: number,
  ) {
    this.wire();
    this.update();
  }

  private wire(): void {
    const emitter = this.sessionManager.events;

    const onStarted = () => {
      this.state = "running";
      this.update();
    };

    const onTerminated = () => {
      const sessions = this.sessionManager.getSessionInfoList();
      this.state = sessions.length > 0 ? "running" : "idle";
      this.update();
    };

    const onStopped = (data: { sessionId: string; reason: string }) => {
      this.state = data.reason === "exception" ? "exception" : "paused";
      this.update();
    };

    const onContinued = () => {
      this.state = "running";
      this.update();
    };

    emitter.on("sessionStarted", onStarted);
    emitter.on("sessionTerminated", onTerminated);
    emitter.on("stopped", onStopped);
    emitter.on("continued", onContinued);

    this.cleanups.push(() => {
      emitter.off("sessionStarted", onStarted);
      emitter.off("sessionTerminated", onTerminated);
      emitter.off("stopped", onStopped);
      emitter.off("continued", onContinued);
    });
  }

  private update(): void {
    const mcp = `http://127.0.0.1:${this.port}/mcp`;
    const ws = `ws://127.0.0.1:${this.port}/ws`;

    switch (this.state) {
      case "idle":
        this.item.text = `$(debug-disconnect) DebugPilot :${this.port}`;
        this.item.tooltip = `DebugPilot — MCP: ${mcp}  WS: ${ws}\nClick to copy URLs`;
        this.item.command = "debugpilot.showConnectionInfo";
        break;
      case "running":
        this.item.text = `$(debug-start) DebugPilot :${this.port}`;
        this.item.tooltip = `DebugPilot — debugging in progress\nMCP: ${mcp}  WS: ${ws}`;
        this.item.command = "debugpilot.showConnectionInfo";
        break;
      case "paused":
        this.item.text = `$(debug-pause) DebugPilot :${this.port} [paused]`;
        this.item.tooltip = `DebugPilot — paused at breakpoint/step\nMCP: ${mcp}  WS: ${ws}`;
        this.item.command = "debugpilot.showConnectionInfo";
        break;
      case "exception":
        this.item.text = `$(error) DebugPilot :${this.port} [exception]`;
        this.item.tooltip = `DebugPilot — stopped on exception\nMCP: ${mcp}  WS: ${ws}`;
        this.item.command = "debugpilot.showConnectionInfo";
        break;
    }
    this.item.show();
  }

  dispose(): void {
    for (const fn of this.cleanups) {
      fn();
    }
    this.cleanups.length = 0;
  }
}
