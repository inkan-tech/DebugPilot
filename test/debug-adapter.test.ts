import { describe, it, expect, vi, beforeEach } from "vitest";
import { VscodeDebugAdapter } from "../src/debug-adapter.js";
import { SessionManager } from "../src/session-manager.js";
import type { Variable } from "../src/types.js";

// Mock source-reader to avoid filesystem access
vi.mock("../src/source-reader.js", () => ({
  readSourceContext: vi.fn(() => ({
    lines: [
      { line: 9, text: "  const a = 1;" },
      { line: 10, text: "  debugger;", current: true },
      { line: 11, text: "  return a;" },
    ],
    contextLines: 5,
  })),
}));

/**
 * Creates a mock DebugSession with configurable DAP responses.
 */
function createMockSession(
  id: string,
  responses: Record<string, any> = {},
) {
  return {
    id,
    name: "Test",
    type: "node",
    customRequest: vi.fn(async (command: string, args?: any) => {
      if (responses[command]) {
        const resp = responses[command];
        return typeof resp === "function" ? resp(args) : resp;
      }
      throw new Error(`Unexpected DAP request: ${command}`);
    }),
  } as any;
}

/**
 * Creates a mock SessionManager that returns the given session and pause state.
 */
function createMockSessionManager(
  session: any,
  pauseReason?: "breakpoint" | "exception" | "step" | "pause",
) {
  return {
    getSession: vi.fn((id: string) => (id === session?.id ? session : undefined)),
    getConsoleBuffer: vi.fn(() => undefined),
    getPauseState: vi.fn((id: string) => {
      if (id !== session?.id) return undefined;
      if (pauseReason) return { paused: true, reason: pauseReason };
      return { paused: false };
    }),
    getSessionInfoList: vi.fn(() =>
      session
        ? [{ id: session.id, name: session.name, type: session.type, status: "running" as const }]
        : [],
    ),
  } as unknown as SessionManager;
}

