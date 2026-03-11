import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

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

export function registerAllTools(
  server: McpServer,
  adapter: IDebugAdapter,
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
}
