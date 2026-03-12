import { describe, it, expect, vi } from "vitest";
import type { IDebugAdapter } from "../src/types.js";

function createAdapter(overrides: Partial<IDebugAdapter> = {}): IDebugAdapter {
  return {
    getSessions: vi.fn().mockReturnValue([]),
    getState: vi.fn(),
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
    launch: vi.fn().mockResolvedValue({ sessionId: "s1", status: "launched" }),
    stop: vi.fn().mockResolvedValue(undefined),
    setLogpoint: vi.fn(),
    runTo: vi.fn().mockResolvedValue(undefined),
    customRequest: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_run_to", () => {
  it("calls adapter.runTo with sessionId, file, and line", async () => {
    const adapter = createAdapter();
    await adapter.runTo("session-1", "/src/index.ts", 50);
    expect(adapter.runTo).toHaveBeenCalledWith("session-1", "/src/index.ts", 50);
  });

  it("throws when session not found", async () => {
    const adapter = createAdapter({
      runTo: vi.fn().mockRejectedValue(new Error("Session xyz not found")),
    });
    await expect(adapter.runTo("xyz", "/src/index.ts", 10)).rejects.toThrow("Session xyz not found");
  });
});
