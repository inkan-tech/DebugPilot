import WebSocket from "ws";
import { EventEmitter } from "node:events";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

export interface WsResponse {
  id: number;
  result?: unknown;
  error?: string;
}

export interface DebugEvent {
  type: string;
  sessionId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * WebSocket client with auto-reconnect and request/response support.
 *
 * Events:
 * - "event" (DebugEvent) — push event from server
 * - "connected" — connection established
 * - "disconnected" — connection lost
 */
export class WsClient extends EventEmitter {
  private ws: WebSocket | undefined;
  private requestId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private subscriptions: string[];

  constructor(
    private readonly url: string,
    events: string[] = ["*"],
    private readonly verbose = false,
  ) {
    super();
    this.subscriptions = events;
  }

  connect(): void {
    this.log(`Connecting to ${this.url}...`);
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this.log("Connected");
      this.reconnectDelay = RECONNECT_DELAY_MS;

      // Subscribe to events
      this.ws!.send(
        JSON.stringify({ action: "subscribe", events: this.subscriptions }),
      );

      this.emit("connected");
    });

    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Response to a request we sent
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (msg.error) {
              p.reject(new Error(msg.error));
            } else {
              p.resolve(msg.result);
            }
          }
          return;
        }

        // Push event
        if (msg.type) {
          this.emit("event", msg as DebugEvent);
        }
      } catch {
        // Ignore malformed
      }
    });

    this.ws.on("close", () => {
      this.log("Disconnected");
      this.rejectAllPending("Connection closed");
      this.emit("disconnected");
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.log(`Error: ${err.message}`);
      // close event will fire after this
    });
  }

  /**
   * Send a request and wait for the response.
   */
  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    const id = this.requestId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 15000);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.rejectAllPending("Client disposed");
    this.ws?.close();
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, MAX_RECONNECT_DELAY_MS);
  }

  private rejectAllPending(reason: string): void {
    for (const [id, p] of this.pending) {
      p.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  private log(msg: string): void {
    if (this.verbose) {
      console.error(`[ws] ${msg}`);
    }
  }
}
