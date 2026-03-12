import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_CONSOLE } from "../constants.js";

export function registerDebugConsole(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.tool(
    TOOL_DEBUG_CONSOLE,
    "Read buffered debug console output (stdout, stderr, console.log). Requires a sessionId from debug_sessions",
    {
      sessionId: z.string().describe("Debug session ID (get from debug_sessions)"),
      since: z.string().optional().describe("ISO timestamp to filter messages after"),
      pattern: z.string().optional().describe("Regex pattern to filter messages"),
    },
    async ({ sessionId, since, pattern }) => {
      try {
        const messages = adapter.getConsoleMessages(sessionId, since, pattern);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ messages }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
