---
name: debugpilot
description: >
  Debug applications through VS Code using DebugPilot MCP tools.
  Connects to VS Code's debugger to inspect state, set breakpoints, step through code,
  and analyze bugs — all without leaving Claude Code.
  Use when: (1) VS Code debugger is running and you need to inspect state,
  (2) investigating a bug with breakpoints, (3) stepping through execution,
  (4) evaluating expressions in debug context, (5) the user says "debug" and
  has VS Code open with DebugPilot installed.
  Triggers: "debug this", "inspect variables", "set breakpoint", "step through",
  "what's the value of", "why is this failing", "trace execution", "debugpilot".
---

# DebugPilot — VS Code Debug via MCP

Debug applications through VS Code's debugger using DebugPilot MCP tools. Requires the DebugPilot VS Code extension running on `http://127.0.0.1:45853/mcp`.

## Quick Start

```
1. Always call debug_sessions FIRST to get sessionId
2. Call debug_state with the sessionId to see where execution is paused
3. Use debug_variables, debug_evaluate to inspect values
4. Use debug_continue, debug_step to advance execution
```

## Debug Workflow

### 1. Find active sessions

Always start here. Get the sessionId needed by all other tools.

```
→ mcp__debugpilot__debug_sessions
```

### 2. Get full state (location, source, locals, stack)

```
→ mcp__debugpilot__debug_state { sessionId: "..." }
```

### 3. Inspect variables

```
→ mcp__debugpilot__debug_variables { sessionId: "...", variableReference: 10 }
→ mcp__debugpilot__debug_evaluate { sessionId: "...", expression: "user.email" }
```

### 4. Control execution

```
→ mcp__debugpilot__debug_continue { sessionId: "..." }
→ mcp__debugpilot__debug_step { sessionId: "...", type: "over" }  // over | into | out
→ mcp__debugpilot__debug_pause { sessionId: "..." }
```

### 5. Manage breakpoints

```
→ mcp__debugpilot__debug_breakpoint_set { file: "/path/to/file.ts", line: 42 }
→ mcp__debugpilot__debug_breakpoint_set { file: "/path/to/file.ts", line: 42, condition: "x > 10" }
→ mcp__debugpilot__debug_breakpoints_list
→ mcp__debugpilot__debug_breakpoint_remove { id: "BP#1" }
```

### 6. Launch / Stop sessions

```
→ mcp__debugpilot__debug_launch { configName: "Launch Program" }
→ mcp__debugpilot__debug_stop { sessionId: "..." }
```

### 7. Console output

```
→ mcp__debugpilot__debug_console { sessionId: "..." }
```

### 8. Advanced

```
→ mcp__debugpilot__debug_logpoint_set { file: "...", line: 42, message: "value=${x}" }
→ mcp__debugpilot__debug_run_to { sessionId: "...", file: "...", line: 50 }
→ mcp__debugpilot__debug_exception_config { sessionId: "...", filters: ["uncaught"] }
→ mcp__debugpilot__debug_hot_reload { sessionId: "..." }   // Flutter/Dart
→ mcp__debugpilot__debug_hot_restart { sessionId: "..." }  // Flutter/Dart
```

## Investigation Pattern

When a user reports a bug or wants to understand runtime behavior:

1. **Get sessions** → identify which session is paused
2. **Get state** → see where execution stopped, read source context
3. **Inspect locals** → check variable values at the pause point
4. **Evaluate expressions** → test hypotheses about the bug
5. **Step through** → advance execution to observe behavior
6. **Analyze** → explain what's happening and suggest fixes

## Tips

- Always call `debug_sessions` first — every other tool needs a `sessionId`
- `debug_state` returns source context around the pause point — usually enough to understand the situation
- Use `debug_evaluate` to test fix hypotheses without modifying code
- `debug_step` with `type: "over"` skips into function calls, `"into"` enters them, `"out"` returns to caller
- Set conditional breakpoints to pause only when the bug condition is met
- Use `debug_console` to see recent stdout/stderr output
- Multiple sessions can be active simultaneously — check each one
