import { describe, it, expect, vi } from "vitest";
import { window, StatusBarAlignment, env } from "./mocks/vscode.js";

describe("Status bar mock", () => {
  it("createStatusBarItem returns an object with expected properties", () => {
    const item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    expect(item).toBeDefined();
    expect(item.text).toBe("");
    expect(item.tooltip).toBe("");
    expect(item.command).toBeUndefined();
    expect(typeof item.show).toBe("function");
    expect(typeof item.hide).toBe("function");
    expect(typeof item.dispose).toBe("function");
  });

  it("status bar item properties are writable", () => {
    const item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    item.text = "$(debug) DebugPilot :45853";
    item.tooltip = "DebugPilot MCP Server running on port 45853";
    item.command = "debugpilot.showConnectionInfo";

    expect(item.text).toBe("$(debug) DebugPilot :45853");
    expect(item.tooltip).toBe("DebugPilot MCP Server running on port 45853");
    expect(item.command).toBe("debugpilot.showConnectionInfo");
  });

  it("stopped state uses correct text", () => {
    const item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    item.text = "$(debug) DebugPilot (stopped)";
    item.tooltip = "DebugPilot MCP Server is stopped";

    expect(item.text).toBe("$(debug) DebugPilot (stopped)");
    expect(item.tooltip).toBe("DebugPilot MCP Server is stopped");
  });
});

describe("Clipboard mock", () => {
  it("env.clipboard.writeText resolves", async () => {
    await expect(
      env.clipboard.writeText("http://127.0.0.1:45853/mcp"),
    ).resolves.toBeUndefined();
  });

  it("env.clipboard can be spied on", async () => {
    const spy = vi.spyOn(env.clipboard, "writeText");
    await env.clipboard.writeText("test-url");
    expect(spy).toHaveBeenCalledWith("test-url");
    spy.mockRestore();
  });
});
