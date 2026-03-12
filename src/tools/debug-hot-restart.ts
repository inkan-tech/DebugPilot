import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_HOT_RESTART } from "../constants.js";

export function registerDebugHotRestart(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_HOT_RESTART,
    "Trigger Flutter hot restart — full restart with code update, does NOT preserve app state. Requires a sessionId from debug_sessions",
    {
      sessionId: z.string().describe("Debug session ID (get from debug_sessions)"),
      reason: z.enum(["manual", "save"]).optional().describe("Trigger reason (default: manual)"),
    },
    async ({ sessionId, reason }) => {
      try {
        await adapter.customRequest(sessionId, "hotRestart", { reason: reason ?? "manual" });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "restarted", sessionId }) }],
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
