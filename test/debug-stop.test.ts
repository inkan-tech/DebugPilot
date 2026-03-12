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
    continue: vi.fn().mockResolvedValue(undefined),
    step: vi.fn(),
    pause: vi.fn(),
    setBreakpoint: vi.fn(),
    removeBreakpoint: vi.fn(),
    setExceptionBreakpoints: vi.fn(),
    launch: vi.fn().mockResolvedValue({ sessionId: "session-1", status: "launched" }),
    stop: vi.fn().mockResolvedValue(undefined),
    customRequest: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_stop", () => {
  it("calls adapter.stop with sessionId", async () => {
    const adapter = createAdapter();
    await adapter.stop("session-1");
    expect(adapter.stop).toHaveBeenCalledWith("session-1");
  });

  it("throws when session not found", async () => {
    const adapter = createAdapter({
      stop: vi.fn().mockRejectedValue(new Error("Session xyz not found")),
    });
    await expect(adapter.stop("xyz")).rejects.toThrow("Session xyz not found");
  });
});
