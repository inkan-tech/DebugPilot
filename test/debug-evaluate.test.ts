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

describe("debug_evaluate error handling", () => {
  it("throws when session is not found", async () => {
    const adapter = createAdapter({
      async evaluate(sessionId: string) {
        throw new Error(`Session ${sessionId} not found`);
      },
    });

    await expect(adapter.evaluate("missing", "1+1")).rejects.toThrow(
      "Session missing not found",
    );
  });

  it("propagates expression evaluation errors", async () => {
    const adapter = createAdapter({
      async evaluate() {
        throw new Error("Cannot read properties of undefined");
      },
    });

    await expect(adapter.evaluate("s1", "foo.bar")).rejects.toThrow(
      "Cannot read properties of undefined",
    );
  });

  it("returns result with type and variableReference", async () => {
    const adapter = createAdapter({
      async evaluate() {
        return { result: "42", type: "number", variableReference: 0 };
      },
    });

    const result = await adapter.evaluate("s1", "1+1");
    expect(result.result).toBe("42");
    expect(result.type).toBe("number");
    expect(result.variableReference).toBe(0);
  });

  it("returns result with expandable variableReference", async () => {
    const adapter = createAdapter({
      async evaluate() {
        return { result: "Object", type: "object", variableReference: 123 };
      },
    });

    const result = await adapter.evaluate("s1", "myObj");
    expect(result.variableReference).toBe(123);
  });
});
