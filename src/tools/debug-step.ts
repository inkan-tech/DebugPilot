import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_STEP } from "../constants.js";

export function registerDebugStep(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_STEP,
    "Step over, into, or out in a paused debug session. Requires a sessionId from debug_sessions",
    {
      sessionId: z.string().describe("Debug session ID (get from debug_sessions)"),
      type: z.enum(["over", "into", "out"]).describe("Step type"),
      threadId: z.number().optional().describe("Thread ID (default: first thread)"),
    },
    async ({ sessionId, type, threadId }) => {
      try {
        await adapter.step(sessionId, type, threadId);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "stepped", stepType: type, sessionId }) }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
          isError: true,
        };
      }
    },
  );
}
