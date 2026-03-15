import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

export function registerDebugDiagnosticsResource(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.resource(
    "debug-diagnostics",
    "debug://diagnostics",
    { description: "VS Code diagnostics (linter/type errors) for all workspace files" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ diagnostics: adapter.getDiagnostics() }, null, 2),
        },
      ],
    }),
  );
}
