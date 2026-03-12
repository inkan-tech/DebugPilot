import { describe, it, expect } from "vitest";
import type {
  IDebugAdapter,
  SessionInfo,
  DebugState,
  Variable,
  ConsoleMessage,
  BreakpointInfo,
} from "../src/types.js";

function createAdapter(
  overrides: Partial<IDebugAdapter> = {},
): IDebugAdapter {
  return {
    getSessions: () => [],
    getState: async () => ({ paused: false, locals: [], callStack: [] }),
    getVariables: async () => [],
    evaluate: async () => ({ result: "", type: undefined, variableReference: 0 }),
    getConsoleMessages: () => [],
    getBreakpoints: () => [],
    dispose: () => {},
    ...overrides,
  };
}

describe("debug-sessions resource", () => {
  it("returns sessions from adapter", () => {
    const sessions: SessionInfo[] = [
      { id: "s1", name: "Node App", type: "node", status: "running" },
      { id: "s2", name: "Chrome", type: "chrome", status: "paused", pauseReason: "breakpoint" },
    ];
    const adapter = createAdapter({ getSessions: () => sessions });

    const result = adapter.getSessions();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("s1");
    expect(result[1].status).toBe("paused");
  });

  it("returns empty array when no sessions", () => {
    const adapter = createAdapter();
    expect(adapter.getSessions()).toEqual([]);
  });
});

describe("debug-breakpoints resource", () => {
  it("returns breakpoints from adapter", () => {
    const breakpoints: BreakpointInfo[] = [
      { id: "BP#1", file: "app.ts", line: 10, enabled: true },
      { id: "BP#2", file: "util.ts", line: 25, enabled: false, condition: "x > 5" },
    ];
    const adapter = createAdapter({ getBreakpoints: () => breakpoints });

    const result = adapter.getBreakpoints();
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe("app.ts");
    expect(result[1].condition).toBe("x > 5");
  });

  it("returns empty array when no breakpoints", () => {
    const adapter = createAdapter();
    expect(adapter.getBreakpoints()).toEqual([]);
  });
});

describe("debug-console resource", () => {
  it("returns console messages for a session", () => {
    const messages: ConsoleMessage[] = [
      { type: "stdout", text: "Hello", timestamp: "2026-01-01T00:00:00Z" },
      { type: "stderr", text: "Error!", timestamp: "2026-01-01T00:00:01Z" },
    ];
    const adapter = createAdapter({
      getConsoleMessages: (sessionId: string) => {
        if (sessionId === "s1") return messages;
        return [];
      },
    });

    const result = adapter.getConsoleMessages("s1");
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Hello");
    expect(result[1].type).toBe("stderr");
  });

  it("returns empty for unknown session", () => {
    const adapter = createAdapter({
      getConsoleMessages: () => [],
    });
    expect(adapter.getConsoleMessages("unknown")).toEqual([]);
  });

  it("returns different messages per sessionId", () => {
    const adapter = createAdapter({
      getConsoleMessages: (sessionId: string) => {
        if (sessionId === "s1") {
          return [{ type: "stdout" as const, text: "from s1", timestamp: "t1" }];
        }
        if (sessionId === "s2") {
          return [{ type: "stderr" as const, text: "from s2", timestamp: "t2" }];
        }
        return [];
      },
    });

    expect(adapter.getConsoleMessages("s1")[0].text).toBe("from s1");
    expect(adapter.getConsoleMessages("s2")[0].text).toBe("from s2");
    expect(adapter.getConsoleMessages("s3")).toEqual([]);
  });

  it("list callback returns sessions as available resources", () => {
    const sessions: SessionInfo[] = [
      { id: "s1", name: "Node App", type: "node", status: "running" },
      { id: "s2", name: "Chrome", type: "chrome", status: "paused" },
    ];
    const adapter = createAdapter({ getSessions: () => sessions });

    // Simulate what the ResourceTemplate list callback does
    const resources = adapter.getSessions().map((s) => ({
      uri: `debug://console/${s.id}`,
      name: `Console: ${s.name}`,
      description: `Debug console output for session "${s.name}"`,
      mimeType: "application/json",
    }));

    expect(resources).toHaveLength(2);
    expect(resources[0].uri).toBe("debug://console/s1");
    expect(resources[0].name).toBe("Console: Node App");
    expect(resources[1].uri).toBe("debug://console/s2");
  });
});
