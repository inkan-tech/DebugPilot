import * as vscode from "vscode";
import { SessionManager } from "./session-manager.js";
import { VscodeDebugAdapter } from "./debug-adapter.js";
import { DebugMcpServer } from "./server.js";
import { DebugOutputTrackerFactory } from "./debug-tracker.js";
import { StatusBarController } from "./status-bar-controller.js";
import { DiagnosticsWatcher } from "./diagnostics-watcher.js";
import { WebSocketBroker } from "./websocket-broker.js";
import { CONFIG_SECTION } from "./constants.js";

let server: DebugMcpServer | undefined;
let sessionManager: SessionManager | undefined;
let adapter: VscodeDebugAdapter | undefined;
let statusBarController: StatusBarController | undefined;
let diagnosticsWatcher: DiagnosticsWatcher | undefined;
let wsBroker: WebSocketBroker | undefined;

let serverRunning = false;
let statusBarItem: vscode.StatusBarItem;

/** Start the MCP server and wire all components. */
async function startServer(context: vscode.ExtensionContext): Promise<boolean> {
  if (serverRunning) {
    return true;
  }

  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const port = config.get<number>("port", 45853);

  sessionManager = new SessionManager();
  adapter = new VscodeDebugAdapter(sessionManager);
  server = new DebugMcpServer(adapter, sessionManager);

  try {
    await server.start(port);
  } catch (err) {
    vscode.window.showErrorMessage(
      `DebugPilot: Failed to start MCP server: ${err instanceof Error ? err.message : String(err)}`,
    );
    updateStatusBarStopped();
    return false;
  }

  serverRunning = true;

  // Wire status bar controller
  statusBarController = new StatusBarController(sessionManager, statusBarItem, server.port);

  // Wire diagnostics watcher
  diagnosticsWatcher = new DiagnosticsWatcher(sessionManager);

  // Wire WebSocket broker — shares the HTTP server on /ws
  const httpServer = server.server;
  if (httpServer) {
    wsBroker = new WebSocketBroker(httpServer, sessionManager, adapter);
  }

  // Register debug adapter tracker to capture console output
  const trackerFactory = new DebugOutputTrackerFactory(sessionManager);
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterTrackerFactory("*", trackerFactory),
  );

  // Push disposables
  context.subscriptions.push(sessionManager);

  vscode.window.showInformationMessage(
    `DebugPilot: MCP http://127.0.0.1:${server.port}/mcp  WS ws://127.0.0.1:${server.port}/ws`,
  );

  return true;
}

/** Stop the MCP server and tear down components. */
async function stopServer(): Promise<void> {
  if (!serverRunning) {
    return;
  }

  wsBroker?.dispose();
  wsBroker = undefined;
  statusBarController?.dispose();
  statusBarController = undefined;
  diagnosticsWatcher?.dispose();
  diagnosticsWatcher = undefined;
  adapter?.dispose();
  adapter = undefined;
  await server?.stop();
  server = undefined;
  sessionManager?.dispose();
  sessionManager = undefined;

  serverRunning = false;
  updateStatusBarStopped();
}

function updateStatusBarStopped(): void {
  statusBarItem.text = "$(debug-disconnect) DebugPilot (stopped)";
  statusBarItem.tooltip = "DebugPilot MCP Server is stopped — click to start";
  statusBarItem.command = "debugpilot.start";
  statusBarItem.show();
}

function updateStatusBarWaiting(): void {
  statusBarItem.text = "$(debug-disconnect) DebugPilot (waiting)";
  statusBarItem.tooltip =
    "DebugPilot — waiting for debug session or manual start\nClick to start now";
  statusBarItem.command = "debugpilot.start";
  statusBarItem.show();
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  if (!config.get<boolean>("enabled", true)) {
    return;
  }

  const startMode = config.get<string>("startMode", "lazy");

  // Status bar item — always created
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(statusBarItem);

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("debugpilot.start", async () => {
      await startServer(context);
    }),

    vscode.commands.registerCommand("debugpilot.stop", async () => {
      await stopServer();
      vscode.window.showInformationMessage("DebugPilot: MCP server stopped");
    }),

    vscode.commands.registerCommand("debugPilot.restart", async () => {
      await stopServer();
      const ok = await startServer(context);
      if (ok) {
        vscode.window.showInformationMessage("DebugPilot: MCP server restarted");
      }
    }),

    vscode.commands.registerCommand("debugPilot.showStatus", () => {
      const sessions = adapter?.getSessions() ?? [];
      if (!serverRunning) {
        vscode.window.showInformationMessage(
          `DebugPilot: Server is not running. ${sessions.length} session(s).`,
        );
        return;
      }
      vscode.window.showInformationMessage(
        `DebugPilot: ${sessions.length} active session(s) — http://127.0.0.1:${server?.port}/mcp`,
      );
    }),

    vscode.commands.registerCommand("debugpilot.showConnectionInfo", async () => {
      if (!serverRunning) {
        const action = await vscode.window.showInformationMessage(
          "DebugPilot: Server is not running",
          "Start Server",
        );
        if (action === "Start Server") {
          await startServer(context);
        }
        return;
      }
      const url = `http://127.0.0.1:${server?.port}/mcp`;
      const wsUrl = `ws://127.0.0.1:${server?.port}/ws`;
      const action = await vscode.window.showInformationMessage(
        `DebugPilot MCP: ${url} | WS: ${wsUrl}`,
        "Copy MCP URL",
        "Copy WS URL",
      );
      if (action === "Copy MCP URL") {
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage("MCP endpoint URL copied to clipboard");
      } else if (action === "Copy WS URL") {
        await vscode.env.clipboard.writeText(wsUrl);
        vscode.window.showInformationMessage("WebSocket URL copied to clipboard");
      }
    }),
  );

  // --- Start mode logic ---
  if (startMode === "auto") {
    // Auto: start immediately (previous behavior)
    await startServer(context);
  } else {
    // Lazy (default): show waiting status, start on first debug session
    updateStatusBarWaiting();

    const debugStartDisposable = vscode.debug.onDidStartDebugSession(async () => {
      if (!serverRunning) {
        await startServer(context);
      }
      // Self-dispose — only need to trigger once
      debugStartDisposable.dispose();
    });
    context.subscriptions.push(debugStartDisposable);
  }
}

export async function deactivate(): Promise<void> {
  await stopServer();
}
