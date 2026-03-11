# PRD-014: VS Code Debug MCP Server

**Status**: Draft
**Priority**: High
**Created**: 2026-03-11
**Target**: Open-source VS Code extension + MCP server

## Problem

AI coding agents (Claude Code, Cursor, Copilot, Cline, Aider) cannot access VS Code's debug session. When a breakpoint hits, the agent is blind — it can't see variables, call stacks, console output, or evaluate expressions. Users must copy-paste debug state manually, breaking flow.

The VS Code Debug Adapter Protocol (DAP) is rich and standardized. No MCP server exposes it today.

## Solution

Build a VS Code extension that runs an MCP server exposing the Debug Adapter Protocol. Any AI agent with MCP support can then:

- Read debug console output
- Inspect variables at breakpoints
- Evaluate expressions in paused frames
- Read call stacks with source locations
- Set/remove breakpoints programmatically
- Control execution (continue, step, pause)
- React to debug events (breakpoint hit, exception thrown)

## Target Users

- AI coding agents (Claude Code, Cursor, Cline, Aider, Continue.dev)
- Developers who use AI assistants during debugging sessions
- Teams building AI-powered developer tools

## Non-Goals

- Replacing VS Code's debug UI
- Supporting debuggers outside VS Code (standalone DAP clients)
- Building a new debug adapter (we wrap existing ones)

---

## Architecture

```
┌─────────────┐     MCP (stdio/SSE)     ┌──────────────────┐
│  AI Agent   │ ◄──────────────────────► │  MCP Server      │
│ (Claude Code│                          │  (in extension)  │
│  Cursor etc)│                          └────────┬─────────┘
└─────────────┘                                   │
                                                  │ vscode.debug API
                                                  ▼
                                          ┌───────────────┐
                                          │ VS Code Debug  │
                                          │ Adapter (DAP)  │
                                          │ Node/Bun/LLDB/ │
                                          │ Python/Go/...  │
                                          └───────────────┘
```

The extension activates when VS Code starts, registers an MCP server (stdio transport for Claude Code, SSE for remote agents), and proxies requests to `vscode.debug.*` APIs.

---

## MCP Tools

### Session Management

#### `debug_sessions`

List active debug sessions.

```json
// Response
{
  "sessions": [
    {
      "id": "abc123",
      "name": "Bot (debug)",
      "type": "bun",
      "status": "paused",  // "running" | "paused" | "stopped"
      "pauseReason": "breakpoint",  // "breakpoint" | "exception" | "step" | "pause"
      "pauseLocation": {
        "file": "packages/bot/src/index.ts",
        "line": 517,
        "column": 3
      }
    }
  ]
}
```

#### `debug_launch`

Launch a debug configuration by name.

```json
// Request
{ "configuration": "Bot (debug)" }
// Response
{ "sessionId": "abc123", "status": "running" }
```

#### `debug_stop`

Stop a debug session.

```json
{ "sessionId": "abc123" }
```

### Inspection (requires paused session)

#### `debug_state`

Get full debug state: pause location, source context, locals, call stack. The primary "what's happening?" tool.

```json
// Request
{ "sessionId": "abc123" }
// Response
{
  "paused": true,
  "reason": "breakpoint",
  "location": {
    "file": "packages/bot/src/index.ts",
    "line": 517,
    "function": "admitVerifiedParticipant"
  },
  "source": {
    "lines": [
      { "line": 515, "text": "  const now = new Date().toISOString();" },
      { "line": 516, "text": "" },
      { "line": 517, "text": "► if (!meetingStore.getMeeting(meetingId)) {", "current": true },
      { "line": 518, "text": "    meetingStore.addMeeting({" },
      { "line": 519, "text": "      id: meetingId," }
    ],
    "contextLines": 5
  },
  "locals": [
    { "name": "meetingId", "value": "\"test-meeting-001\"", "type": "string" },
    { "name": "participantId", "value": "\"guest-alice\"", "type": "string" },
    { "name": "email", "value": "\"alice@test.com\"", "type": "string" },
    { "name": "displayName", "value": "\"Alice\"", "type": "string" },
    { "name": "reason", "value": "\"mock-sealfie\"", "type": "string" }
  ],
  "callStack": [
    { "id": 0, "name": "admitVerifiedParticipant", "file": "index.ts", "line": 517 },
    { "id": 1, "name": "<anonymous>", "file": "mock-verification.ts", "line": 52 },
    { "id": 2, "name": "Timeout._onTimeout", "file": "timers.js", "line": 573 }
  ]
}
```

