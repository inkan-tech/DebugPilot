import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_BREAKPOINT_SET } from "../constants.js";

export function registerDebugBreakpointSet(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_BREAKPOINT_SET,
    "Set a breakpoint at a file and line",
    {
      file: z.string().describe("Absolute file path"),
      line: z.number().describe("Line number (1-based)"),
      condition: z.string().optional().describe("Conditional expression"),
      logMessage: z.string().optional().describe("Log message (logpoint) — uses {expr} for interpolation"),
    },
    async ({ file, line, condition, logMessage }) => {
      const bp = await adapter.setBreakpoint(file, line, condition, logMessage);
      return { content: [{ type: "text" as const, text: JSON.stringify(bp, null, 2) }] };
    },
  );
}
