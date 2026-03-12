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

describe("debug_launch", () => {
  it("calls adapter.launch with configuration name", async () => {
    const adapter = createAdapter();
    const result = await adapter.launch("Launch Program");
    expect(adapter.launch).toHaveBeenCalledWith("Launch Program");
    expect(result).toEqual({ sessionId: "session-1", status: "launched" });
  });

  it("throws when configuration not found", async () => {
    const adapter = createAdapter({
      launch: vi.fn().mockRejectedValue(new Error('Failed to launch configuration "NonExistent"')),
    });
    await expect(adapter.launch("NonExistent")).rejects.toThrow(
      'Failed to launch configuration "NonExistent"',
    );
  });
});
