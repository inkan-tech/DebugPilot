# DebugPilot — Task Plan

## Goal

Ship DebugPilot as a complete MCP debug server — subscriptions, prompts, and polished DX.

**Current version**: v0.7.3 | **155 tests** | **21 tools** | Published on VS Code Marketplace

---

## Phase 1: Core Read Tools (MVP) — COMPLETE

- [x] Extension scaffold, Streamable HTTP transport
- [x] 6 read-only tools: sessions, state, variables, evaluate, console, breakpoints_list
- [x] Unit tests for all tools

## Phase 2: Write Control — COMPLETE

- [x] `debug_continue`, `debug_step`, `debug_pause`
- [x] `debug_breakpoint_set`, `debug_breakpoint_remove`
- [x] `debug_exception_config`
- [x] `debug_launch`, `debug_stop`
- [x] `debug_logpoint_set`, `debug_run_to`
- [x] `debug_hot_reload`, `debug_hot_restart` (Flutter/Dart)
- [x] Unit tests for all 12 control tools
- [x] Integration test framework (10 tests: HTTP, MCP protocol, tool registration)

## Phase 3: Subscriptions + Prompts — COMPLETE

- [x] MCP Resources: `debug://sessions`, `debug://console/{sessionId}`, `debug://breakpoints`, `debug://diagnostics`
- [x] Event Notifications: breakpoint hit, exception, session start/stop
- [x] Pre-built Prompts: `debug_investigate`, `debug_trace`
- [x] Tests for resources (11), prompts (6), integration (12)

## Phase 4: Polish, Robustness & DX — COMPLETE

- [x] Status bar item with live state updates
- [x] Graceful error handling, expression timeout
- [x] Session reconnect after extension reload
- [x] VS Code walkthrough, command palette integration

## Phase 5: Live Streaming & Agent Integration — COMPLETE

- [x] R1: Enhanced Status Bar (idle/running/paused/exception states)
- [x] R2: WebSocket broker (bidirectional, same port, event push + request/response)
- [x] R3: Console output streaming via WS events
- [x] R5: `debug_watch` long-poll MCP tool
- [x] R6: `debug_diagnostics` tool + `debug://diagnostics` resource + DiagnosticsWatcher
- [x] `debug_console_history` — console from terminated/crashed sessions
- [x] Dart auto-config: exception breakpoints → "Unhandled" only
- [x] `debug_evaluate` context param (watch/repl/hover, default: watch)
- [x] dpctl CLI script (sessions, state, watch, stream, repl, history)

## Phase 6: Skill Documentation Rewrite — COMPLETE

- [x] Fix protocol format (remove false `jsonrpc: "2.0"`, use actual `{id, method, params}`)
- [x] Document all 21 MCP tools (was 18)
- [x] Document all 19 WS dispatch methods (was 14)
- [x] Document WS event push + subscription protocol (6 event types)
- [x] Replace polling monitor template with event-driven streaming template
- [x] Add `debug_watch`, `debug_diagnostics`, `debug_console_history` to workflow
- [x] Add `evaluate` context param documentation (watch/repl/hover)
- [x] Document Dart auto-exception-config behavior
- [x] Add decision guide: MCP vs WS table

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | Streamable HTTP (port 45853) | Avoids OAuth/SSE issues |
| Build | esbuild | Fast, single-file output |
| Tests | vitest | Fast TS support |
| WS protocol | Custom `{id, method, params}` | Simpler than JSON-RPC, sufficient for local use |
| Event push | WS subscribe/broadcast | Real-time, no polling needed |
| Evaluate context | Default "watch" | Works for Dart/Flutter locals (repl fails) |
| Dart exceptions | Auto-config "Unhandled" | Avoids MissingPluginException false stops |
