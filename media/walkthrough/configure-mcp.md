## Configure Your MCP Client

Add DebugPilot to your AI agent's MCP configuration. The default port is `4711`.

### Claude Desktop / Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "debugpilot": {
      "url": "http://127.0.0.1:4711/mcp"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "debugpilot": {
      "url": "http://127.0.0.1:4711/mcp"
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "debugpilot": {
      "serverUrl": "http://127.0.0.1:4711/mcp"
    }
  }
}
```

> **Tip:** Click **Show Connection Info** in the status bar to see the actual port and copy the URL.
