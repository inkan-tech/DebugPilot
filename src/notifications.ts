import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { SessionManager } from "./session-manager.js";

/**
 * Bridges SessionManager debug events to MCP resource-update notifications.
 *
 * When a debug event occurs (session start/stop, breakpoint hit, exception),
 * subscribed MCP clients are notified that the relevant resources have changed.
 */
export class NotificationManager {
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly mcpServer: Server,
    private readonly sessionManager: SessionManager,
  ) {
    this.wire();
  }

  private wire(): void {
    const emitter = this.sessionManager.events;

    const onSessionStarted = () => {
      this.notifySessionsChanged();
    };

    const onSessionTerminated = () => {
      this.notifySessionsChanged();
    };

    const onStopped = (data: { sessionId: string; reason: string }) => {
      this.notifySessionsChanged();
      if (data.reason === "breakpoint") {
        this.notifyBreakpointsChanged();
      }
    };

    const onContinued = () => {
      this.notifySessionsChanged();
    };

    const onDiagnosticsChanged = () => {
      this.notifyDiagnosticsChanged();
    };

    emitter.on("sessionStarted", onSessionStarted);
    emitter.on("sessionTerminated", onSessionTerminated);
    emitter.on("stopped", onStopped);
    emitter.on("continued", onContinued);
    emitter.on("diagnosticsChanged", onDiagnosticsChanged);

    this.cleanups.push(() => {
      emitter.off("sessionStarted", onSessionStarted);
      emitter.off("sessionTerminated", onSessionTerminated);
      emitter.off("stopped", onStopped);
      emitter.off("continued", onContinued);
      emitter.off("diagnosticsChanged", onDiagnosticsChanged);
    });
  }

  private notifySessionsChanged(): void {
    this.mcpServer
      .sendResourceUpdated({ uri: "debug://sessions" })
      .catch(() => {
        // Client may not be subscribed — ignore
      });
    this.mcpServer.sendResourceListChanged().catch(() => {});
  }

  private notifyDiagnosticsChanged(): void {
    this.mcpServer
      .sendResourceUpdated({ uri: "debug://diagnostics" })
      .catch(() => {});
  }

  private notifyBreakpointsChanged(): void {
    this.mcpServer
      .sendResourceUpdated({ uri: "debug://breakpoints" })
      .catch(() => {});
  }

  dispose(): void {
    for (const fn of this.cleanups) {
      fn();
    }
    this.cleanups.length = 0;
  }
}
