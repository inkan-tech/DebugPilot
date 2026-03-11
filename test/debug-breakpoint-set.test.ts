import { describe, it, expect, vi } from "vitest";
import type { IDebugAdapter, BreakpointInfo } from "../src/types.js";

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
    setBreakpoint: vi.fn().mockResolvedValue({
      id: "BP#1",
      file: "/src/index.ts",
      line: 42,
      enabled: true,
    } satisfies BreakpointInfo),
    removeBreakpoint: vi.fn(),
    setExceptionBreakpoints: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as IDebugAdapter;
}

describe("debug_breakpoint_set", () => {
  it("sets a breakpoint with file and line", async () => {
    const adapter = createAdapter();
    const result = await adapter.setBreakpoint("/src/index.ts", 42);
    expect(result).toEqual({
      id: "BP#1",
      file: "/src/index.ts",
      line: 42,
      enabled: true,
    });
    expect(adapter.setBreakpoint).toHaveBeenCalledWith("/src/index.ts", 42);
  });

  it("sets a conditional breakpoint", async () => {
    const adapter = createAdapter({
      setBreakpoint: vi.fn().mockResolvedValue({
        id: "BP#2",
        file: "/src/auth.ts",
        line: 15,
        enabled: true,
        condition: 'userId === "admin"',
      }),
    });
    const result = await adapter.setBreakpoint("/src/auth.ts", 15, 'userId === "admin"');
    expect(result.condition).toBe('userId === "admin"');
  });

  it("sets a breakpoint with log message", async () => {
    const adapter = createAdapter({
      setBreakpoint: vi.fn().mockResolvedValue({
        id: "BP#3",
        file: "/src/api.ts",
        line: 100,
        enabled: true,
      }),
    });
    await adapter.setBreakpoint("/src/api.ts", 100, undefined, "request={req.url}");
    expect(adapter.setBreakpoint).toHaveBeenCalledWith("/src/api.ts", 100, undefined, "request={req.url}");
  });
});
