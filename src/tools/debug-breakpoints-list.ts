import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_BREAKPOINTS_LIST } from "../constants.js";

export function registerDebugBreakpointsList(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.tool(
    TOOL_DEBUG_BREAKPOINTS_LIST,
    "List all breakpoints",
    {},
    async () => {
      const breakpoints = adapter.getBreakpoints();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ breakpoints }, null, 2),
          },
        ],
      };
    },
  );
}
