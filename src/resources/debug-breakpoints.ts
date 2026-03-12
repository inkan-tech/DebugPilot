import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

export function registerDebugBreakpointsResource(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.resource(
    "debug-breakpoints",
    "debug://breakpoints",
    { description: "Current breakpoint list" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { breakpoints: adapter.getBreakpoints() },
            null,
            2,
          ),
        },
      ],
    }),
  );
}
