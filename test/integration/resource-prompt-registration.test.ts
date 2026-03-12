import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { IDebugAdapter } from "../../src/types.js";
import type { DebugMcpServer } from "../../src/server.js";
import { createMockAdapter, startTestServer, mcpRequest } from "./helpers.js";

describe("MCP resources and prompts integration", () => {
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

    // Initialize the MCP session first
    const res = await mcpRequest(port, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    sessionId =
      (res.headers["mcp-session-id"] as string) ?? undefined;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("resources/list", () => {
    it("returns all registered resources", async () => {
      const res = await mcpRequest(
        port,
        "resources/list",
        {},
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.resources).toBeDefined();
      expect(Array.isArray(result.resources)).toBe(true);

      const resourceUris = result.resources.map(
        (r: { uri: string }) => r.uri,
      );

      // Static resources
      expect(resourceUris).toContain("debug://sessions");
      expect(resourceUris).toContain("debug://breakpoints");
    });

    it("returns resource templates for parameterized resources", async () => {
      const res = await mcpRequest(
        port,
        "resources/templates/list",
        {},
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.resourceTemplates).toBeDefined();
      expect(Array.isArray(result.resourceTemplates)).toBe(true);

      const templateUris = result.resourceTemplates.map(
        (t: { uriTemplate: string }) => t.uriTemplate,
      );

      expect(templateUris).toContain("debug://console/{sessionId}");
    });
  });

  describe("resources/read", () => {
    it("reads debug://sessions and returns session data", async () => {
      const res = await mcpRequest(
        port,
        "resources/read",
        { uri: "debug://sessions" },
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const content = result.contents[0];
      expect(content.uri).toBe("debug://sessions");
      expect(content.mimeType).toBe("application/json");

      const parsed = JSON.parse(content.text);
      expect(parsed.sessions).toHaveLength(2);
      expect(parsed.sessions[0].id).toBe("session-1");
      expect(parsed.sessions[0].name).toBe("Node Debug");
      expect(parsed.sessions[1].id).toBe("session-2");
      expect(parsed.sessions[1].name).toBe("Chrome Debug");
    });

    it("reads debug://breakpoints and returns breakpoint data", async () => {
      const res = await mcpRequest(
        port,
        "resources/read",
        { uri: "debug://breakpoints" },
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();

      const content = result.contents[0];
      expect(content.uri).toBe("debug://breakpoints");
      expect(content.mimeType).toBe("application/json");

      const parsed = JSON.parse(content.text);
      expect(parsed.breakpoints).toHaveLength(3);
      expect(parsed.breakpoints[0].id).toBe("BP#1");
    });

    it("reads debug://console/{sessionId} with template parameter", async () => {
      const res = await mcpRequest(
        port,
        "resources/read",
        { uri: "debug://console/session-1" },
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();

      const content = result.contents[0];
      expect(content.uri).toBe("debug://console/session-1");
      expect(content.mimeType).toBe("application/json");

      const parsed = JSON.parse(content.text);
      expect(parsed.messages).toBeDefined();
      expect(Array.isArray(parsed.messages)).toBe(true);
    });
  });

  describe("prompts/list", () => {
    it("returns all registered prompts", async () => {
      const res = await mcpRequest(
        port,
        "prompts/list",
        {},
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.prompts).toBeDefined();
      expect(Array.isArray(result.prompts)).toBe(true);

      const promptNames = result.prompts.map(
        (p: { name: string }) => p.name,
      );

      expect(promptNames).toContain("debug_investigate");
      expect(promptNames).toContain("debug_trace");
      expect(result.prompts).toHaveLength(2);
    });

    it("prompts have descriptions and argument definitions", async () => {
      const res = await mcpRequest(
        port,
        "prompts/list",
        {},
        sessionId,
      );

      const result = extractResult(res.body);
      for (const prompt of result.prompts) {
        expect(prompt.description).toBeDefined();
        expect(typeof prompt.description).toBe("string");
        expect(prompt.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("prompts/get", () => {
    it("gets debug_investigate prompt with session data", async () => {
      const res = await mcpRequest(
        port,
        "prompts/get",
        { name: "debug_investigate", arguments: { sessionId: "session-1" } },
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);

      const message = result.messages[0];
      expect(message.role).toBe("user");
      expect(message.content.type).toBe("text");
      expect(message.content.text).toContain("debugger is paused");
      expect(message.content.text).toContain("Debug State");
      expect(message.content.text).toContain("Console Output");
      expect(message.content.text).toContain("Breakpoints");
    });

    it("gets debug_trace prompt with execution context", async () => {
      const res = await mcpRequest(
        port,
        "prompts/get",
        { name: "debug_trace", arguments: { sessionId: "session-1" } },
        sessionId,
      );

      expect(res.status).toBe(200);

      const result = extractResult(res.body);
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      const message = result.messages[0];
      expect(message.role).toBe("user");
      expect(message.content.type).toBe("text");
      expect(message.content.text).toContain("Trace the execution path");
      expect(message.content.text).toContain("Current Location");
      expect(message.content.text).toContain("Call Stack");
      expect(message.content.text).toContain("Local Variables");
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
