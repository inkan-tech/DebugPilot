import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_BREAKPOINT_REMOVE } from "../constants.js";

export function registerDebugBreakpointRemove(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_BREAKPOINT_REMOVE,
    "Remove a breakpoint by ID",
    { id: z.string().describe("Breakpoint ID (e.g. BP#1)") },
    async ({ id }) => {
      await adapter.removeBreakpoint(id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "removed", id }) }] };
    },
  );
}
