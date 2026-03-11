import * as vscode from "vscode";
import { SessionManager } from "./session-manager.js";
import { VscodeDebugAdapter } from "./debug-adapter.js";
import { DebugMcpServer } from "./server.js";
import { DebugOutputTrackerFactory } from "./debug-tracker.js";
import { CONFIG_SECTION } from "./constants.js";

let server: DebugMcpServer | undefined;
let sessionManager: SessionManager | undefined;
let adapter: VscodeDebugAdapter | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  if (!config.get<boolean>("enabled", true)) {
    return;
  }

  sessionManager = new SessionManager();
  adapter = new VscodeDebugAdapter(sessionManager);
  server = new DebugMcpServer(adapter);

  try {
    await server.start();
  } catch (err) {
    vscode.window.showErrorMessage(
      `DebugPilot: Failed to start MCP server: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
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
        await server.stop();
        await server.start();
        vscode.window.showInformationMessage("DebugPilot: MCP server restarted");
      }
    }),
    vscode.commands.registerCommand("debugPilot.showStatus", () => {
      const sessions = adapter?.getSessions() ?? [];
      vscode.window.showInformationMessage(
        `DebugPilot: ${sessions.length} active session(s) — http://127.0.0.1:${server?.port}/mcp`,
      );
    }),
    sessionManager,
  );

  vscode.window.showInformationMessage(
    `DebugPilot: MCP server running on http://127.0.0.1:${server.port}/mcp`,
  );
}

export async function deactivate(): Promise<void> {
  adapter?.dispose();
  await server?.stop();
  sessionManager?.dispose();
}
