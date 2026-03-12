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
- Extension URL: https://marketplace.visualstudio.com/items?itemName=inkan-link.debugpilot

## Tool Patterns
- One file per tool in `src/tools/`, registered via `src/tools/index.ts`
- All tools with sessionId: description says "Requires a sessionId from debug_sessions"
- sessionId param: `.describe("Debug session ID (get from debug_sessions)")`
- Constants in `src/constants.ts`, interface in `src/types.ts`, impl in `src/debug-adapter.ts`

## MCP SDK Notes (for Phase 3)
- Resources: `server.resource()` for static, `server.resource()` with subscribe for live
- Prompts: `server.prompt()` with name, description, args, handler
- Notifications: server can push via transport (need to investigate subscription model)

## Debug Session Observations
- Exception breakpoints default to ALL exceptions (caught + uncaught)
- `["uncaught"]` filter avoids noise from third-party extensions
- Flutter/Dart uses custom DAP commands: `hotReload`, `hotRestart`
