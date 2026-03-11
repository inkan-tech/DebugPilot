# Changelog

## [0.2.0] - 2026-03-11

### Added
- Phase 2 debug control tools: `debug_continue`, `debug_step`, `debug_pause`, `debug_breakpoint_set`, `debug_breakpoint_remove`, `debug_exception_config`
- Streamable HTTP transport on `127.0.0.1:45853` (replaces stdio)
- `/health` and `/shutdown` HTTP endpoints
- Port reclaim logic for stale instances
- CORS headers for local dev tools
- Extension logo and icon

### Changed
- Transport migrated from stdio to Streamable HTTP
- Version bumped to 0.2.0

## [0.1.0] - 2026-03-11

### Added
- Initial VS Code extension scaffold with esbuild bundling
- MCP server with Phase 1 read-only tools:
  - `debug_sessions` — list active debug sessions
  - `debug_state` — full debug state (location, source, locals, call stack)
  - `debug_variables` — get/expand variables with depth control
  - `debug_evaluate` — evaluate expressions in paused frames
  - `debug_console` — buffered console output with regex filtering
  - `debug_breakpoints_list` — list all breakpoints
- Session manager with per-session console ring buffers
- Source reader for context lines around breakpoints
- Configurable settings: buffer size, variable depth, context lines
