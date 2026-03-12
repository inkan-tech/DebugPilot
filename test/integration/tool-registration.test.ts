import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../../src/tools/index.js";
import { createMockAdapter } from "./helpers.js";
import * as constants from "../../src/constants.js";

const EXPECTED_TOOL_NAMES = [
  constants.TOOL_DEBUG_SESSIONS,
  constants.TOOL_DEBUG_STATE,
  constants.TOOL_DEBUG_VARIABLES,
  constants.TOOL_DEBUG_EVALUATE,
  constants.TOOL_DEBUG_CONSOLE,
  constants.TOOL_DEBUG_BREAKPOINTS_LIST,
  constants.TOOL_DEBUG_CONTINUE,
  constants.TOOL_DEBUG_STEP,
  constants.TOOL_DEBUG_PAUSE,
  constants.TOOL_DEBUG_BREAKPOINT_SET,
  constants.TOOL_DEBUG_BREAKPOINT_REMOVE,
  constants.TOOL_DEBUG_EXCEPTION_CONFIG,
  constants.TOOL_DEBUG_LAUNCH,
  constants.TOOL_DEBUG_STOP,
  constants.TOOL_DEBUG_LOGPOINT_SET,
  constants.TOOL_DEBUG_RUN_TO,
  constants.TOOL_DEBUG_HOT_RELOAD,
  constants.TOOL_DEBUG_HOT_RESTART,
];

describe("tool registration", () => {
  function getRegisteredToolNames(): string[] {
    const adapter = createMockAdapter();
    const registeredNames: string[] = [];

    const server = new McpServer({
      name: "test-registration",
      version: "0.0.1",
    });

    const originalTool = server.tool.bind(server);
    server.tool = function (...args: any[]) {
      if (typeof args[0] === "string") {
        registeredNames.push(args[0]);
      }
      return (originalTool as any)(...args);
    } as any;

    registerAllTools(server, adapter);
    return registeredNames;
  }

  it("registers all expected tools", () => {
    const names = getRegisteredToolNames();
    for (const expected of EXPECTED_TOOL_NAMES) {
      expect(names, `missing tool: ${expected}`).toContain(expected);
    }
  });

  it("has the correct total tool count", () => {
    const names = getRegisteredToolNames();
    expect(names).toHaveLength(EXPECTED_TOOL_NAMES.length);
  });

  it("tool names match constants from constants.ts", () => {
    const names = getRegisteredToolNames();
    for (const name of names) {
      expect(EXPECTED_TOOL_NAMES, `unexpected tool: ${name}`).toContain(name);
    }
    for (const expected of EXPECTED_TOOL_NAMES) {
      expect(names, `unregistered constant: ${expected}`).toContain(expected);
    }
  });

  it("has no duplicate tool names", () => {
    const names = getRegisteredToolNames();
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