#### `debug_variables`

Get variables for a specific scope or expand an object.

```json
// Request — get all scopes for a frame
{ "sessionId": "abc123", "frameId": 0 }
// Request — expand a variable
{ "sessionId": "abc123", "variableReference": 42, "depth": 2 }
```

#### `debug_evaluate`

Evaluate an expression in the context of a paused frame.

```json
// Request
{ "sessionId": "abc123", "expression": "meetingStore.getParticipants(meetingId).length", "frameId": 0 }
// Response
{ "result": "3", "type": "number" }
```

#### `debug_console`

Read debug console output (stdout, stderr, console.log, debugger messages).

```json
// Request
{ "sessionId": "abc123", "since": "2026-03-11T14:30:00Z", "pattern": "\\[Lobby\\]" }
// Response
{
  "messages": [
    { "type": "stdout", "text": "[Lobby] Verified alice@test.com → admitted", "timestamp": "..." },
    { "type": "stderr", "text": "[Lobby] ACS unavailable, fallback mode", "timestamp": "..." }
  ]
}
```

### Breakpoints

#### `debug_breakpoints_list`

List all breakpoints.

```json
{
  "breakpoints": [
    { "id": "BP#1", "file": "index.ts", "line": 517, "enabled": true, "condition": null, "hitCount": 2 },
    { "id": "BP#2", "file": "mock-verification.ts", "line": 38, "enabled": true, "condition": "level === 'shareid'" }
  ]
}
```

#### `debug_breakpoint_set`

Set a breakpoint.

```json
// Request
{ "file": "packages/bot/src/index.ts", "line": 517, "condition": "participantId === 'guest-alice'" }
// Response
{ "id": "BP#3", "verified": true }
```

#### `debug_breakpoint_remove`

```json
{ "id": "BP#3" }
```

#### `debug_logpoint_set`

Set a logpoint (logs without pausing).

```json
{ "file": "index.ts", "line": 520, "message": "meetingId={meetingId} participant={participantId}" }
```

### Execution Control

#### `debug_continue`

Resume execution.

#### `debug_step`

Step over / into / out.

```json
{ "sessionId": "abc123", "type": "over" }  // "over" | "into" | "out"
```

#### `debug_pause`

Pause a running session.

#### `debug_run_to`

Run to a specific line (temporary breakpoint).

```json
{ "sessionId": "abc123", "file": "index.ts", "line": 580 }
```

### Exception Handling

#### `debug_exception_config`

Configure exception breakpoints.

```json
{ "uncaught": true, "caught": false }
```

---

## MCP Resources

#### `debug://sessions`

Live list of debug sessions (subscribable).

#### `debug://console/{sessionId}`

Live debug console stream (subscribable). Agents can subscribe and get real-time output.

#### `debug://breakpoints`

Current breakpoint list (subscribable — updates on add/remove/hit).

---

## MCP Prompts

#### `debug_investigate`

Pre-built prompt: "A breakpoint was hit. Here's the full state. Analyze the bug."

Automatically gathers: state, locals, call stack, recent console output, source context. Returns a structured prompt the agent can reason over.

#### `debug_trace`

Pre-built prompt: "Trace execution from point A to point B." Sets temporary breakpoints and logpoints, collects data, returns execution trace.

---

## Implementation Plan

### Phase 1: Core Read (MVP)

**Goal**: Agent can see what's happening in the debugger.

