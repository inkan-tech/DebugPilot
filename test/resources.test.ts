import { describe, it, expect, vi } from "vitest";
import type {
  IDebugAdapter,
  SessionInfo,
  ConsoleMessage,
  BreakpointInfo,
} from "../src/types.js";
import { registerDebugSessionsResource } from "../src/resources/debug-sessions.js";
import { registerDebugConsoleResource } from "../src/resources/debug-console.js";
import { registerDebugBreakpointsResource } from "../src/resources/debug-breakpoints.js";

function createAdapter(overrides: Partial<IDebugAdapter> = {}): IDebugAdapter {
  return {
    getSessions: vi.fn().mockReturnValue([]),
    getState: vi.fn().mockResolvedValue({ paused: false, locals: [], callStack: [] }),
    getVariables: vi.fn(),
    evaluate: vi.fn(),
    getConsoleMessages: vi.fn().mockReturnValue([]),
    getBreakpoints: vi.fn().mockReturnValue([]),
    continue: vi.fn(),
    step: vi.fn(),
    pause: vi.fn(),
    setBreakpoint: vi.fn(),
    removeBreakpoint: vi.fn(),
    setExceptionBreakpoints: vi.fn(),
    launch: vi.fn(),
    stop: vi.fn(),
    setLogpoint: vi.fn(),
    runTo: vi.fn(),
    customRequest: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

// Captures the handler and (for ResourceTemplate) the list callback registered via server.resource()
function captureResourceHandler() {
  let handler: (...args: unknown[]) => Promise<unknown>;
  let listCallback: (() => Promise<unknown>) | undefined;

  const mockServer = {
    resource: vi.fn((...args: unknown[]) => {
      // handler is always the last argument
      handler = args[args.length - 1] as typeof handler;

      // The second arg may be a ResourceTemplate with a listCallback getter
      const secondArg = args[1] as { listCallback?: () => Promise<unknown> } | undefined;
      if (secondArg && typeof secondArg === "object" && typeof secondArg.listCallback === "function") {
        listCallback = secondArg.listCallback as typeof listCallback;
      }
    }),
  };

  return {
    mockServer,
    callHandler: (...args: unknown[]) => handler!(...args),
    getListCallback: () => listCallback,
  };
}

describe("debug-sessions resource", () => {
  it("registers with correct name and uri", () => {
    const adapter = createAdapter();
    const { mockServer } = captureResourceHandler();
    registerDebugSessionsResource(mockServer as never, adapter);

    expect(mockServer.resource).toHaveBeenCalledOnce();
    expect(mockServer.resource.mock.calls[0][0]).toBe("debug-sessions");
    expect(mockServer.resource.mock.calls[0][1]).toBe("debug://sessions");
  });

  it("handler returns sessions as JSON", async () => {
    const sessions: SessionInfo[] = [
      { id: "s1", name: "Node App", type: "node", status: "running" },
      { id: "s2", name: "Chrome", type: "chrome", status: "paused", pauseReason: "breakpoint" },
    ];
    const adapter = createAdapter({ getSessions: vi.fn().mockReturnValue(sessions) });

    const { mockServer, callHandler } = captureResourceHandler();
    registerDebugSessionsResource(mockServer as never, adapter);

    const result = (await callHandler(new URL("debug://sessions"))) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe("debug://sessions");
    expect(result.contents[0].mimeType).toBe("application/json");

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.sessions).toHaveLength(2);
    expect(parsed.sessions[0].id).toBe("s1");
    expect(parsed.sessions[1].status).toBe("paused");
  });

  it("handler returns empty sessions array when no sessions", async () => {
    const adapter = createAdapter();
    const { mockServer, callHandler } = captureResourceHandler();
    registerDebugSessionsResource(mockServer as never, adapter);

    const result = (await callHandler(new URL("debug://sessions"))) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.sessions).toEqual([]);
  });
});

