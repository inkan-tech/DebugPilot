import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import type { SessionManager } from "./session-manager.js";
import type { IDebugAdapter } from "./types.js";

const MAX_CLIENTS = 10;
const HEARTBEAT_INTERVAL_MS = 30_000;

/** Server → Client: push event */
export interface DebugEvent {
  type:
    | "session.started"
    | "session.terminated"
    | "stopped"
    | "continued"
    | "console.output"
    | "diagnostics.changed";
  sessionId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/** Client → Server: subscription */
interface SubscribeMessage {
  action: "subscribe" | "unsubscribe";
  events: string[];
  sessionId?: string;
}

/** Client → Server: request (gets a response) */
interface WsRequest {
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** Server → Client: response to a request */
interface WsResponse {
  id: string | number;
  result?: unknown;
  error?: string;
}

interface ClientState {
  alive: boolean;
  events: Set<string>;
  sessionFilter?: string;
}

/**
 * Bidirectional WebSocket broker.
 *
 * - Server pushes debug events to subscribers (DebugEvent)
 * - Client sends requests, gets responses (WsRequest → WsResponse)
 * - Client manages subscriptions (SubscribeMessage)
 *
 * All on a single persistent connection — no HTTP overhead per call.
 */
export class WebSocketBroker {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, ClientState>();
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private cleanups: Array<() => void> = [];

  constructor(
    httpServer: HttpServer,
    private readonly sessionManager: SessionManager,
    private readonly adapter?: IDebugAdapter,
  ) {
    this.wss = new WebSocketServer({ noServer: true });

    const onUpgrade = (
      request: import("node:http").IncomingMessage,
      socket: import("node:stream").Duplex,
      head: Buffer,
    ) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname !== "/ws") {
        socket.destroy();
        return;
      }

      if (this.clients.size >= MAX_CLIENTS) {
        socket.write("HTTP/1.1 503 Too Many Connections\r\n\r\n");
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit("connection", ws, request);
      });
    };

    httpServer.on("upgrade", onUpgrade);
    this.cleanups.push(() => httpServer.off("upgrade", onUpgrade));

    this.wss.on("connection", (ws) => this.handleConnection(ws));

