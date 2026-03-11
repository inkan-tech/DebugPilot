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
    step: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    setBreakpoint: vi.fn(),
    removeBreakpoint: vi.fn(),
    setExceptionBreakpoints: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_step", () => {
  it("calls adapter.step with type 'over'", async () => {
    const adapter = createAdapter();
    await adapter.step("session-1", "over");
    expect(adapter.step).toHaveBeenCalledWith("session-1", "over");
  });

  it("calls adapter.step with type 'into'", async () => {
    const adapter = createAdapter();
    await adapter.step("session-1", "into");
    expect(adapter.step).toHaveBeenCalledWith("session-1", "into");
  });

  it("calls adapter.step with type 'out'", async () => {
    const adapter = createAdapter();
    await adapter.step("session-1", "out");
    expect(adapter.step).toHaveBeenCalledWith("session-1", "out");
  });

  it("passes threadId when provided", async () => {
    const adapter = createAdapter();
    await adapter.step("session-1", "over", 3);
    expect(adapter.step).toHaveBeenCalledWith("session-1", "over", 3);
  });

  it("throws when session not found", async () => {
    const adapter = createAdapter({
      step: vi.fn().mockRejectedValue(new Error("Session xyz not found")),
    });
    await expect(adapter.step("xyz", "over")).rejects.toThrow("Session xyz not found");
  });
});
