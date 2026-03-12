import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VscodeDebugAdapter, requireSession } from "../src/debug-adapter.js";
import { SessionManager } from "../src/session-manager.js";

// Mock source-reader to avoid filesystem access
vi.mock("../src/source-reader.js", () => ({
  readSourceContext: vi.fn(() => undefined),
}));

/**
 * Creates a mock SessionManager with configurable sessions.
 */
function createMockSessionManager(
  sessions: Array<{ id: string; name: string; type: string }> = [],
) {
  const sessionMap = new Map<string, any>();
  for (const s of sessions) {
    sessionMap.set(s.id, {
      id: s.id,
      name: s.name,
      type: s.type,
      customRequest: vi.fn(),
    });
  }

  return {
    getSession: vi.fn((id: string) => sessionMap.get(id)),
    getConsoleBuffer: vi.fn(() => undefined),
    getPauseState: vi.fn(() => ({ paused: false })),
    getSessionInfoList: vi.fn(() =>
      sessions.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        status: "running" as const,
      })),
    ),
    getAllSessions: vi.fn(() => sessionMap),
  } as unknown as SessionManager;
}

describe("requireSession", () => {
  it("returns session when it exists", () => {
    const mgr = createMockSessionManager([
      { id: "s1", name: "Test", type: "node" },
    ]);
    const session = requireSession(mgr, "s1");
    expect(session).toBeDefined();
    expect((session as any).id).toBe("s1");
  });

  it("throws actionable error when no sessions exist", () => {
    const mgr = createMockSessionManager([]);
    expect(() => requireSession(mgr, "nonexistent")).toThrow(
      "No active debug sessions. Start a debug session first, then call debug_sessions to get the sessionId.",
    );
  });

  it("lists available sessions when wrong ID is provided", () => {
    const mgr = createMockSessionManager([
      { id: "session-abc", name: "Node", type: "node" },
      { id: "session-def", name: "Chrome", type: "chrome" },
    ]);
    expect(() => requireSession(mgr, "wrong-id")).toThrow(
      'Session "wrong-id" not found. Available sessions: session-abc, session-def. Call debug_sessions to see current sessions.',
    );
  });
});

describe("VscodeDebugAdapter error messages", () => {
  it("continue throws actionable error with no sessions", async () => {
    const mgr = createMockSessionManager([]);
    const adapter = new VscodeDebugAdapter(mgr);
    await expect(adapter.continue("missing")).rejects.toThrow(
      "No active debug sessions",
    );
  });

  it("step throws actionable error listing available sessions", async () => {
    const mgr = createMockSessionManager([
      { id: "s1", name: "Test", type: "node" },
    ]);
    const adapter = new VscodeDebugAdapter(mgr);
    await expect(adapter.step("wrong", "over")).rejects.toThrow(
      'Session "wrong" not found. Available sessions: s1',
    );
  });

  it("pause throws actionable error with no sessions", async () => {
    const mgr = createMockSessionManager([]);
    const adapter = new VscodeDebugAdapter(mgr);
    await expect(adapter.pause("missing")).rejects.toThrow(
      "No active debug sessions",
    );
  });

  it("stop throws actionable error with no sessions", async () => {
    const mgr = createMockSessionManager([]);
    const adapter = new VscodeDebugAdapter(mgr);
    await expect(adapter.stop("missing")).rejects.toThrow(
      "No active debug sessions",
    );
  });

  it("customRequest throws actionable error with no sessions", async () => {
    const mgr = createMockSessionManager([]);
    const adapter = new VscodeDebugAdapter(mgr);
    await expect(adapter.customRequest("missing", "threads")).rejects.toThrow(
      "No active debug sessions",
    );
  });

  it("setExceptionBreakpoints throws actionable error with no sessions", async () => {
    const mgr = createMockSessionManager([]);
    const adapter = new VscodeDebugAdapter(mgr);
    await expect(
      adapter.setExceptionBreakpoints("missing", ["uncaught"]),
    ).rejects.toThrow("No active debug sessions");
  });
});

describe("evaluate timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("times out when evaluation never resolves", async () => {
    const neverResolve = new Promise(() => {});
    const session = {
      id: "s1",
      name: "Test",
      type: "node",
      customRequest: vi.fn(() => neverResolve),
    };
    const mgr = createMockSessionManager([
      { id: "s1", name: "Test", type: "node" },
    ]);
    // Override getSession to return our custom session with the never-resolving mock
    (mgr.getSession as any).mockImplementation((id: string) =>
      id === "s1" ? session : undefined,
    );

    const adapter = new VscodeDebugAdapter(mgr);
    const evalPromise = adapter.evaluate("s1", "while(true){}");

    // Advance timers past the 10s timeout
    vi.advanceTimersByTime(10_000);

    await expect(evalPromise).rejects.toThrow(
      "Expression evaluation timed out after 10000ms",
    );
  });

  it("succeeds when evaluation resolves before timeout", async () => {
    const session = {
      id: "s1",
      name: "Test",
      type: "node",
      customRequest: vi.fn(async () => ({
        result: "42",
        type: "number",
        variablesReference: 0,
      })),
    };
    const mgr = createMockSessionManager([
      { id: "s1", name: "Test", type: "node" },
    ]);
    (mgr.getSession as any).mockImplementation((id: string) =>
      id === "s1" ? session : undefined,
    );

    const adapter = new VscodeDebugAdapter(mgr);
    const result = await adapter.evaluate("s1", "21*2");

    expect(result.result).toBe("42");
  });
});
