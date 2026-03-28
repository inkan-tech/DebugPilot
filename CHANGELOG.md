# Changelog

## [0.10.1] - 2026-03-28

### Added

- `debugPilot.startMode` setting — `"lazy"` (default) or `"auto"` to control when the MCP server starts
- Lazy start mode: MCP server starts on first debug session or manual trigger instead of immediately on VS Code open
- `debugpilot.start` command — manually start the MCP server
- `debugpilot.stop` command — stop the server and free the port
- Status bar "waiting" state with click-to-start affordance in lazy mode
- Extension activation tests for lazy/auto mode behavior (22 tests)
- Release checklist in CLAUDE.md

### Changed

- Default start behavior changed from auto to lazy — set `debugPilot.startMode: "auto"` to restore previous behavior
- Server lifecycle extracted into start/stop functions for clean command-driven control
- Getting Started walkthrough updated to explain lazy start default
- README updated with Start Modes section, new commands, and `startMode` setting documentation

## [0.7.0] - 2026-03-12

### Added

- MCP resources: `debug://sessions`, `debug://console/{sessionId}`, `debug://breakpoints`
- MCP prompts: `debug_investigate` (full bug analysis context), `debug_trace` (execution tracing)
- Phase 2 tools: `debug_launch`, `debug_stop`, `debug_logpoint_set`, `debug_run_to`
- Integration test framework with MCP HTTP protocol tests
- Tool registration validation tests (18 tools verified)

## [0.6.2] - 2026-03-12

### Changed

- Redesigned logo with debug beetle motif replacing pilot helmet
- New icon optimized for 128px rendering (marketplace/sidebar)
- Removed rejected helmet variant

## [0.6.1] - 2026-03-12

### Changed

- Improved tool descriptions to guide agents to call `debug_sessions` first for sessionId
- All sessionId params now reference `debug_sessions` in their descriptions
- `debug_breakpoint_remove` now references `debug_breakpoints_list` for IDs

## [0.6.0] - 2026-03-11

### Added

- Flutter/Dart support: `debug_hot_reload` and `debug_hot_restart` tools
- Generic `customRequest` method on IDebugAdapter for runtime-specific DAP extensions
- Dart exception filter IDs (`"All"`, `"Unhandled"`) documented in `debug_exception_config`
- Flutter hot reload usage example in README

### Changed

- License changed from MIT to Apache 2.0
- Version bumped to 0.6.0

## [0.5.0] - 2026-03-11

### Added

- Published to VS Code Marketplace as pre-release (`inkan-link.debugpilot`)
- `publish-vsce` Claude Code skill for automated publishing
- Publishing guide (`docs/publish.md`)
- `claude mcp add` CLI command documented in README

### Changed

- Publisher corrected to `inkan-link`

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
