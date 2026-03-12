import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

export function registerDebugInvestigate(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.prompt(
    "debug_investigate",
    "Investigate a paused debug session — gathers state, locals, stack, console output",
    { sessionId: z.string().describe("Debug session ID") },
    async ({ sessionId }) => {
      const state = await adapter.getState(sessionId);
      const consoleMessages = adapter.getConsoleMessages(sessionId);
      const breakpoints = adapter.getBreakpoints();

      const context = [
        "## Debug State",
        JSON.stringify(state, null, 2),
        "",
        "## Recent Console Output",
        consoleMessages
          .slice(-50)
          .map((m) => `[${m.type}] ${m.text}`)
          .join("\n"),
        "",
        "## Breakpoints",
        JSON.stringify(breakpoints, null, 2),
      ].join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `The debugger is paused. Analyze the current state and help identify the bug.\n\n${context}`,
            },
          },
        ],
      };
    },
  );
}
