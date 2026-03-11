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
    continue: vi.fn().mockResolvedValue(undefined),
    step: vi.fn(),
    pause: vi.fn(),
    setBreakpoint: vi.fn(),
    removeBreakpoint: vi.fn(),
    setExceptionBreakpoints: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_continue", () => {
  it("calls adapter.continue with sessionId", async () => {
    const adapter = createAdapter();
    await adapter.continue("session-1");
    expect(adapter.continue).toHaveBeenCalledWith("session-1");
  });

  it("calls adapter.continue with sessionId and threadId", async () => {
    const adapter = createAdapter();
    await adapter.continue("session-1", 5);
    expect(adapter.continue).toHaveBeenCalledWith("session-1", 5);
  });

  it("throws when session not found", async () => {
    const adapter = createAdapter({
      continue: vi.fn().mockRejectedValue(new Error("Session xyz not found")),
    });
    await expect(adapter.continue("xyz")).rejects.toThrow("Session xyz not found");
  });
});
