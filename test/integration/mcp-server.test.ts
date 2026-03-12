import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { IDebugAdapter } from "../../src/types.js";
import type { DebugMcpServer } from "../../src/server.js";
import {
  createMockAdapter,
  startTestServer,
  mcpRequest,
  httpRequest,
} from "./helpers.js";

describe("MCP server integration", () => {
  let adapter: IDebugAdapter;
  let server: DebugMcpServer;
  let port: number;
  let cleanup: () => Promise<void>;
  let sessionId: string | undefined;

  beforeAll(async () => {
    adapter = createMockAdapter();
    const result = await startTestServer(adapter);
    port = result.port;
    server = result.server;
    cleanup = result.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("health endpoint", () => {
    it("GET /health returns 200 with status ok", async () => {
      const res = await httpRequest(port, "GET", "/health");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "ok",
        name: "debugpilot",
      });
    });
  });

  describe("404 for unknown routes", () => {
    it("returns 404 for unknown path", async () => {
      const res = await httpRequest(port, "GET", "/unknown");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "not_found" });
    });
  });

  describe("MCP protocol over HTTP", () => {
    it("initialize handshake succeeds", async () => {
      const res = await mcpRequest(port, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      });

      expect(res.status).toBe(200);

      // Response may be JSON-RPC directly or SSE events
      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.protocolVersion).toBeDefined();
      expect(result.capabilities).toBeDefined();
      expect(result.serverInfo).toBeDefined();
      expect(result.serverInfo.name).toBe("debugpilot");

      // Capture session ID for subsequent requests
      sessionId =
        (res.headers["mcp-session-id"] as string) ?? undefined;
    });

    it("tools/list returns all registered tools", async () => {
      const res = await mcpRequest(
        port,
        "tools/list",
        {},
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);

      const toolNames = result.tools.map((t: { name: string }) => t.name);

      // Verify Phase 1 tools
      expect(toolNames).toContain("debug_sessions");
      expect(toolNames).toContain("debug_state");
      expect(toolNames).toContain("debug_variables");
      expect(toolNames).toContain("debug_evaluate");
      expect(toolNames).toContain("debug_console");
      expect(toolNames).toContain("debug_breakpoints_list");

      // Verify Phase 2 tools
      expect(toolNames).toContain("debug_continue");
      expect(toolNames).toContain("debug_step");
      expect(toolNames).toContain("debug_pause");
      expect(toolNames).toContain("debug_breakpoint_set");
      expect(toolNames).toContain("debug_breakpoint_remove");
      expect(toolNames).toContain("debug_exception_config");

      // At least 12 tools (Phase 1 + Phase 2)
      expect(result.tools.length).toBeGreaterThanOrEqual(12);
    });

    it("tools/call debug_sessions returns mock sessions", async () => {
      const res = await mcpRequest(
        port,
        "tools/call",
        { name: "debug_sessions", arguments: {} },
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);

      // The tool returns JSON-stringified sessions
      const text = result.content[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.sessions).toHaveLength(2);
      expect(parsed.sessions[0].id).toBe("session-1");
      expect(parsed.sessions[0].name).toBe("Node Debug");
      expect(parsed.sessions[1].id).toBe("session-2");
      expect(parsed.sessions[1].name).toBe("Chrome Debug");
    });

    it("tools/call debug_breakpoints_list returns mock breakpoints", async () => {
      const res = await mcpRequest(
        port,
        "tools/call",
        { name: "debug_breakpoints_list", arguments: {} },
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      const text = result.content[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.breakpoints).toHaveLength(3);
      expect(parsed.breakpoints[0].id).toBe("BP#1");
      expect(parsed.breakpoints[1].condition).toBe("count > 5");
      expect(parsed.breakpoints[2].enabled).toBe(false);
    });
  });
});

/**
 * Extract the JSON-RPC result from response body.
 * Handles both direct JSON-RPC responses and SSE event arrays.
 */
function extractResult(body: unknown): any {
  // Direct JSON-RPC response
  if (body && typeof body === "object" && "result" in (body as any)) {
    return (body as any).result;
  }

  // SSE events array — find the one with a result
  if (Array.isArray(body)) {
    for (const event of body) {
      if (event && typeof event === "object" && "result" in event) {
        return event.result;
      }
    }
  }

  return undefined;
}
