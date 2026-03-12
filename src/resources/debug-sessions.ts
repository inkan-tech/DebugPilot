import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

export function registerDebugSessionsResource(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.resource(
    "debug-sessions",
    "debug://sessions",
    { description: "Live list of active debug sessions" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ sessions: adapter.getSessions() }, null, 2),
        },
      ],
    }),
  );
}