describe("VscodeDebugAdapter.getState", () => {
  it("returns not-paused state when session not found", async () => {
    const mgr = createMockSessionManager(null);
    const adapter = new VscodeDebugAdapter(mgr);

    const state = await adapter.getState("nonexistent");

    expect(state.paused).toBe(false);
    expect(state.locals).toEqual([]);
    expect(state.callStack).toEqual([]);
  });

  it("returns not-paused state when no threads", async () => {
    const session = createMockSession("s1", {
      threads: { threads: [] },
    });
    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const state = await adapter.getState("s1");

    expect(state.paused).toBe(false);
  });

  it("returns full paused state with stop reason from session manager", async () => {
    const session = createMockSession("s1", {
      threads: { threads: [{ id: 1 }] },
      stackTrace: {
        stackFrames: [
          { id: 0, name: "main", source: { path: "/app/index.ts" }, line: 10, column: 5 },
          { id: 1, name: "run", source: { path: "/app/runner.ts" }, line: 20 },
        ],
      },
      scopes: {
        scopes: [{ name: "Local", variablesReference: 100 }],
      },
      variables: {
        variables: [
          { name: "x", value: "42", type: "number", variablesReference: 0 },
          { name: "y", value: '"hello"', type: "string", variablesReference: 0 },
        ],
      },
    });

    const mgr = createMockSessionManager(session, "exception");
    const adapter = new VscodeDebugAdapter(mgr);

    const state = await adapter.getState("s1");

    expect(state.paused).toBe(true);
    expect(state.reason).toBe("exception");
    expect(state.location).toEqual({
      file: "/app/index.ts",
      line: 10,
      column: 5,
      function: "main",
    });
    expect(state.callStack).toHaveLength(2);
    expect(state.callStack[0].name).toBe("main");
    expect(state.callStack[1].name).toBe("run");
    expect(state.locals).toHaveLength(2);
    expect(state.locals[0].name).toBe("x");
    expect(state.source).toBeDefined();
  });

  it("returns reason as undefined when pause state has no reason", async () => {
    const session = createMockSession("s1", {
      threads: { threads: [{ id: 1 }] },
      stackTrace: {
        stackFrames: [
          { id: 0, name: "fn", source: { path: "/a.ts" }, line: 1 },
        ],
      },
      scopes: { scopes: [] },
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const state = await adapter.getState("s1");

    expect(state.paused).toBe(true);
    expect(state.reason).toBeUndefined();
  });

  it("handles missing source path gracefully", async () => {
    const session = createMockSession("s1", {
      threads: { threads: [{ id: 1 }] },
      stackTrace: {
        stackFrames: [
          { id: 0, name: "eval", line: 1 }, // no source
        ],
      },
      scopes: { scopes: [] },
    });

    const mgr = createMockSessionManager(session, "step");
    const adapter = new VscodeDebugAdapter(mgr);

    const state = await adapter.getState("s1");

    expect(state.paused).toBe(true);
    expect(state.location!.file).toBe("<unknown>");
    expect(state.reason).toBe("step");
  });

  it("returns not-paused when stack trace request fails", async () => {
    const session = createMockSession("s1", {
      threads: { threads: [{ id: 1 }] },
      // stackTrace will throw (not in responses)
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const state = await adapter.getState("s1");

    expect(state.paused).toBe(false);
  });
});

describe("VscodeDebugAdapter.getVariables", () => {
  it("returns empty array when session not found", async () => {
    const mgr = createMockSessionManager(null);
    const adapter = new VscodeDebugAdapter(mgr);

    const vars = await adapter.getVariables("nonexistent", 1);

    expect(vars).toEqual([]);
  });

  it("returns flat variables at depth 1", async () => {
    const session = createMockSession("s1", {
      variables: {
        variables: [
          { name: "a", value: "1", type: "number", variablesReference: 0 },
          { name: "b", value: "obj", type: "Object", variablesReference: 10 },
        ],
      },
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const vars = await adapter.getVariables("s1", 5, 1);

    expect(vars).toHaveLength(2);
    expect(vars[0]).toEqual({
      name: "a",
      value: "1",
      type: "number",
      variableReference: 0,
    });
    expect(vars[1].children).toBeUndefined();
  });

  it("populates children array at depth > 1", async () => {
    const session = createMockSession("s1", {
      variables: vi.fn(async (args: any) => {
        if (args.variablesReference === 5) {
          return {
            variables: [
              { name: "obj", value: "Object", type: "Object", variablesReference: 10 },
            ],
          };
        }
        if (args.variablesReference === 10) {
          return {
            variables: [
              { name: "x", value: "1", type: "number", variablesReference: 0 },
              { name: "y", value: "2", type: "number", variablesReference: 0 },
            ],
          };
        }
        return { variables: [] };
      }),
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const vars = await adapter.getVariables("s1", 5, 2);

    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe("obj");
    expect(vars[0].children).toBeDefined();
    expect(vars[0].children).toHaveLength(2);
    expect(vars[0].children![0].name).toBe("x");
    expect(vars[0].children![1].name).toBe("y");
  });

  it("respects depth limit recursion", async () => {
    // 3-level deep nesting, but request depth 2 — should stop at level 2
    const session = createMockSession("s1", {
      variables: vi.fn(async (args: any) => {
        if (args.variablesReference === 1) {
          return {
            variables: [
              { name: "level1", value: "L1", type: "Object", variablesReference: 2 },
            ],
          };
        }
        if (args.variablesReference === 2) {
          return {
            variables: [
              { name: "level2", value: "L2", type: "Object", variablesReference: 3 },
            ],
          };
        }
        if (args.variablesReference === 3) {
          return {
            variables: [
              { name: "level3", value: "L3", type: "string", variablesReference: 0 },
            ],
          };
        }
        return { variables: [] };
      }),
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const vars = await adapter.getVariables("s1", 1, 2);

    expect(vars[0].name).toBe("level1");
    expect(vars[0].children).toBeDefined();
    expect(vars[0].children![0].name).toBe("level2");
    // level2 has variableReference 3, but depth was clamped — no children
    expect(vars[0].children![0].children).toBeUndefined();
  });

  it("clamps depth to MAX_VARIABLE_DEPTH", async () => {
    const session = createMockSession("s1", {
      variables: { variables: [] },
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    // Requesting depth 100 should not crash — clamped to MAX_VARIABLE_DEPTH (5)
    const vars = await adapter.getVariables("s1", 1, 100);
    expect(vars).toEqual([]);
  });

  it("does not attach children when child list is empty", async () => {
    const session = createMockSession("s1", {
      variables: vi.fn(async (args: any) => {
        if (args.variablesReference === 1) {
          return {
            variables: [
              { name: "empty", value: "{}", type: "Object", variablesReference: 2 },
            ],
          };
        }
        // ref 2 returns no children
        return { variables: [] };
      }),
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const vars = await adapter.getVariables("s1", 1, 2);

    expect(vars[0].name).toBe("empty");
    expect(vars[0].children).toBeUndefined();
  });
});

describe("VscodeDebugAdapter.evaluate", () => {
  it("throws when session not found", async () => {
    const mgr = createMockSessionManager(null);
    const adapter = new VscodeDebugAdapter(mgr);

    await expect(adapter.evaluate("bad", "1+1")).rejects.toThrow(
      "Session bad not found",
    );
  });

  it("evaluates expression and returns result", async () => {
    const session = createMockSession("s1", {
      evaluate: { result: "42", type: "number", variablesReference: 0 },
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const result = await adapter.evaluate("s1", "21*2");

    expect(result.result).toBe("42");
    expect(result.type).toBe("number");
    expect(result.variableReference).toBe(0);
  });

  it("passes frameId when provided", async () => {
    const session = createMockSession("s1", {
      evaluate: { result: "ok", variablesReference: 0 },
    });

    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    await adapter.evaluate("s1", "x", 5);

    expect(session.customRequest).toHaveBeenCalledWith("evaluate", {
      expression: "x",
      context: "repl",
      frameId: 5,
    });
  });
});

describe("VscodeDebugAdapter.getSessions", () => {
  it("delegates to session manager", () => {
    const session = createMockSession("s1", {});
    const mgr = createMockSessionManager(session);
    const adapter = new VscodeDebugAdapter(mgr);

    const sessions = adapter.getSessions();

    expect(mgr.getSessionInfoList).toHaveBeenCalled();
    expect(sessions).toHaveLength(1);
  });
});
