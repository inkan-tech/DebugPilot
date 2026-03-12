import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";

export function registerDebugTrace(
  server: McpServer,
  adapter: IDebugAdapter,
): void {
  server.prompt(
    "debug_trace",
    "Explain the current execution state and suggest next debugging steps",
    { sessionId: z.string().describe("Debug session ID") },
    async ({ sessionId }) => {
      const state = await adapter.getState(sessionId);
      const consoleMessages = adapter.getConsoleMessages(sessionId);

      const context = [
        "## Current Location",
        state.location
          ? `${state.location.file}:${state.location.line} in ${state.location.function ?? "unknown"}`
          : "Not paused",
        "",
        "## Source Context",
        state.source?.lines
          .map((l) => `${l.current ? "\u25ba" : " "} ${l.line}: ${l.text}`)
          .join("\n") ?? "N/A",
        "",
        "## Call Stack",
        state.callStack
          .map((f, i) => `${i}: ${f.name} (${f.file}:${f.line})`)
          .join("\n"),
        "",
        "## Local Variables",
        state.locals
          .map((v) => `${v.name}: ${v.value} (${v.type ?? "unknown"})`)
          .join("\n"),
        "",
        "## Recent Console",
        consoleMessages
          .slice(-20)
          .map((m) => `[${m.type}] ${m.text}`)
          .join("\n"),
      ].join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Trace the execution path and suggest next debugging steps.\n\n${context}`,
            },
          },
        ],
      };
    },
  );
}
