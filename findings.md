# DebugPilot — Findings

## Architecture

- MCP server runs inside VS Code extension host — no IPC needed
- `vscode.debug.*` APIs proxy all DAP calls — any VS Code debugger works automatically
- IDebugAdapter is the testability boundary (mock in tests)
- Console output buffered in ring buffer (10K messages/session)
- Source context read from filesystem, not DAP

## Transport

- Streamable HTTP on `127.0.0.1:45853` — local only, no auth
- Port reclaim: `/health` check + `/shutdown` to reclaim from stale instances
- `server.start(port)` accepts optional port param (port 0 = random, used in integration tests)

## Build & Test

- `node esbuild.config.mjs` — build (don't use `pnpm run build`, exit code issues)
- `npx tsc --noEmit` — type check
- `npx vitest run` — all tests (unit + integration)
- `npx vitest run test/integration/` — integration only
- `vscode` is external in esbuild — never bundle it

## Publishing

- Publisher: `inkan-link` on VS Code Marketplace
- `az account get-access-token --resource "499b84ac-1321-427f-aa17-267ca6975798"` for vsce auth
- `npx vsce publish --pre-release --pat "$TOKEN"`
- Extension URL: <https://marketplace.visualstudio.com/items?itemName=inkan-link.debugpilot>

## Tool Patterns

- One file per tool in `src/tools/`, registered via `src/tools/index.ts`
- All tools with sessionId: description says "Requires a sessionId from debug_sessions"
- sessionId param: `.describe("Debug session ID (get from debug_sessions)")`
- Constants in `src/constants.ts`, interface in `src/types.ts`, impl in `src/debug-adapter.ts`

## SKILL.md Audit (2026-03-15)

### Discrepancies Found

1. **3 MCP tools missing from docs**: `debug_diagnostics`, `debug_console_history`, `debug_watch`
2. **Protocol format wrong**: SKILL.md says JSON-RPC (`"jsonrpc": "2.0"`), actual format is `{id, method, params}` — no jsonrpc field
3. **Event push exists but undocumented**: WS broker supports subscribe/unsubscribe + push events (stopped, continued, session.started, session.terminated, console.output, diagnostics.changed). SKILL.md says "no event push, must poll"
4. **3 WS methods missing from docs**: `setExceptionBreakpoints`, `customRequest`, `consoleHistory`
5. **evaluate context param undocumented**: `debug_evaluate` now accepts `context: "watch"|"repl"|"hover"` (default: "watch")
6. **Dart auto-config undocumented**: SessionManager auto-sets `["Unhandled"]` exception filters for Dart sessions
7. **Monitor template uses polling** but should use WS event subscription instead
8. **Version**: codebase is v0.7.3, SKILL.md doesn't mention version

## Debug Session Observations

- Exception breakpoints default to ALL exceptions (caught + uncaught)
- Dart sessions now auto-configured to "Unhandled" only (session-manager.ts:74)
- Flutter/Dart uses custom DAP commands: `hotReload`, `hotRestart`
- `debug_evaluate` uses `context: "watch"` by default (works for Dart locals)
