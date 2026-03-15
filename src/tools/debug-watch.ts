import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDebugAdapter } from "../types.js";
import type { SessionManager } from "../session-manager.js";
import { TOOL_DEBUG_WATCH } from "../constants.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

const ALL_EVENTS = [
  "sessionStarted",
  "sessionTerminated",
  "stopped",
  "continued",
  "diagnosticsChanged",
  "consoleOutput",
] as const;

export function registerDebugWatch(
  server: McpServer,
  _adapter: IDebugAdapter,
  sessionManager: SessionManager,
): void {
  server.tool(
    TOOL_DEBUG_WATCH,
    "Block until a debug event occurs (breakpoint hit, exception, session start/stop). Use this to wait for the debugger to pause instead of polling.",
    {
      timeout_ms: z
        .number()
        .min(1000)
        .max(MAX_TIMEOUT_MS)
        .optional()
        .describe(`Timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}, max ${MAX_TIMEOUT_MS})`),
      events: z
        .array(z.string())
        .optional()
        .describe('Event types to watch: "stopped", "continued", "sessionStarted", "sessionTerminated", "diagnosticsChanged", "consoleOutput", or ["*"] for all'),
    },
    async ({ timeout_ms, events }) => {
      const timeout = Math.min(timeout_ms ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
      const filter = events ?? ["*"];
      const watchAll = filter.includes("*");

      const watchedEvents = watchAll
        ? [...ALL_EVENTS]
        : ALL_EVENTS.filter((e) => filter.includes(e));

      if (watchedEvents.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "No valid event types specified", validEvents: [...ALL_EVENTS] }),
            },
          ],
        };
      }

      return new Promise((resolve) => {
        const emitter = sessionManager.events;
        let resolved = false;

        const handlers: Array<{ event: string; handler: (...args: any[]) => void }> = [];

        const cleanup = () => {
          clearTimeout(timer);
          for (const { event, handler } of handlers) {
            emitter.off(event, handler);
          }
        };

        for (const evt of watchedEvents) {
          const handler = (data: Record<string, unknown>) => {
            if (resolved) return;
            resolved = true;
            cleanup();
            resolve({
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    event: evt,
                    timestamp: new Date().toISOString(),
                    data,
                  }),
                },
              ],
            });
          };
          handlers.push({ event: evt, handler });
          emitter.on(evt, handler);
        }

        const timer = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          for (const { event, handler } of handlers) {
            emitter.off(event, handler);
          }
          resolve({
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ timeout: true, waited_ms: timeout }),
              },
            ],
          });
        }, timeout);
      });
    },
  );
}
