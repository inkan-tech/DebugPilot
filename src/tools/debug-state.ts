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
    "Get full debug state: pause location, source context, locals, call stack",
    { sessionId: z.string().describe("Debug session ID") },
    async ({ sessionId }) => {
      const state = await adapter.getState(sessionId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(state, null, 2),
          },
        ],
      };
    },
  );
}
