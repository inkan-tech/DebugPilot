import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_CONTINUE } from "../constants.js";

export function registerDebugContinue(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_CONTINUE,
    "Resume execution of a paused debug session",
    { sessionId: z.string().describe("Debug session ID"), threadId: z.number().optional().describe("Thread ID (default: first thread)") },
    async ({ sessionId, threadId }) => {
      await adapter.continue(sessionId, threadId);
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "continued", sessionId }) }] };
    },
  );
}
