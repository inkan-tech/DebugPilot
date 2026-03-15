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

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  if (!config.get<boolean>("enabled", true)) {
    return;
  }

  sessionManager = new SessionManager();
  adapter = new VscodeDebugAdapter(sessionManager);
  server = new DebugMcpServer(adapter, sessionManager);

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(statusBarItem);

  try {
    await server.start();
  } catch (err) {
    vscode.window.showErrorMessage(
      `DebugPilot: Failed to start MCP server: ${err instanceof Error ? err.message : String(err)}`,
    );
    statusBarItem.text = "$(debug) DebugPilot (stopped)";
    statusBarItem.tooltip = "DebugPilot MCP Server is stopped";
    statusBarItem.show();
    return;
  }

  // Wire status bar controller (R1)
  statusBarController = new StatusBarController(sessionManager, statusBarItem, server.port);

  // Wire diagnostics watcher (R6)
  diagnosticsWatcher = new DiagnosticsWatcher(sessionManager);

  // Wire WebSocket broker (R2) — shares the HTTP server on /ws
  const httpServer = server.server;
  if (httpServer) {
    wsBroker = new WebSocketBroker(httpServer, sessionManager, adapter);
  }

  // Register debug adapter tracker to capture console output
  const trackerFactory = new DebugOutputTrackerFactory(sessionManager);
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterTrackerFactory("*", trackerFactory),
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("debugPilot.restart", async () => {
      if (server) {
        wsBroker?.dispose();
        wsBroker = undefined;
        await server.stop();
        statusBarItem.text = "$(debug) DebugPilot (stopped)";
        statusBarItem.tooltip = "DebugPilot MCP Server is stopped";
        await server.start();
        // Re-create broker on new httpServer
        const newHttpServer = server.server;
        if (newHttpServer && sessionManager) {
          wsBroker = new WebSocketBroker(newHttpServer, sessionManager, adapter);
        }
        statusBarController?.dispose();
        statusBarController = new StatusBarController(sessionManager!, statusBarItem, server.port);
        vscode.window.showInformationMessage("DebugPilot: MCP server restarted");
      }
    }),
    vscode.commands.registerCommand("debugPilot.showStatus", () => {
      const sessions = adapter?.getSessions() ?? [];
      vscode.window.showInformationMessage(
        `DebugPilot: ${sessions.length} active session(s) — http://127.0.0.1:${server?.port}/mcp`,
      );
    }),
    vscode.commands.registerCommand("debugpilot.showConnectionInfo", async () => {
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
    sessionManager,
  );

  vscode.window.showInformationMessage(
    `DebugPilot: MCP server running on http://127.0.0.1:${server.port}/mcp`,
  );
}

export async function deactivate(): Promise<void> {
  wsBroker?.dispose();
  statusBarController?.dispose();
  diagnosticsWatcher?.dispose();
  adapter?.dispose();
  await server?.stop();
  sessionManager?.dispose();
}