| Task | Effort |
|------|--------|
| VS Code extension scaffold (TypeScript, esbuild) | S |
| MCP server with stdio transport | M |
| `debug_sessions` — list sessions | S |
| `debug_state` — location + source + locals + stack | M |
| `debug_variables` — expand objects | M |
| `debug_evaluate` — eval expressions | S |
| `debug_console` — read output with filtering | M |
| `debug_breakpoints_list` — list breakpoints | S |
| Test with Claude Code + Bun debugger | M |
| Test with Claude Code + Node debugger | S |
| Test with Claude Code + Python debugger | S |

### Phase 2: Write Control

**Goal**: Agent can control the debugger.

| Task | Effort |
|------|--------|
| `debug_launch` / `debug_stop` | S |
| `debug_continue` / `debug_step` / `debug_pause` | S |
| `debug_breakpoint_set` / `_remove` | S |
| `debug_logpoint_set` | S |
| `debug_run_to` | S |
| `debug_exception_config` | S |

### Phase 3: Subscriptions + Prompts

**Goal**: Agent reacts to debug events in real-time.

| Task | Effort |
|------|--------|
| MCP resources with subscriptions | M |
| `debug://console/{id}` live stream | M |
| Event notifications (breakpoint hit, exception) | M |
| `debug_investigate` prompt | S |
| `debug_trace` prompt | M |

### Phase 4: Multi-Runtime Validation

| Runtime | Debug Adapter | Priority |
|---------|---------------|----------|
| Node.js | `node` / `pwa-node` | P0 |
| Bun | `bun` | P0 |
| Python | `debugpy` | P1 |
| Go | `dlv` | P2 |
| Rust | `lldb` / `codelldb` | P2 |
| C/C++ | `cppdbg` / `lldb` | P2 |
| Java | `java` | P3 |

---

## Key Technical Decisions

### Transport: stdio (not SSE)

Claude Code and most AI agents use stdio for MCP. The extension spawns a child process or communicates via the extension host. SSE can be added later for remote agents.

### Buffering console output

Debug console messages are ephemeral in VS Code. The extension must buffer them (ring buffer, configurable size, default 10K messages) so agents can query historical output.

### Source context

`debug_state` returns source lines around the current position. The extension reads the file directly (not from DAP) to guarantee accuracy. Configurable context window (default: 10 lines above/below).

### Variable depth limits

Deep object trees can be huge. Default expand depth is 1 (immediate properties). Agent can request deeper expansion explicitly via `debug_variables` with `depth` param. Max depth: 5.

### Security

- Extension only exposes debug state to the local MCP connection
- No remote access by default (SSE transport is opt-in)
- No ability to modify source files (read-only debug inspection)
- Expressions evaluated in `debug_evaluate` run in the debuggee's context — same security model as VS Code's debug console

---

## Success Metrics

- Agent can diagnose a bug using only MCP tools (no copy-paste from user)
- < 200ms latency for `debug_state` response
- Works with Node, Bun, Python debuggers out of the box
- 50+ GitHub stars in first month (open-source traction)

## Prior Art

- `dbg` CLI (used in this project) — CDP only, no VS Code integration
- VS Code's built-in Debug Adapter Protocol — not exposed via MCP
- `mcp__ide__getDiagnostics` — reads linter errors only, not debug state
- Anthropic's `claude-debugs-for-you` agent — has the workflow but lacks the tooling

## Distribution

- **VS Code Marketplace**: `debug-mcp-server` extension
- **npm**: `@anthropic/debug-mcp-server` (for standalone use)
- **GitHub**: open-source, MIT license
- **MCP registry**: listed in the official MCP server directory

---

## Open Questions

1. Should `debug_evaluate` support `await` expressions? (Depends on runtime support)
2. Should the extension auto-activate on any debug session, or require explicit opt-in?
3. How to handle multiple simultaneous debug sessions? (compound launches)
4. Should we support conditional tool availability? (e.g., `debug_step` only available when paused)
5. Should we build this as a standalone repo or as part of the Claude Code VS Code extension?
