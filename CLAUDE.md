# DebugPilot — VS Code Debug MCP Server

## Quick Reference

```bash
pnpm install              # Install dependencies
pnpm run build            # esbuild → dist/extension.js
pnpm run build:check      # tsc --noEmit (type check only)
pnpm run test             # vitest run
pnpm run build:watch      # esbuild watch mode
```

## Architecture

Single-package VS Code extension. The MCP server runs inside the extension host process — no IPC needed.

- `src/extension.ts` — activate/deactivate entry point
- `src/server.ts` — DebugMcpServer wrapping McpServer + stdio transport
- `src/debug-adapter.ts` — IDebugAdapter implementation using vscode.debug.* APIs
- `src/session-manager.ts` — tracks debug sessions + console buffers
- `src/console-buffer.ts` — ring buffer for console output
- `src/source-reader.ts` — reads source lines around breakpoint
- `src/tools/*.ts` — one file per MCP tool
- `src/types.ts` — IDebugAdapter interface + shared types
- `src/constants.ts` — tool names, defaults

## Conventions

- All tools go in `src/tools/` — one file per tool, registered via `src/tools/index.ts`
- IDebugAdapter is the testability boundary — mock it in tests, never mock vscode.debug directly in tool tests
- Use `vscode.debug.activeDebugSession.customRequest()` for DAP protocol calls
- Console buffer is per-session, managed by SessionManager
- `vscode` is external in esbuild — never bundle it
- Tests use vitest with vscode mock at `test/mocks/vscode.ts`

## Phase 1 Tools (MVP — Read Only)

1. `debug_sessions` — list active sessions
2. `debug_state` — full state (location, source, locals, stack)
3. `debug_variables` — get/expand variables
4. `debug_evaluate` — evaluate expression in frame
5. `debug_console` — buffered console output
6. `debug_breakpoints_list` — list breakpoints
