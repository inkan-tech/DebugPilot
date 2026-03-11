import * as http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IDebugAdapter } from "./types.js";
import { registerAllTools } from "./tools/index.js";
import { EXTENSION_ID } from "./constants.js";

const DEFAULT_PORT = 45853;

export class DebugMcpServer {
  private server: McpServer;
  private httpServer: http.Server | undefined;
  private transport: StreamableHTTPServerTransport | undefined;
  private _port: number = DEFAULT_PORT;

  constructor(private readonly adapter: IDebugAdapter) {
    this.server = new McpServer({
      name: EXTENSION_ID,
      version: "0.2.0",
    });

    registerAllTools(this.server, this.adapter);
  }

  get port(): number {
    return this._port;
  }

  async start(): Promise<void> {
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await this.server.connect(this.transport);

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
        await this.transport!.handleRequest(req, res);
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

    await this.listenOnPort(DEFAULT_PORT);
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
        this._port = port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.transport?.close();
    this.transport = undefined;
    await this.server.close();
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = undefined;
    }
  }
}
