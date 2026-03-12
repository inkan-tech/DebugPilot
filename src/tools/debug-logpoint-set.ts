import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_LOGPOINT_SET } from "../constants.js";

export function registerDebugLogpointSet(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_LOGPOINT_SET,
    "Set a logpoint that logs a message without pausing. Uses {expression} syntax for interpolation",
    {
      file: z.string().describe("Absolute file path"),
      line: z.number().describe("Line number (1-based)"),
      message: z.string().describe("Log message template, use {expr} for interpolation"),
      condition: z.string().optional().describe("Conditional expression"),
    },
    async ({ file, line, message, condition }) => {
      const bp = await adapter.setLogpoint(file, line, message, condition);
      return { content: [{ type: "text" as const, text: JSON.stringify(bp, null, 2) }] };
    },
  );
}
