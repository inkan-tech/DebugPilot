import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_EXCEPTION_CONFIG } from "../constants.js";

export function registerDebugExceptionConfig(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_EXCEPTION_CONFIG,
    "Configure exception breakpoints (break on caught/uncaught exceptions). Requires a sessionId from debug_sessions",
    {
      sessionId: z.string().describe("Debug session ID (get from debug_sessions)"),
      filters: z.array(z.string()).describe('Exception filter IDs (e.g. ["uncaught", "caught"] for JS/TS, ["raised", "uncaught"] for Python, ["All", "Unhandled"] for Dart/Flutter)'),
    },
    async ({ sessionId, filters }) => {
      try {
        await adapter.setExceptionBreakpoints(sessionId, filters);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "configured", filters }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
          isError: true,
        };
      }
    },
  );
}
