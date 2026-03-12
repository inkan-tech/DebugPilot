## Start a Debug Session

DebugPilot works with any debug session in VS Code.

### Quick start

1. Open a file you want to debug
2. Set a breakpoint by clicking in the gutter (left of line numbers)
3. Press **F5** or use **Run > Start Debugging**

### No launch.json?

VS Code can auto-detect many project types. For Node.js, just open a `.js` or `.ts` file and press F5.

For other languages, create a `launch.json` via **Run > Add Configuration**.

Once a debug session is active, DebugPilot exposes it to your AI agent through MCP tools.
