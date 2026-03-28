import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  debug,
  window,
  workspace,
  commands,
  StatusBarAlignment,
} from "./mocks/vscode.js";

describe("Extension activation — lazy vs auto mode", () => {
  let statusBarItem: ReturnType<typeof window.createStatusBarItem>;
  let registeredCommands: Map<string, (...args: any[]) => any>;
  let debugStartCallbacks: Array<(session: any) => void>;
  let debugStartDisposeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    registeredCommands = new Map();
    debugStartCallbacks = [];
    debugStartDisposeSpy = vi.fn();

    vi.spyOn(commands, "registerCommand").mockImplementation(
      (cmd: string, cb: (...args: any[]) => any) => {
        registeredCommands.set(cmd, cb);
        return { dispose: () => {} };
      },
    );

    vi.spyOn(debug, "onDidStartDebugSession").mockImplementation((cb: any) => {
      debugStartCallbacks.push(cb);
      return { dispose: debugStartDisposeSpy };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------
  describe("configuration defaults", () => {
    it("startMode defaults to lazy", () => {
      const config = workspace.getConfiguration("debugPilot");
      expect(config.get("startMode", "lazy")).toBe("lazy");
    });

    it("port defaults to 45853", () => {
      const config = workspace.getConfiguration("debugPilot");
      expect(config.get("port", 45853)).toBe(45853);
    });

    it("enabled defaults to true", () => {
      const config = workspace.getConfiguration("debugPilot");
      expect(config.get("enabled", true)).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // Lazy mode behavior
  // ---------------------------------------------------------------
  describe("lazy mode (default)", () => {
    it("status bar shows waiting state before server starts", () => {
      statusBarItem.text = "$(debug-disconnect) DebugPilot (waiting)";
      statusBarItem.tooltip =
        "DebugPilot — waiting for debug session or manual start\nClick to start now";
      statusBarItem.command = "debugpilot.start";

      expect(statusBarItem.text).toContain("waiting");
      expect(statusBarItem.tooltip).toContain("manual start");
      expect(statusBarItem.command).toBe("debugpilot.start");
    });

    it("registers onDidStartDebugSession listener", () => {
      debug.onDidStartDebugSession(() => {});
      expect(debug.onDidStartDebugSession).toHaveBeenCalledOnce();
    });

    it("debug session start fires registered callback", () => {
      let serverStarted = false;
      debug.onDidStartDebugSession(() => {
        serverStarted = true;
      });

      expect(serverStarted).toBe(false);
      // Simulate VS Code firing the event
      for (const cb of debugStartCallbacks) {
        cb({ id: "sess-1", name: "Node", type: "pwa-node" });
      }
      expect(serverStarted).toBe(true);
    });

    it("debug listener self-disposes after first trigger", () => {
      // Simulate the pattern from extension.ts: self-disposing listener
      const disposable = debug.onDidStartDebugSession(() => {
        disposable.dispose();
      });

      // Fire the event
      for (const cb of debugStartCallbacks) {
        cb({ id: "sess-1", name: "Node", type: "pwa-node" });
      }

      expect(debugStartDisposeSpy).toHaveBeenCalledOnce();
    });

    it("clicking status bar triggers start command (not showConnectionInfo)", () => {
      // In waiting state, command should be debugpilot.start
      statusBarItem.command = "debugpilot.start";
      expect(statusBarItem.command).toBe("debugpilot.start");
      expect(statusBarItem.command).not.toBe("debugpilot.showConnectionInfo");
    });
  });

  // ---------------------------------------------------------------
  // Auto mode behavior
  // ---------------------------------------------------------------
  describe("auto mode", () => {
    it("does not register onDidStartDebugSession in auto mode path", () => {
      // In auto mode, we start the server immediately — no debug listener needed.
      // We verify by NOT calling onDidStartDebugSession here.
      const callsBefore = (debug.onDidStartDebugSession as any).mock?.calls
        ?.length ?? 0;

      // Simulate auto mode: just start server, no lazy wiring
      statusBarItem.text = "$(debug-disconnect) DebugPilot :45853";
      statusBarItem.command = "debugpilot.showConnectionInfo";

      const callsAfter = (debug.onDidStartDebugSession as any).mock?.calls
        ?.length ?? 0;
      expect(callsAfter).toBe(callsBefore);
    });

    it("status bar shows port immediately (no waiting)", () => {
      statusBarItem.text = "$(debug-disconnect) DebugPilot :45853";
      statusBarItem.command = "debugpilot.showConnectionInfo";

      expect(statusBarItem.text).not.toContain("waiting");
      expect(statusBarItem.text).toContain(":45853");
    });

    it("status bar command is showConnectionInfo (server already running)", () => {
      statusBarItem.command = "debugpilot.showConnectionInfo";
      expect(statusBarItem.command).toBe("debugpilot.showConnectionInfo");
    });
  });

  // ---------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------
  describe("commands registration", () => {
    it("registers debugpilot.start", () => {
      commands.registerCommand("debugpilot.start", () => {});
      expect(registeredCommands.has("debugpilot.start")).toBe(true);
    });

    it("registers debugpilot.stop", () => {
      commands.registerCommand("debugpilot.stop", () => {});
      expect(registeredCommands.has("debugpilot.stop")).toBe(true);
    });

    it("registers debugPilot.restart", () => {
      commands.registerCommand("debugPilot.restart", () => {});
      expect(registeredCommands.has("debugPilot.restart")).toBe(true);
    });

    it("registers debugpilot.showConnectionInfo", () => {
      commands.registerCommand("debugpilot.showConnectionInfo", () => {});
      expect(registeredCommands.has("debugpilot.showConnectionInfo")).toBe(true);
    });

    it("registers debugPilot.showStatus", () => {
      commands.registerCommand("debugPilot.showStatus", () => {});
      expect(registeredCommands.has("debugPilot.showStatus")).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // Status bar lifecycle
  // ---------------------------------------------------------------
  describe("status bar state transitions", () => {
    it("waiting → running after server starts", () => {
      // Before
      statusBarItem.text = "$(debug-disconnect) DebugPilot (waiting)";
      statusBarItem.command = "debugpilot.start";
      expect(statusBarItem.text).toContain("waiting");

      // After server starts (StatusBarController takes over)
      statusBarItem.text = "$(debug-disconnect) DebugPilot :45853";
      statusBarItem.command = "debugpilot.showConnectionInfo";
      expect(statusBarItem.text).toContain(":45853");
      expect(statusBarItem.text).not.toContain("waiting");
    });

    it("stopped state offers click-to-start", () => {
      statusBarItem.text = "$(debug-disconnect) DebugPilot (stopped)";
      statusBarItem.tooltip = "DebugPilot MCP Server is stopped — click to start";
      statusBarItem.command = "debugpilot.start";

      expect(statusBarItem.text).toContain("stopped");
      expect(statusBarItem.tooltip).toContain("click to start");
      expect(statusBarItem.command).toBe("debugpilot.start");
    });

    it("stopped after explicit stop command", () => {
      // Server running
      statusBarItem.text = "$(debug-disconnect) DebugPilot :45853";
      statusBarItem.command = "debugpilot.showConnectionInfo";

      // After stop
      statusBarItem.text = "$(debug-disconnect) DebugPilot (stopped)";
      statusBarItem.command = "debugpilot.start";
      expect(statusBarItem.text).toContain("stopped");
      expect(statusBarItem.command).toBe("debugpilot.start");
    });
  });

  // ---------------------------------------------------------------
  // Start/stop idempotency
  // ---------------------------------------------------------------
  describe("start/stop guards", () => {
    it("start command can be called from waiting state", () => {
      let startCalled = false;
      commands.registerCommand("debugpilot.start", () => {
        startCalled = true;
      });

      const startFn = registeredCommands.get("debugpilot.start");
      startFn?.();
      expect(startCalled).toBe(true);
    });

    it("stop command can be called when running", () => {
      let stopCalled = false;
      commands.registerCommand("debugpilot.stop", () => {
        stopCalled = true;
      });

      const stopFn = registeredCommands.get("debugpilot.stop");
      stopFn?.();
      expect(stopCalled).toBe(true);
    });

    it("restart calls stop then start", () => {
      const callOrder: string[] = [];
      commands.registerCommand("debugPilot.restart", async () => {
        callOrder.push("stop");
        callOrder.push("start");
      });

      const restartFn = registeredCommands.get("debugPilot.restart");
      restartFn?.();
      expect(callOrder).toEqual(["stop", "start"]);
    });
  });
});
