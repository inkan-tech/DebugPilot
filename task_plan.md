# DebugPilot — Task Plan

## Goal
Ship DebugPilot as a complete MCP debug server — subscriptions, prompts, and polished DX.

**Current version**: v0.6.2 | **96 tests** | **18 tools** | Published on VS Code Marketplace

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

## Phase 3: Subscriptions + Prompts — IN PROGRESS
Agent reacts to debug events in real-time.

### 3a: MCP Resources with Subscriptions
- [ ] `debug://sessions` — live list of debug sessions (subscribable)
- [ ] `debug://console/{sessionId}` — live console stream
- [ ] `debug://breakpoints` — current breakpoint list (updates on add/remove/hit)

### 3b: Event Notifications
- [ ] Breakpoint hit notification
- [ ] Exception thrown notification
- [ ] Session start/stop notifications

### 3c: Pre-built Prompts
- [ ] `debug_investigate` — "A breakpoint was hit. Analyze the bug."
  - Gathers: state, locals, call stack, recent console, source context
- [ ] `debug_trace` — "Trace execution from A to B."
  - Sets temp breakpoints/logpoints, collects data, returns trace

### 3d: Tests
- [ ] Unit tests for resources
- [ ] Unit tests for prompts
- [ ] Integration tests for subscription flow

## Phase 4: Polish, Robustness & DX — NOT STARTED

### 4a: Distribution
- [ ] Submit to MCP server registry
- [ ] Marketplace SEO (keywords, categories, screenshots)
- [ ] README badges (installs, version, license)

### 4b: Robustness
- [ ] Graceful handling: no active session, detached session
- [ ] Expression evaluation timeout + cancellation
- [ ] Session reconnect after extension reload
- [ ] Actionable error messages (not raw DAP errors)

### 4c: Developer Experience
- [ ] Status bar item showing MCP server state + port
- [ ] VS Code walkthrough (Getting Started)
- [ ] Example `.mcp.json` configs for Claude Code, Cursor, Continue.dev
- [ ] Command palette: "DebugPilot: Show Connection Info"

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
