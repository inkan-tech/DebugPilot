import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_EVALUATE } from "../constants.js";

export function registerDebugEvaluate(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.tool(
    TOOL_DEBUG_EVALUATE,
    "Evaluate an expression in the context of a paused frame",
    {
      sessionId: z.string().describe("Debug session ID"),
      expression: z.string().describe("Expression to evaluate"),
      frameId: z.number().optional().describe("Stack frame ID (default: top frame)"),
    },
    async ({ sessionId, expression, frameId }) => {
      try {
        const result = await adapter.evaluate(sessionId, expression, frameId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
