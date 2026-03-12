## Available Debug Tools

DebugPilot exposes these MCP tools to your AI agent:

### Inspection

| Tool | Description |
|------|-------------|
| `debug_sessions` | List active debug sessions |
| `debug_state` | Current location, source, locals, and call stack |
| `debug_variables` | Get and expand variables by scope |
| `debug_evaluate` | Evaluate an expression in the current frame |
| `debug_console` | Read buffered debug console output |
| `debug_breakpoints_list` | List all breakpoints |

### Control

| Tool | Description |
|------|-------------|
| `debug_launch` | Launch a new debug session |
| `debug_continue` | Resume execution |
| `debug_pause` | Pause execution |
| `debug_step` | Step over, into, or out |
| `debug_run_to` | Run to a specific line |
| `debug_stop` | Stop the debug session |

### Breakpoints

| Tool | Description |
|------|-------------|
| `debug_breakpoint_set` | Set a breakpoint |
| `debug_breakpoint_remove` | Remove a breakpoint |
| `debug_logpoint_set` | Set a logpoint (log without stopping) |
| `debug_exception_config` | Configure exception breakpoints |

### Example prompt

> "Set a breakpoint at line 42 of app.ts, then run the program. When it hits the breakpoint, show me all local variables and evaluate `this.state`."
