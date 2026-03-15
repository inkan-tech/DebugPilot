import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import type { SessionManager } from "../session-manager.js";

import { registerDebugSessions } from "./debug-sessions.js";
import { registerDebugState } from "./debug-state.js";
import { registerDebugVariables } from "./debug-variables.js";
import { registerDebugEvaluate } from "./debug-evaluate.js";
import { registerDebugConsole } from "./debug-console.js";
import { registerDebugBreakpointsList } from "./debug-breakpoints-list.js";
import { registerDebugContinue } from "./debug-continue.js";
import { registerDebugStep } from "./debug-step.js";
import { registerDebugPause } from "./debug-pause.js";
import { registerDebugBreakpointSet } from "./debug-breakpoint-set.js";
import { registerDebugBreakpointRemove } from "./debug-breakpoint-remove.js";
import { registerDebugExceptionConfig } from "./debug-exception-config.js";
import { registerDebugLaunch } from "./debug-launch.js";
import { registerDebugStop } from "./debug-stop.js";
import { registerDebugLogpointSet } from "./debug-logpoint-set.js";
import { registerDebugRunTo } from "./debug-run-to.js";
import { registerDebugHotReload } from "./debug-hot-reload.js";
import { registerDebugHotRestart } from "./debug-hot-restart.js";
import { registerDebugWatch } from "./debug-watch.js";
import { registerDebugDiagnostics } from "./debug-diagnostics.js";
import { registerDebugConsoleHistory } from "./debug-console-history.js";

export function registerAllTools(
  server: McpServer,
  adapter: IDebugAdapter,
  sessionManager?: SessionManager,
): void {
  registerDebugSessions(server, adapter);
  registerDebugState(server, adapter);
  registerDebugVariables(server, adapter);
  registerDebugEvaluate(server, adapter);
  registerDebugConsole(server, adapter);
  registerDebugBreakpointsList(server, adapter);
  registerDebugContinue(server, adapter);
  registerDebugStep(server, adapter);
  registerDebugPause(server, adapter);
  registerDebugBreakpointSet(server, adapter);
  registerDebugBreakpointRemove(server, adapter);
  registerDebugExceptionConfig(server, adapter);
  registerDebugLaunch(server, adapter);
  registerDebugStop(server, adapter);
  registerDebugLogpointSet(server, adapter);
  registerDebugRunTo(server, adapter);
  registerDebugHotReload(server, adapter);
  registerDebugHotRestart(server, adapter);
  registerDebugDiagnostics(server, adapter);
  registerDebugConsoleHistory(server, adapter);
  if (sessionManager) {
    registerDebugWatch(server, adapter, sessionManager);
  }
}
