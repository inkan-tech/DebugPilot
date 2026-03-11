# DebugPilot — Findings

## Architecture
- MCP server runs inside VS Code extension host process — no IPC needed
- `vscode.debug.*` APIs proxy all DAP calls
- IDebugAdapter is the testability boundary (mock in tests)
- Console output is buffered in a ring buffer (default 10K messages per session)
- Source context read directly from filesystem, not DAP

## Transport
- Streamable HTTP on `127.0.0.1:45853` — local only, no auth
- Port reclaim: if previous DebugPilot holds the port, `/health` check + `/shutdown` to reclaim
- CORS headers set for local dev tools

## Build
- esbuild bundles to `dist/extension.js` — `vscode` is external
- `pnpm run build` may report false exit code failures; use `node esbuild.config.mjs` directly
- Type check: `npx tsc --noEmit`

## Testing
- 7 test files, 56 tests all passing
- Phase 1 tools fully tested
- Phase 2 tools (control) have NO tests yet
- Tests use vitest with vscode mock at `test/mocks/vscode.ts`

## Marketplace Requirements
- `package.json` needs `"icon"` field pointing to PNG
- `.vscodeignore` must include `!assets/**` for icon to be packaged
- CHANGELOG.md expected by marketplace
- Publisher `inkan-tech` must exist on marketplace

## Publishing
- Can publish via `az` CLI token instead of a manual PAT
- `az account get-access-token --resource "499b84ac-1321-427f-aa17-267ca6975798"` gives a valid token for vsce
- Pass with `--pat "$TOKEN"` flag to `npx vsce publish`
- Publisher is `inkan-link`, extension URL: https://marketplace.visualstudio.com/items?itemName=inkan-link.debugpilot

## Debug Session Observations (live testing)
- Exception breakpoints default to breaking on ALL exceptions (caught + uncaught)
- Third-party extensions (Bun, LLDB) throw caught exceptions during activation
- Setting filters to `["uncaught"]` avoids noise from other extensions
