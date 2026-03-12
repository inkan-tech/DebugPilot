import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

export function registerDebugConsoleResource(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.resource(
    "debug-console",
    new ResourceTemplate("debug://console/{sessionId}", {
      list: async () => ({
        resources: adapter.getSessions().map((s) => ({
          uri: `debug://console/${s.id}`,
          name: `Console: ${s.name}`,
          description: `Debug console output for session "${s.name}"`,
          mimeType: "application/json",
        })),
      }),
    }),
    { description: "Debug console output for a session" },
    async (uri, { sessionId }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              messages: adapter.getConsoleMessages(sessionId as string),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );
}
