import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_VARIABLES } from "../constants.js";

export function registerDebugVariables(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.tool(
    TOOL_DEBUG_VARIABLES,
    "Get variables for a scope or expand an object by variable reference",
    {
      sessionId: z.string().describe("Debug session ID"),
      variableReference: z.number().describe("Variable reference to expand"),
      depth: z.number().optional().describe("Expansion depth (default 1, max 5)"),
    },
    async ({ sessionId, variableReference, depth }) => {
      const variables = await adapter.getVariables(
        sessionId,
        variableReference,
        depth,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ variables }, null, 2),
          },
        ],
      };
    },
  );
}
