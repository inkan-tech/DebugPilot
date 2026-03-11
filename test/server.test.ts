import { describe, it, expect } from "vitest";
import type {
  IDebugAdapter,
  SessionInfo,
  DebugState,
  Variable,
  ConsoleMessage,
  BreakpointInfo,
} from "../src/types.js";

// Simple mock adapter for testing
function createMockAdapter(): IDebugAdapter {
  return {
    getSessions(): SessionInfo[] {
      return [
        {
          id: "test-1",
          name: "Test Session",
          type: "node",
          status: "paused",
          pauseReason: "breakpoint",
        },
      ];
    },
    async getState(_sessionId: string): Promise<DebugState> {
      return {
        paused: true,
        reason: "breakpoint",
        location: { file: "test.ts", line: 10 },
        locals: [
          { name: "x", value: "42", type: "number", variableReference: 0 },
        ],
        callStack: [{ id: 0, name: "main", file: "test.ts", line: 10 }],
      };
    },
    async getVariables(): Promise<Variable[]> {
      return [
        { name: "x", value: "42", type: "number", variableReference: 0 },
      ];
    },
    async evaluate() {
      return { result: "42", type: "number", variableReference: 0 };
    },
    getConsoleMessages(): ConsoleMessage[] {
      return [
        {
          type: "stdout",
          text: "hello",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ];
    },
    getBreakpoints(): BreakpointInfo[] {
      return [
        {
          id: "BP#1",
          file: "test.ts",
          line: 10,
          enabled: true,
        },
      ];
    },
    dispose() {},
  };
}

describe("IDebugAdapter mock", () => {
  it("returns sessions", () => {
    const adapter = createMockAdapter();
    const sessions = adapter.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toBe("Test Session");
  });

  it("returns debug state", async () => {
    const adapter = createMockAdapter();
    const state = await adapter.getState("test-1");
    expect(state.paused).toBe(true);
    expect(state.locals).toHaveLength(1);
  });

  it("evaluates expressions", async () => {
    const adapter = createMockAdapter();
    const result = await adapter.evaluate("test-1", "1+1");
    expect(result.result).toBe("42");
  });

  it("returns breakpoints", () => {
    const adapter = createMockAdapter();
    const bps = adapter.getBreakpoints();
    expect(bps).toHaveLength(1);
    expect(bps[0].file).toBe("test.ts");
  });
});
