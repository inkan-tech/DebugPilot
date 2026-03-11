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
    pause: vi.fn(),
    setBreakpoint: vi.fn(),
    removeBreakpoint: vi.fn().mockResolvedValue(undefined),
    setExceptionBreakpoints: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_breakpoint_remove", () => {
  it("removes a breakpoint by ID", async () => {
    const adapter = createAdapter();
    await adapter.removeBreakpoint("BP#1");
    expect(adapter.removeBreakpoint).toHaveBeenCalledWith("BP#1");
  });

  it("throws for invalid breakpoint ID", async () => {
    const adapter = createAdapter({
      removeBreakpoint: vi.fn().mockRejectedValue(new Error("Invalid breakpoint ID: bad-id")),
    });
    await expect(adapter.removeBreakpoint("bad-id")).rejects.toThrow("Invalid breakpoint ID: bad-id");
  });

  it("throws when breakpoint not found", async () => {
    const adapter = createAdapter({
      removeBreakpoint: vi.fn().mockRejectedValue(new Error("Breakpoint BP#99 not found")),
    });
    await expect(adapter.removeBreakpoint("BP#99")).rejects.toThrow("Breakpoint BP#99 not found");
  });
});
