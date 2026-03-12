import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_LAUNCH } from "../constants.js";

export function registerDebugLaunch(server: McpServer, adapter: IDebugAdapter): void {
  server.tool(
    TOOL_DEBUG_LAUNCH,
    "Launch a debug configuration by name. Returns the new sessionId",
    { configuration: z.string().describe("Name of launch configuration from .vscode/launch.json") },
    async ({ configuration }) => {
      const result = await adapter.launch(configuration);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    },
  );
}
