## Connect Your AI Agent

With your MCP client configured, your AI agent can now interact with VS Code's debugger.

### Verify the connection

Ask your agent to run the `debug_sessions` tool. It should return a list of active debug sessions (or an empty list if none are running).

### What the agent can do

Your AI agent can now:

- List and inspect debug sessions
- Read the current execution state (paused location, source code, call stack)
- Inspect variables at any scope
- Evaluate expressions in the debugger context
- Set and remove breakpoints
- Control execution (step, continue, pause)
- Read debug console output

### Claude Code skill (optional)

For the best experience with Claude Code, install the `/debugpilot` skill:

```bash
cp -r skills/debugpilot ~/.claude/skills/debugpilot
```

This teaches Claude the optimal debug workflow so it calls the right tools in the right order.
