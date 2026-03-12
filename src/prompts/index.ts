import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

import { registerDebugInvestigate } from "./debug-investigate.js";
import { registerDebugTrace } from "./debug-trace.js";

export function registerAllPrompts(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  registerDebugInvestigate(server, adapter);
  registerDebugTrace(server, adapter);
}
