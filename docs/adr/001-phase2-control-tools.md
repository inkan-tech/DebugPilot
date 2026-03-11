# ADR-001: Phase 2 Debug Control Tools

**Date**: 2026-03-11
**Status**: Accepted

## Context

Phase 1 (read-only tools) is complete. AI agents can inspect debug state but cannot control execution. Users must manually step, continue, and set breakpoints while the agent watches.

## Decision

Implement 6 control tools via `vscode.debug.activeDebugSession.customRequest()` DAP commands:

| Tool | DAP Command(s) | Notes |
|------|----------------|-------|
| `debug_continue` | `continue` | Requires threadId |
| `debug_step` | `next` / `stepIn` / `stepOut` | type param: over/into/out |
| `debug_pause` | `pause` | Requires threadId |
| `debug_breakpoint_set` | vscode.debug.addBreakpoints | Uses VS Code API, not DAP |
| `debug_breakpoint_remove` | vscode.debug.removeBreakpoints | Uses VS Code API, not DAP |
| `debug_exception_config` | `setExceptionBreakpoints` | uncaught/caught filters |

### Architecture

- Each tool in `src/tools/<name>.ts` following Phase 1 pattern
- New methods on `IDebugAdapter` interface for each operation
- Implementation in `VscodeDebugAdapter` using `session.customRequest()`
- Breakpoints use `vscode.debug.addBreakpoints/removeBreakpoints` (not DAP) since VS Code manages breakpoints globally
- threadId resolution: default to first thread (same as `debug_state`), accept optional param

### Safety

- `debug_step`/`debug_continue`/`debug_pause` are side-effect-free on the codebase (they only affect debuggee execution)
- `debug_breakpoint_set` is reversible via `debug_breakpoint_remove`
- `debug_exception_config` modifies VS Code breakpoint settings (persisted)

## Consequences

- IDebugAdapter grows from 6 to 12 methods
- Tests must mock the new methods
- Agents can now fully drive a debug session autonomously
