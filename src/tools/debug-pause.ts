import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_PAUSE } from "../constants.js";

export function registerDebugPause(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_PAUSE,
    "Pause a running debug session",
    { sessionId: z.string().describe("Debug session ID"), threadId: z.number().optional().describe("Thread ID (default: first thread)") },
    async ({ sessionId, threadId }) => {
      await adapter.pause(sessionId, threadId);
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "paused", sessionId }) }] };
    },
  );
}
