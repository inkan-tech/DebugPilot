import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_HOT_RELOAD } from "../constants.js";

export function registerDebugHotReload(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_HOT_RELOAD,
    "Trigger Flutter hot reload — injects code changes into running Dart VM, preserves app state. Requires a sessionId from debug_sessions",
    {
      sessionId: z.string().describe("Debug session ID (get from debug_sessions)"),
      reason: z.enum(["manual", "save"]).optional().describe("Trigger reason (default: manual)"),
    },
    async ({ sessionId, reason }) => {
      try {
        await adapter.customRequest(sessionId, "hotReload", { reason: reason ?? "manual" });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "reloaded", sessionId }) }],
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
