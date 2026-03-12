# DebugPilot — Task Plan

## Goal

Ship DebugPilot as a complete MCP debug server — subscriptions, prompts, and polished DX.

**Current version**: v0.7.0 | **155 tests** | **18 tools** | Published on VS Code Marketplace

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

Agent reacts to debug events in real-time.

### 3a: MCP Resources with Subscriptions

- [x] `debug://sessions` — live list of debug sessions
- [x] `debug://console/{sessionId}` — live console stream
- [x] `debug://breakpoints` — current breakpoint list

### 3b: Event Notifications

- [x] Breakpoint hit notification
- [x] Exception thrown notification
- [x] Session start/stop notifications

### 3c: Pre-built Prompts

- [x] `debug_investigate` — "A breakpoint was hit. Analyze the bug."
  - Gathers: state, locals, call stack, recent console, source context
- [x] `debug_trace` — "Trace execution from A to B."
  - Location, stack, locals, console context

### 3d: Tests

- [x] Unit tests for resources (11 tests)
- [x] Unit tests for prompts (6 tests)
- [x] Integration tests for resources + prompts (12 tests)

## Phase 4: Polish, Robustness & DX — IN PROGRESS

### 4a: Distribution

- [ ] Submit to MCP server registry
- [x] Marketplace SEO (keywords, categories, screenshots)
- [x] README badges (installs, version, license)
- [x] Example `.mcp.json` configs for Claude Code, Cursor, Continue.dev

### 4b: Robustness

- [x] Graceful handling: no active session, detached session (#35)
- [x] Expression evaluation timeout + cancellation
- [x] Session reconnect after extension reload (#36)
- [x] Actionable error messages (not raw DAP errors)

### 4c: Developer Experience

- [x] Status bar item showing MCP server state + port
- [x] VS Code walkthrough (Getting Started) (#37)
- [x] Command palette: "DebugPilot: Show Connection Info"

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | Streamable HTTP (port 45853) | Avoids OAuth/SSE issues |
| Build | esbuild | Fast, single-file output |
| Tests | vitest | Fast TS support |
| Activation | onStartupFinished | Always available |
| Phase 4 | No multi-runtime validation | We use vscode.debug.* — any VS Code debugger works automatically |
| Logo | Debug beetle + shield | Distinctive, scales well at 128px |
