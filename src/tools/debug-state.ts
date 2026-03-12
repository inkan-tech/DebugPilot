import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_STATE } from "../constants.js";

export function registerDebugState(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.tool(
    TOOL_DEBUG_STATE,
    "Get full debug state: pause location, source context, locals, call stack. Requires a sessionId from debug_sessions",
    { sessionId: z.string().describe("Debug session ID (get from debug_sessions)") },
    async ({ sessionId }) => {
      try {
        const state = await adapter.getState(sessionId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(state, null, 2),
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
