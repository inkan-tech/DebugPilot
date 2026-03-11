import { describe, it, expect, vi } from "vitest";
import type { IDebugAdapter } from "../src/types.js";

function createAdapter(overrides: Partial<IDebugAdapter> = {}): IDebugAdapter {
  return {
    getSessions: vi.fn().mockReturnValue([]),
    getState: vi.fn(),
    getVariables: vi.fn(),
    evaluate: vi.fn(),
    getConsoleOutput: vi.fn().mockReturnValue([]),
    getBreakpoints: vi.fn().mockReturnValue([]),
    continue: vi.fn(),
    step: vi.fn(),
    pause: vi.fn().mockResolvedValue(undefined),
    setBreakpoint: vi.fn(),
    removeBreakpoint: vi.fn(),
    setExceptionBreakpoints: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_pause", () => {
  it("calls adapter.pause with sessionId", async () => {
    const adapter = createAdapter();
    await adapter.pause("session-1");
    expect(adapter.pause).toHaveBeenCalledWith("session-1");
  });

  it("passes threadId when provided", async () => {
    const adapter = createAdapter();
    await adapter.pause("session-1", 7);
    expect(adapter.pause).toHaveBeenCalledWith("session-1", 7);
  });

  it("throws when session not found", async () => {
    const adapter = createAdapter({
      pause: vi.fn().mockRejectedValue(new Error("Session xyz not found")),
    });
    await expect(adapter.pause("xyz")).rejects.toThrow("Session xyz not found");
  });
});
