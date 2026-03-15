# DebugPilot WebSocket API

**Endpoint:** `ws://127.0.0.1:45853/ws`

Single bidirectional WebSocket connection for both **push events** and **request/response** calls. No session negotiation, no JSON-RPC framing, no schema overhead.

## Connection

```
wscat -c ws://127.0.0.1:45853/ws
```

Max 10 concurrent clients. Heartbeat ping/pong every 30s — idle clients get terminated.

---

## Message Types

### 1. Push Events (Server → Client)

Events are pushed automatically based on your subscription filter.

```jsonc
{
  "type": "stopped",              // event type
  "sessionId": "abc-123",         // debug session ID (when applicable)
  "timestamp": "2026-03-14T...",  // ISO 8601
  "data": {                       // event-specific payload
    "sessionId": "abc-123",
    "reason": "exception"
  }
}
```

**Event types:**

| type | data fields | trigger |
|------|-------------|---------|
| `session.started` | `sessionId, name, type` | debug session launched |
| `session.terminated` | `sessionId` | debug session ended |
| `stopped` | `sessionId, reason` | breakpoint/exception/step/pause |
| `continued` | `sessionId` | execution resumed |
| `console.output` | `sessionId, message{type,text,timestamp}` | debuggee prints to console |
| `diagnostics.changed` | `files[]` | linter/type errors changed |

### 2. Subscriptions (Client → Server)

Subscribe to specific events:

```jsonc
{"action": "subscribe", "events": ["stopped", "console.output"]}
```

Subscribe to all events:

```jsonc
{"action": "subscribe", "events": ["*"]}
```

Filter by debug session:

```jsonc
{"action": "subscribe", "events": ["*"], "sessionId": "abc-123"}
```

Unsubscribe:

```jsonc
{"action": "unsubscribe", "events": ["console.output"]}
```

Default on connect: subscribed to `["*"]` (all events).

### 3. Request/Response (Client → Server → Client)

Send a request with `id` and `method`, receive a response with matching `id`.

```jsonc
// Request
{"id": 1, "method": "state", "params": {"sessionId": "abc-123"}}

// Response (success)
{"id": 1, "result": {"paused": true, "reason": "breakpoint", ...}}

// Response (error)
{"id": 1, "error": "Session \"xyz\" not found."}
```

The `id` field correlates requests with responses — use incrementing integers or UUIDs. Push events have no `id` field.

---

## Methods Reference

### Read Methods

| method | params | returns |
|--------|--------|---------|
| `sessions` | _(none)_ | `SessionInfo[]` |
| `state` | `{sessionId}` | `DebugState` (paused, reason, location, source, locals, callStack) |
| `variables` | `{sessionId, variableReference, depth?}` | `Variable[]` |
| `evaluate` | `{sessionId, expression, frameId?}` | `{result, type?, variableReference}` |
| `console` | `{sessionId, since?, pattern?}` | `ConsoleMessage[]` |
| `breakpoints` | _(none)_ | `BreakpointInfo[]` |
| `diagnostics` | `{file?}` | `DiagnosticInfo[]` |

### Control Methods

| method | params | returns |
|--------|--------|---------|
| `continue` | `{sessionId, threadId?}` | `{ok: true}` |
| `step` | `{sessionId, type?: "over"\|"into"\|"out", threadId?}` | `{ok: true}` |
| `pause` | `{sessionId, threadId?}` | `{ok: true}` |
| `stop` | `{sessionId}` | `{ok: true}` |
| `launch` | `{configName}` | `{sessionId, status}` |
| `setBreakpoint` | `{file, line, condition?, logMessage?}` | `BreakpointInfo` |
| `removeBreakpoint` | `{id}` | `{ok: true}` |
| `setExceptionBreakpoints` | `{sessionId, filters[]}` | `{ok: true}` |
| `runTo` | `{sessionId, file, line}` | `{ok: true}` |
| `setLogpoint` | `{file, line, message, condition?}` | `BreakpointInfo` |
| `customRequest` | `{sessionId, command, args?}` | DAP response |

---

## Type Definitions

```typescript
interface SessionInfo {
  id: string;
  name: string;
  type: string;
  status: "running" | "paused" | "stopped";
  pauseReason?: "breakpoint" | "exception" | "step" | "pause";
}

interface DebugState {
  paused: boolean;
  reason?: string;
  location?: { file: string; line: number; column?: number; function?: string };
  source?: { lines: Array<{ line: number; text: string; current?: boolean }>; contextLines: number };
  locals: Variable[];
  callStack: StackFrame[];
}

interface Variable {
  name: string;
  value: string;
  type?: string;
  variableReference: number;
  children?: Variable[];
}

interface StackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  column?: number;
}

interface ConsoleMessage {
  type: "stdout" | "stderr" | "console" | "debug";
  text: string;
  timestamp: string;
}

interface BreakpointInfo {
  id: string;
  file: string;
  line: number;
  enabled: boolean;
  condition?: string;
}

interface DiagnosticInfo {
  file: string;
  severity: "error" | "warning" | "info" | "hint";
  range: { startLine: number; startCol: number; endLine: number; endCol: number };
  message: string;
  source?: string;
  code?: string | number;
}
```

---

## Examples

### Wait for breakpoint hit, then inspect state

```javascript
const ws = new WebSocket("ws://127.0.0.1:45853/ws");

ws.on("open", () => {
  ws.send(JSON.stringify({ action: "subscribe", events: ["stopped"] }));
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw);

  // Push event — breakpoint hit
  if (msg.type === "stopped") {
    console.log("Stopped:", msg.data.reason);

    // Immediately request state over same connection
    ws.send(JSON.stringify({
      id: 1,
      method: "state",
      params: { sessionId: msg.sessionId }
    }));
  }

  // Response to our state request
  if (msg.id === 1) {
    console.log("State:", JSON.stringify(msg.result, null, 2));
    // Step over
    ws.send(JSON.stringify({
      id: 2,
      method: "step",
      params: { sessionId: msg.result.callStack?.[0] ? "..." : "...", type: "over" }
    }));
  }
});
```

### Interactive debugging loop (dpctl repl)

```
$ dpctl repl
dp> sessions
[{"id":"abc-123","name":"Launch","type":"node","status":"paused"}]

dp> state {"sessionId":"abc-123"}
{
  "paused": true,
  "reason": "breakpoint",
  "location": {"file":"/app/index.ts","line":42,"function":"handleRequest"},
  "locals": [{"name":"req","value":"IncomingMessage","type":"object","variableReference":5}],
  ...
}

dp> evaluate {"sessionId":"abc-123","expression":"req.url"}
{"result":"\"/api/users\"","type":"string","variableReference":0}

dp> step {"sessionId":"abc-123","type":"over"}
{"ok":true}

EVENT: {"type":"stopped","sessionId":"abc-123","data":{"reason":"step"}}

dp> continue {"sessionId":"abc-123"}
{"ok":true}
```

---

## MCP vs WebSocket: Token Cost Comparison

| Operation | MCP (tokens) | WebSocket (tokens) |
|-----------|-------------|-------------------|
| Get debug state | ~800 (tool call + schema + JSON-RPC envelope) | ~120 (method + params + result) |
| Step + get state | ~1600 (2 tool calls) | ~240 (2 messages) |
| Watch for event | ~500 (debug_watch tool call) | ~80 (subscribe + event) |
| 10-step debug loop | ~8000+ | ~1200 |

The WebSocket protocol is **~6-7x more token-efficient** than MCP for the same operations.
