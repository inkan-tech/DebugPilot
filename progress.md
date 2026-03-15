# DebugPilot — Progress Log

## Session: 2026-03-15 (current)

### Completed

- Phase 5 fully implemented: WebSocket broker, event push, diagnostics, watch, console history
- `debug_evaluate` default context changed from "repl" to "watch" (fixes Dart locals)
- Dart sessions auto-configure exception breakpoints to "Unhandled" only
- `debug_console_history` tool — inspect console from terminated/crashed sessions
- dpctl CLI: full WS-based CLI with REPL, streaming, history commands
- 155 tests passing, v0.7.3

### Current: Phase 6 — Skill Documentation Rewrite

- Audited SKILL.md against codebase: 8 discrepancies found (see findings.md)
- Key gaps: 3 missing tools, wrong protocol format, undocumented event push
- Rewriting SKILL.md with accurate protocol, all 21 tools, 19 WS methods, event subscription

### Key Stats

- **21 tools** registered (6 read + 12 control + 3 streaming/diagnostics)
- **19 WS dispatch methods** (bidirectional)
- **6 event types** pushed via WS subscription
- **25 test files**, 155 tests, <1.6s total runtime

---

## Session: 2026-03-12

### Completed

- Phase 2 fully complete: 4 new tools (launch, stop, logpoint, run_to)
- Integration test framework: HTTP server tests, MCP protocol tests, tool registration
- 96 tests total, all passing
- Published v0.6.2 to Marketplace + GitHub release

---

## Session: 2026-03-11

### Completed

- Phase 1 + Phase 2 core tools implemented
- Streamable HTTP transport on port 45853
- Published v0.5.0 → v0.6.0 (Flutter support) → v0.6.1 (tool descriptions)
- 77 tests passing
- Live-tested with Bun and Node debuggers
