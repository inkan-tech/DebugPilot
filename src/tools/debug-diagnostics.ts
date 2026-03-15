import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_DIAGNOSTICS } from "../constants.js";

export function registerDebugDiagnostics(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.tool(
    TOOL_DEBUG_DIAGNOSTICS,
    "Get VS Code diagnostics (linter errors, type errors, warnings) for workspace files. Omit file to get all diagnostics.",
    {
      file: z
        .string()
        .optional()
        .describe("Absolute file path to get diagnostics for. Omit for all workspace files."),
    },
    async ({ file }) => {
      const diagnostics = adapter.getDiagnostics(file);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ diagnostics, count: diagnostics.length }, null, 2),
          },
        ],
      };
    },
  );
}
