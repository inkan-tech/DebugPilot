import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_RUN_TO } from "../constants.js";

export function registerDebugRunTo(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_RUN_TO,
    "Run to a specific line by setting a temporary breakpoint and continuing. Requires a sessionId from debug_sessions",
    {
      sessionId: z.string().describe("Debug session ID (get from debug_sessions)"),
      file: z.string().describe("Absolute file path"),
      line: z.number().describe("Line number (1-based)"),
    },
    async ({ sessionId, file, line }) => {
      await adapter.runTo(sessionId, file, line);
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "running_to", file, line, sessionId }) }] };
    },
  );
}
