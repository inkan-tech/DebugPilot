import * as http from "node:http";
import { vi } from "vitest";
import type { IDebugAdapter } from "../../src/types.js";
import { DebugMcpServer } from "../../src/server.js";

/**
 * Create a full IDebugAdapter mock with realistic data.
 */
export function createMockAdapter(
  overrides: Partial<IDebugAdapter> = {},
): IDebugAdapter {
  return {
    getSessions: vi.fn().mockReturnValue([
      {
        id: "session-1",
        name: "Node Debug",
        type: "node",
        status: "paused",
        pauseReason: "breakpoint",
        pauseLocation: {
          file: "/workspace/src/index.ts",
          line: 42,
          column: 5,
          function: "handleRequest",
        },
      },
      {
        id: "session-2",
        name: "Chrome Debug",
        type: "chrome",
        status: "running",
      },
    ]),
    getState: vi.fn().mockResolvedValue({
      paused: true,
      reason: "breakpoint",
      location: {
        file: "/workspace/src/index.ts",
        line: 42,
        column: 5,
        function: "handleRequest",
      },
      source: {
        lines: [
          { line: 40, text: "async function handleRequest(req) {" },
          { line: 41, text: "  const data = await parse(req);" },
          { line: 42, text: "  const result = process(data);", current: true },
          { line: 43, text: "  return result;" },
          { line: 44, text: "}" },
        ],
        contextLines: 2,
      },
      locals: [
        { name: "req", value: "IncomingMessage", type: "object", variableReference: 10 },
        { name: "data", value: '{"id": 1}', type: "object", variableReference: 11 },
      ],
      callStack: [
        { id: 0, name: "handleRequest", file: "/workspace/src/index.ts", line: 42, column: 5 },
        { id: 1, name: "router", file: "/workspace/src/router.ts", line: 15 },
      ],
    }),
    getVariables: vi.fn().mockResolvedValue([
      { name: "req", value: "IncomingMessage", type: "object", variableReference: 10 },
      { name: "data", value: '{"id": 1}', type: "object", variableReference: 11 },
    ]),
    evaluate: vi.fn().mockResolvedValue({
      result: "42",
      type: "number",
      variableReference: 0,
    }),
    getConsoleMessages: vi.fn().mockReturnValue([
      { type: "stdout", text: "Server started on port 3000", timestamp: "2026-01-01T00:00:00Z" },
      { type: "stderr", text: "Warning: deprecated API", timestamp: "2026-01-01T00:00:01Z" },
    ]),
    getBreakpoints: vi.fn().mockReturnValue([
      { id: "BP#1", file: "/workspace/src/index.ts", line: 42, enabled: true },
      { id: "BP#2", file: "/workspace/src/router.ts", line: 15, enabled: true, condition: "count > 5" },
      { id: "BP#3", file: "/workspace/src/utils.ts", line: 8, enabled: false },
    ]),
    continue: vi.fn().mockResolvedValue(undefined),
    step: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    setBreakpoint: vi.fn().mockResolvedValue({
      id: "BP#4",
      file: "/workspace/src/index.ts",
      line: 50,
      enabled: true,
    }),
    removeBreakpoint: vi.fn().mockResolvedValue(undefined),
    setExceptionBreakpoints: vi.fn().mockResolvedValue(undefined),
    launch: vi.fn().mockResolvedValue({ sessionId: "session-new", status: "launched" }),
    stop: vi.fn().mockResolvedValue(undefined),
    setLogpoint: vi.fn().mockResolvedValue({
      id: "BP#5",
      file: "/workspace/src/index.ts",
      line: 60,
      enabled: true,
    }),
    runTo: vi.fn().mockResolvedValue(undefined),
    customRequest: vi.fn().mockResolvedValue({ success: true }),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

/**
 * Start a DebugMcpServer on a random available port.
 */
export async function startTestServer(
  adapter: IDebugAdapter,
): Promise<{ port: number; server: DebugMcpServer; cleanup: () => Promise<void> }> {
  const server = new DebugMcpServer(adapter);
  // Port 0 tells the OS to pick a random available port
  await server.start(0);
  const port = server.port;
  return {
    port,
    server,
    cleanup: () => server.stop(),
  };
}

/**
 * Make a JSON-RPC 2.0 request to the MCP endpoint.
 */
export async function mcpRequest(
  port: number,
  method: string,
  params: Record<string, unknown> = {},
  sessionId?: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: unknown }> {
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 100000),
    method,
    params,
  });

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk;
        });
        res.on("end", () => {
          let body: unknown;
          try {
            // MCP Streamable HTTP may return SSE or JSON
            // Try JSON first
            body = JSON.parse(data);
          } catch {
            // Parse SSE events
            body = parseSSE(data);
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Make a simple HTTP request (GET, POST, etc.) to any path.
 */
export async function httpRequest(
  port: number,
  method: string,
  path: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path, method },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk;
        });
        res.on("end", () => {
          let body: unknown;
          try {
            body = JSON.parse(data);
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Parse Server-Sent Events data into an array of parsed JSON messages.
 */
function parseSSE(data: string): unknown[] {
  const events: unknown[] = [];
  const lines = data.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        events.push(JSON.parse(line.slice(6)));
      } catch {
        events.push(line.slice(6));
      }
    }
  }
  return events;
}
