import * as http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { IDebugAdapter } from "./types.js";
import type { SessionManager } from "./session-manager.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllPrompts } from "./prompts/index.js";
import { NotificationManager } from "./notifications.js";
import { EXTENSION_ID } from "./constants.js";

const DEFAULT_PORT = 45853;

interface SessionEntry {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  notificationManager?: NotificationManager;
}

export class DebugMcpServer {
  private httpServer: http.Server | undefined;
  private sessions = new Map<string, SessionEntry>();
  private _port: number = DEFAULT_PORT;

  constructor(
    private readonly adapter: IDebugAdapter,
    private readonly sessionManager?: SessionManager,
  ) {}

  get port(): number {
    return this._port;
  }

  private createSession(): { server: McpServer; transport: StreamableHTTPServerTransport; notificationManager?: NotificationManager } {
    const server = new McpServer({
      name: EXTENSION_ID,
      version: "0.7.1",
    });

    registerAllTools(server, this.adapter);
    registerAllResources(server, this.adapter);
    registerAllPrompts(server, this.adapter);

    let notificationManager: NotificationManager | undefined;
    if (this.sessionManager) {
      notificationManager = new NotificationManager(
        server.server,
        this.sessionManager,
      );
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        this.sessions.set(sessionId, { server, transport, notificationManager });
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        const entry = this.sessions.get(sid);
        entry?.notificationManager?.dispose();
        this.sessions.delete(sid);
      }
    };

    return { server, transport, notificationManager };
  }

  async start(port: number = DEFAULT_PORT): Promise<void> {
    this.httpServer = http.createServer(async (req, res) => {
      console.log(`[DebugPilot] ${req.method} ${req.url}`);

      // CORS headers for local connections
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, mcp-session-id, mcp-protocol-version",
      );

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", `http://localhost:${this._port}`);

      if (url.pathname === "/mcp") {
        await this.handleMcpRequest(req, res);
      } else if (url.pathname === "/shutdown" && req.method === "POST") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "shutting_down" }));
        this.stop().catch(() => {});
        return;
      } else if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", name: EXTENSION_ID }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not_found" }));
      }
    });

    await this.listenOnPort(port);
  }

  private async handleMcpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && this.sessions.has(sessionId)) {
      // Existing session — delegate to its transport
      await this.sessions.get(sessionId)!.transport.handleRequest(req, res);
      return;
    }

    // No session ID, or stale session ID — try to initialize a new session
    if (req.method === "POST") {
      const body = await readBody(req);
      if (isInitializeRequest(body)) {
        if (sessionId) {
          console.log(`[DebugPilot] Stale session ${sessionId}, creating new session`);
        }
        const { server, transport } = this.createSession();
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }
    }

    // Invalid request
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            "Bad Request: No valid session. Send an initialize request first.",
        },
        id: null,
      }),
    );
  }

  private async listenOnPort(port: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.httpServer!.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          // Check if it's a previous DebugPilot instance we can reclaim
          const killReq = http.request(
            { hostname: "127.0.0.1", port, path: "/health", method: "GET", timeout: 1000 },
            (res) => {
              let body = "";
              res.on("data", (chunk: Buffer) => { body += chunk; });
              res.on("end", () => {
                try {
                  const data = JSON.parse(body);
                  if (data.name === EXTENSION_ID) {
                    // It's a previous DebugPilot — shut it down and reclaim
                    const shutdownReq = http.request(
                      { hostname: "127.0.0.1", port, path: "/shutdown", method: "POST" },
                      () => {
                        setTimeout(() => {
                          this.httpServer!.listen(port, "127.0.0.1", () => {
                            this._port = port;
                            resolve();
                          });
                        }, 300);
                      },
                    );
                    shutdownReq.on("error", () => reject(new Error(`Port ${port} reclaim failed`)));
                    shutdownReq.end();
                  } else {
                    reject(new Error(`Port ${port} is in use by another service`));
                  }
                } catch {
                  reject(new Error(`Port ${port} is in use by another service`));
                }
              });
            },
          );
          killReq.on("error", () => reject(new Error(`Port ${port} is in use`)));
          killReq.on("timeout", () => { killReq.destroy(); reject(new Error(`Port ${port} is in use`)); });
          killReq.end();
        } else {
          reject(err);
        }
      });
      this.httpServer!.listen(port, "127.0.0.1", () => {
        const addr = this.httpServer!.address();
        this._port = typeof addr === "object" && addr ? addr.port : port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const [, entry] of this.sessions) {
      entry.notificationManager?.dispose();
      await entry.transport.close();
      await entry.server.close();
    }
    this.sessions.clear();
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = undefined;
    }
  }
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk; });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
