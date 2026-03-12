import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_STOP } from "../constants.js";

export function registerDebugStop(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_STOP,
    "Stop a debug session. Requires a sessionId from debug_sessions",
    { sessionId: z.string().describe("Debug session ID (get from debug_sessions)") },
    async ({ sessionId }) => {
      await adapter.stop(sessionId);
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "stopped", sessionId }) }] };
    },
  );
}
