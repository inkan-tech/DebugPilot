import { describe, it, expect, vi } from "vitest";
import type {
  IDebugAdapter,
  DebugState,
  ConsoleMessage,
  BreakpointInfo,
} from "../src/types.js";
import { registerDebugInvestigate } from "../src/prompts/debug-investigate.js";
import { registerDebugTrace } from "../src/prompts/debug-trace.js";

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

const mockState: DebugState = {
  paused: true,
  reason: "breakpoint",
  location: {
    file: "/app/src/index.ts",
    line: 42,
    column: 5,
    function: "processData",
  },
  source: {
    lines: [
      { line: 40, text: "  const data = getData();" },
      { line: 41, text: "  const result = transform(data);" },
      { line: 42, text: "  console.log(result);", current: true },
      { line: 43, text: "  return result;" },
      { line: 44, text: "}" },
    ],
    contextLines: 5,
  },
  locals: [
    { name: "data", value: '{"count": 0}', type: "object", variableReference: 10 },
    { name: "result", value: "undefined", type: "undefined", variableReference: 0 },
  ],
  callStack: [
    { id: 1, name: "processData", file: "/app/src/index.ts", line: 42 },
    { id: 2, name: "main", file: "/app/src/index.ts", line: 10 },
  ],
};

const mockConsole: ConsoleMessage[] = [
  { type: "stdout", text: "Starting process...", timestamp: "2026-01-01T00:00:00Z" },
  { type: "stderr", text: "Warning: deprecated API", timestamp: "2026-01-01T00:00:01Z" },
  { type: "console", text: "Debug: entering processData", timestamp: "2026-01-01T00:00:02Z" },
];

const mockBreakpoints: BreakpointInfo[] = [
  { id: "bp1", file: "/app/src/index.ts", line: 42, enabled: true },
  { id: "bp2", file: "/app/src/index.ts", line: 55, enabled: false, condition: "x > 10" },
];

// Helper: capture the prompt handler registered via server.prompt()
function capturePromptHandler() {
  let handler: (...args: unknown[]) => Promise<unknown>;
  const mockServer = {
    prompt: vi.fn((...args: unknown[]) => {
      // The handler is the last argument
      handler = args[args.length - 1] as typeof handler;
    }),
  };
  return {
    mockServer,
    callHandler: (args: Record<string, string>) => handler!(args),
  };
}

describe("debug_investigate prompt", () => {
  it("returns state, console, and breakpoints in prompt message", async () => {
    const adapter = createAdapter({
      getState: vi.fn().mockResolvedValue(mockState),
      getConsoleMessages: vi.fn().mockReturnValue(mockConsole),
      getBreakpoints: vi.fn().mockReturnValue(mockBreakpoints),
    });

    const { mockServer, callHandler } = capturePromptHandler();
    registerDebugInvestigate(mockServer as never, adapter);

    expect(mockServer.prompt).toHaveBeenCalledOnce();
    expect(mockServer.prompt.mock.calls[0][0]).toBe("debug_investigate");

    const result = (await callHandler({ sessionId: "s1" })) as {
      messages: Array<{ role: string; content: { type: string; text: string } }>;
    };

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content.type).toBe("text");

    const text = result.messages[0].content.text;
    expect(text).toContain("The debugger is paused");
    expect(text).toContain("## Debug State");
    expect(text).toContain("processData");
    expect(text).toContain("## Recent Console Output");
    expect(text).toContain("[stdout] Starting process...");
    expect(text).toContain("[stderr] Warning: deprecated API");
    expect(text).toContain("## Breakpoints");
    expect(text).toContain("bp1");
    expect(text).toContain("bp2");

    expect(adapter.getState).toHaveBeenCalledWith("s1");
    expect(adapter.getConsoleMessages).toHaveBeenCalledWith("s1");
    expect(adapter.getBreakpoints).toHaveBeenCalled();
  });

  it("handles empty console and breakpoints", async () => {
    const adapter = createAdapter({
      getState: vi.fn().mockResolvedValue({ paused: false, locals: [], callStack: [] }),
      getConsoleMessages: vi.fn().mockReturnValue([]),
      getBreakpoints: vi.fn().mockReturnValue([]),
    });

    const { mockServer, callHandler } = capturePromptHandler();
    registerDebugInvestigate(mockServer as never, adapter);

    const result = (await callHandler({ sessionId: "s1" })) as {
      messages: Array<{ role: string; content: { type: string; text: string } }>;
    };

    const text = result.messages[0].content.text;
    expect(text).toContain("## Debug State");
    expect(text).toContain("## Recent Console Output");
    expect(text).toContain("## Breakpoints");
  });
});

describe("debug_trace prompt", () => {
  it("returns location, stack, locals, and console in prompt message", async () => {
    const adapter = createAdapter({
      getState: vi.fn().mockResolvedValue(mockState),
      getConsoleMessages: vi.fn().mockReturnValue(mockConsole),
    });

    const { mockServer, callHandler } = capturePromptHandler();
    registerDebugTrace(mockServer as never, adapter);

    expect(mockServer.prompt).toHaveBeenCalledOnce();
    expect(mockServer.prompt.mock.calls[0][0]).toBe("debug_trace");

    const result = (await callHandler({ sessionId: "s1" })) as {
      messages: Array<{ role: string; content: { type: string; text: string } }>;
    };

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content.type).toBe("text");

    const text = result.messages[0].content.text;
    expect(text).toContain("Trace the execution path");
    expect(text).toContain("## Current Location");
    expect(text).toContain("/app/src/index.ts:42 in processData");
    expect(text).toContain("## Source Context");
    expect(text).toContain("\u25ba 42:   console.log(result);");
    expect(text).toContain("## Call Stack");
    expect(text).toContain("0: processData (/app/src/index.ts:42)");
    expect(text).toContain("1: main (/app/src/index.ts:10)");
    expect(text).toContain("## Local Variables");
    expect(text).toContain('data: {"count": 0} (object)');
    expect(text).toContain("result: undefined (undefined)");
    expect(text).toContain("## Recent Console");
    expect(text).toContain("[console] Debug: entering processData");

    expect(adapter.getState).toHaveBeenCalledWith("s1");
    expect(adapter.getConsoleMessages).toHaveBeenCalledWith("s1");
  });

  it("shows 'Not paused' when no location", async () => {
    const adapter = createAdapter({
      getState: vi.fn().mockResolvedValue({ paused: false, locals: [], callStack: [] }),
      getConsoleMessages: vi.fn().mockReturnValue([]),
    });

    const { mockServer, callHandler } = capturePromptHandler();
    registerDebugTrace(mockServer as never, adapter);

    const result = (await callHandler({ sessionId: "s1" })) as {
      messages: Array<{ role: string; content: { type: string; text: string } }>;
    };

    const text = result.messages[0].content.text;
    expect(text).toContain("Not paused");
    expect(text).toContain("N/A");
  });
});
