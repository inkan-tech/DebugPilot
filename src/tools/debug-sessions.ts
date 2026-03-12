import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_SESSIONS } from "../constants.js";

export function registerDebugSessions(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.tool(TOOL_DEBUG_SESSIONS, "List active debug sessions — call this FIRST to get sessionId values needed by all other debug tools", {}, async () => {
    const sessions = adapter.getSessions();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ sessions }, null, 2),
        },
      ],
    };
  });
}
