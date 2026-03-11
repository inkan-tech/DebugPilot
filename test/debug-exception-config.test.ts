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
    removeBreakpoint: vi.fn(),
    setExceptionBreakpoints: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_exception_config", () => {
  it("configures uncaught exceptions only", async () => {
    const adapter = createAdapter();
    await adapter.setExceptionBreakpoints("session-1", ["uncaught"]);
    expect(adapter.setExceptionBreakpoints).toHaveBeenCalledWith("session-1", ["uncaught"]);
  });

  it("configures both caught and uncaught", async () => {
    const adapter = createAdapter();
    await adapter.setExceptionBreakpoints("session-1", ["caught", "uncaught"]);
    expect(adapter.setExceptionBreakpoints).toHaveBeenCalledWith("session-1", ["caught", "uncaught"]);
  });

  it("clears all exception breakpoints with empty filters", async () => {
    const adapter = createAdapter();
    await adapter.setExceptionBreakpoints("session-1", []);
    expect(adapter.setExceptionBreakpoints).toHaveBeenCalledWith("session-1", []);
  });

  it("throws when session not found", async () => {
    const adapter = createAdapter({
      setExceptionBreakpoints: vi.fn().mockRejectedValue(new Error("Session xyz not found")),
    });
    await expect(adapter.setExceptionBreakpoints("xyz", ["uncaught"])).rejects.toThrow("Session xyz not found");
  });
});
