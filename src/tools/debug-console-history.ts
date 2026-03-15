import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import { TOOL_DEBUG_CONSOLE_HISTORY } from "../constants.js";

export function registerDebugConsoleHistory(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.tool(
    TOOL_DEBUG_CONSOLE_HISTORY,
    "Get console output from terminated/crashed debug sessions. Use this to investigate crashes after the session has ended. Omit sessionId to list all available history.",
    {
      sessionId: z
        .string()
        .optional()
        .describe("Terminated session ID. Omit to get all available history."),
      pattern: z
        .string()
        .optional()
        .describe("Regex pattern to filter messages (e.g. 'error|Error|FATAL')"),
    },
    async ({ sessionId, pattern }) => {
      const history = adapter.getConsoleHistory(sessionId);

      if (history.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                message: sessionId
                  ? `No history for session ${sessionId}`
                  : "No terminated sessions with console output available",
                hint: "Run a debug session first — console output is preserved after termination (up to 10 sessions)",
              }),
            },
          ],
        };
      }

      // Apply pattern filter if provided
      const filtered = pattern
        ? history.map((h) => ({
            ...h,
            messages: h.messages.filter((m) => new RegExp(pattern).test(m.text)),
          }))
        : history;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              filtered.map((h) => ({
                sessionId: h.sessionId,
                name: h.name,
                type: h.type,
                terminatedAt: h.terminatedAt,
                messageCount: h.messages.length,
                messages: h.messages,
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
