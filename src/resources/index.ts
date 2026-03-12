import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

import { registerDebugSessionsResource } from "./debug-sessions.js";
import { registerDebugConsoleResource } from "./debug-console.js";
import { registerDebugBreakpointsResource } from "./debug-breakpoints.js";

export function registerAllResources(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  registerDebugSessionsResource(server, adapter);
  registerDebugConsoleResource(server, adapter);
  registerDebugBreakpointsResource(server, adapter);
}
