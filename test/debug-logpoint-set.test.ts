import { describe, it, expect, vi } from "vitest";
import type { IDebugAdapter, BreakpointInfo } from "../src/types.js";

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
    setLogpoint: vi.fn().mockResolvedValue({
      id: "BP#1",
      file: "/src/index.ts",
      line: 42,
      enabled: true,
    } satisfies BreakpointInfo),
    runTo: vi.fn(),
    customRequest: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_logpoint_set", () => {
  it("sets a logpoint with file, line, and message", async () => {
    const adapter = createAdapter();
    const result = await adapter.setLogpoint("/src/index.ts", 42, "value={x}");
    expect(result).toEqual({
      id: "BP#1",
      file: "/src/index.ts",
      line: 42,
      enabled: true,
    });
    expect(adapter.setLogpoint).toHaveBeenCalledWith("/src/index.ts", 42, "value={x}");
  });

  it("sets a logpoint with a condition", async () => {
    const adapter = createAdapter({
      setLogpoint: vi.fn().mockResolvedValue({
        id: "BP#2",
        file: "/src/auth.ts",
        line: 15,
        enabled: true,
        condition: "count > 5",
      }),
    });
    const result = await adapter.setLogpoint("/src/auth.ts", 15, "count={count}", "count > 5");
    expect(result.condition).toBe("count > 5");
    expect(adapter.setLogpoint).toHaveBeenCalledWith("/src/auth.ts", 15, "count={count}", "count > 5");
  });

  it("throws when setLogpoint fails", async () => {
    const adapter = createAdapter({
      setLogpoint: vi.fn().mockRejectedValue(new Error("Failed to set logpoint")),
    });
    await expect(adapter.setLogpoint("/bad.ts", 1, "msg")).rejects.toThrow("Failed to set logpoint");
  });
});