describe("debug-breakpoints resource", () => {
  it("registers with correct name and uri", () => {
    const adapter = createAdapter();
    const { mockServer } = captureResourceHandler();
    registerDebugBreakpointsResource(mockServer as never, adapter);

    expect(mockServer.resource).toHaveBeenCalledOnce();
    expect(mockServer.resource.mock.calls[0][0]).toBe("debug-breakpoints");
    expect(mockServer.resource.mock.calls[0][1]).toBe("debug://breakpoints");
  });

  it("handler returns breakpoints as JSON", async () => {
    const breakpoints: BreakpointInfo[] = [
      { id: "BP#1", file: "app.ts", line: 10, enabled: true },
      { id: "BP#2", file: "util.ts", line: 25, enabled: false, condition: "x > 5" },
    ];
    const adapter = createAdapter({ getBreakpoints: vi.fn().mockReturnValue(breakpoints) });

    const { mockServer, callHandler } = captureResourceHandler();
    registerDebugBreakpointsResource(mockServer as never, adapter);

    const result = (await callHandler(new URL("debug://breakpoints"))) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe("debug://breakpoints");
    expect(result.contents[0].mimeType).toBe("application/json");

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.breakpoints).toHaveLength(2);
    expect(parsed.breakpoints[0].file).toBe("app.ts");
    expect(parsed.breakpoints[1].condition).toBe("x > 5");
  });

  it("handler returns empty array when no breakpoints", async () => {
    const adapter = createAdapter();
    const { mockServer, callHandler } = captureResourceHandler();
    registerDebugBreakpointsResource(mockServer as never, adapter);

    const result = (await callHandler(new URL("debug://breakpoints"))) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.breakpoints).toEqual([]);
  });
});

describe("debug-console resource", () => {
  it("registers with correct name and a ResourceTemplate", () => {
    const adapter = createAdapter();
    const { mockServer } = captureResourceHandler();
    registerDebugConsoleResource(mockServer as never, adapter);

    expect(mockServer.resource).toHaveBeenCalledOnce();
    expect(mockServer.resource.mock.calls[0][0]).toBe("debug-console");
    // Second arg is a ResourceTemplate object (not a plain string)
    const secondArg = mockServer.resource.mock.calls[0][1];
    expect(typeof secondArg).toBe("object");
  });

  it("handler returns console messages as JSON for a given sessionId", async () => {
    const messages: ConsoleMessage[] = [
      { type: "stdout", text: "Hello", timestamp: "2026-01-01T00:00:00Z" },
      { type: "stderr", text: "Error!", timestamp: "2026-01-01T00:00:01Z" },
    ];
    const adapter = createAdapter({
      getConsoleMessages: vi.fn().mockReturnValue(messages),
    });

    const { mockServer, callHandler } = captureResourceHandler();
    registerDebugConsoleResource(mockServer as never, adapter);

    const result = (await callHandler(
      new URL("debug://console/s1"),
      { sessionId: "s1" },
    )) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe("debug://console/s1");
    expect(result.contents[0].mimeType).toBe("application/json");

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0].text).toBe("Hello");
    expect(parsed.messages[1].type).toBe("stderr");

    expect(adapter.getConsoleMessages).toHaveBeenCalledWith("s1");
  });

  it("handler returns empty messages for unknown session", async () => {
    const adapter = createAdapter({
      getConsoleMessages: vi.fn().mockReturnValue([]),
    });

    const { mockServer, callHandler } = captureResourceHandler();
    registerDebugConsoleResource(mockServer as never, adapter);

    const result = (await callHandler(
      new URL("debug://console/unknown"),
      { sessionId: "unknown" },
    )) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };

    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.messages).toEqual([]);
  });

  it("list callback returns sessions as available console resources", async () => {
    const sessions: SessionInfo[] = [
      { id: "s1", name: "Node App", type: "node", status: "running" },
      { id: "s2", name: "Chrome", type: "chrome", status: "paused" },
    ];
    const adapter = createAdapter({ getSessions: vi.fn().mockReturnValue(sessions) });

    const { mockServer, getListCallback } = captureResourceHandler();
    registerDebugConsoleResource(mockServer as never, adapter);

    const listCb = getListCallback();
    expect(listCb).toBeDefined();

    const listResult = (await listCb!()) as {
      resources: Array<{ uri: string; name: string; description: string; mimeType: string }>;
    };

    expect(listResult.resources).toHaveLength(2);
    expect(listResult.resources[0].uri).toBe("debug://console/s1");
    expect(listResult.resources[0].name).toBe("Console: Node App");
    expect(listResult.resources[0].mimeType).toBe("application/json");
    expect(listResult.resources[1].uri).toBe("debug://console/s2");
    expect(listResult.resources[1].name).toBe("Console: Chrome");
  });

  it("list callback returns empty when no sessions", async () => {
    const adapter = createAdapter();

    const { mockServer, getListCallback } = captureResourceHandler();
    registerDebugConsoleResource(mockServer as never, adapter);

    const listResult = (await getListCallback()!()) as {
      resources: Array<{ uri: string; name: string }>;
    };

    expect(listResult.resources).toEqual([]);
  });
});