    this.wireSessionEvents();
    this.startHeartbeat();
  }

  private handleConnection(ws: WebSocket): void {
    const state: ClientState = { alive: true, events: new Set(["*"]) };
    this.clients.set(ws, state);

    ws.on("pong", () => {
      state.alive = true;
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.action === "subscribe" || msg.action === "unsubscribe") {
          this.handleSubscription(state, msg as SubscribeMessage);
        } else if (msg.id !== undefined && msg.method) {
          this.handleRequest(ws, msg as WsRequest);
        }
        // else: ignore unknown messages
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      this.clients.delete(ws);
    });

    ws.on("error", () => {
      this.clients.delete(ws);
    });
  }

  private handleSubscription(state: ClientState, msg: SubscribeMessage): void {
    if (msg.action === "subscribe") {
      state.events = new Set(msg.events);
      state.sessionFilter = msg.sessionId;
    } else {
      for (const e of msg.events) {
        state.events.delete(e);
      }
    }
  }

  /**
   * Handle a request/response call over WebSocket.
   * Same operations as REST API, but over the persistent WS connection.
   */
  private async handleRequest(ws: WebSocket, req: WsRequest): Promise<void> {
    if (!this.adapter) {
      this.sendResponse(ws, req.id, undefined, "adapter not available");
      return;
    }

    const p = req.params ?? {};

    try {
      const result = await this.dispatch(req.method, p);
      this.sendResponse(ws, req.id, result);
    } catch (err) {
      this.sendResponse(ws, req.id, undefined, err instanceof Error ? err.message : String(err));
    }
  }

  private async dispatch(method: string, p: Record<string, unknown>): Promise<unknown> {
    const adapter = this.adapter!;

    switch (method) {
      // ── Read ──
      case "sessions":
        return adapter.getSessions();

      case "state":
        return adapter.getState(p.sessionId as string);

      case "variables":
        return adapter.getVariables(
          p.sessionId as string,
          p.variableReference as number,
          (p.depth as number) ?? 1,
        );

      case "evaluate":
        return adapter.evaluate(
          p.sessionId as string,
          p.expression as string,
          p.frameId as number | undefined,
          p.context as "watch" | "repl" | "hover" | undefined,
        );

      case "console":
        return adapter.getConsoleMessages(
          p.sessionId as string,
          p.since as string | undefined,
          p.pattern as string | undefined,
        );

      case "breakpoints":
        return adapter.getBreakpoints();

      case "diagnostics":
        return adapter.getDiagnostics(p.file as string | undefined);

      // ── Control ──
      case "continue":
        await adapter.continue(p.sessionId as string, p.threadId as number | undefined);
        return { ok: true };

      case "step":
        await adapter.step(
          p.sessionId as string,
          (p.type as "over" | "into" | "out") ?? "over",
          p.threadId as number | undefined,
        );
        return { ok: true };

      case "pause":
        await adapter.pause(p.sessionId as string, p.threadId as number | undefined);
        return { ok: true };

      case "stop":
        await adapter.stop(p.sessionId as string);
        return { ok: true };

      case "launch":
        return adapter.launch(p.configName as string);

      case "setBreakpoint":
        return adapter.setBreakpoint(
          p.file as string,
          p.line as number,
          p.condition as string | undefined,
          p.logMessage as string | undefined,
        );

      case "removeBreakpoint":
        await adapter.removeBreakpoint(p.id as string);
        return { ok: true };

      case "setExceptionBreakpoints":
        await adapter.setExceptionBreakpoints(
          p.sessionId as string,
          p.filters as string[],
        );
        return { ok: true };

      case "runTo":
        await adapter.runTo(p.sessionId as string, p.file as string, p.line as number);
        return { ok: true };

      case "setLogpoint":
        return adapter.setLogpoint(
          p.file as string,
          p.line as number,
          p.message as string,
          p.condition as string | undefined,
        );

      case "customRequest":
        return adapter.customRequest(
          p.sessionId as string,
          p.command as string,
          p.args as Record<string, unknown> | undefined,
        );

      case "consoleHistory":
        return adapter.getConsoleHistory(p.sessionId as string | undefined);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private sendResponse(ws: WebSocket, id: string | number, result?: unknown, error?: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const resp: WsResponse = { id };
    if (error) resp.error = error;
    else resp.result = result;
    ws.send(JSON.stringify(resp));
  }

  private wireSessionEvents(): void {
    const emitter = this.sessionManager.events;

    const on = (event: string, type: DebugEvent["type"]) => {
      const handler = (data: Record<string, unknown>) => {
        this.broadcast({
          type,
          sessionId: data.sessionId as string | undefined,
          timestamp: new Date().toISOString(),
          data,
        });
      };
      emitter.on(event, handler);
      this.cleanups.push(() => emitter.off(event, handler));
    };

    on("sessionStarted", "session.started");
    on("sessionTerminated", "session.terminated");
    on("stopped", "stopped");
    on("continued", "continued");
    on("consoleOutput", "console.output");
    on("diagnosticsChanged", "diagnostics.changed");
  }

  private broadcast(event: DebugEvent): void {
    const json = JSON.stringify(event);

    for (const [ws, state] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (!state.events.has("*") && !state.events.has(event.type)) continue;
      if (state.sessionFilter && event.sessionId && event.sessionId !== state.sessionFilter) continue;
      ws.send(json);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [ws, state] of this.clients) {
        if (!state.alive) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        state.alive = false;
        ws.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  dispose(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    for (const fn of this.cleanups) {
      fn();
    }
    this.cleanups.length = 0;
    for (const [ws] of this.clients) {
      ws.terminate();
    }
    this.clients.clear();
    this.wss.close();
  }
}
