import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { IDebugAdapter } from "./types.js";
import { registerAllTools } from "./tools/index.js";
import { EXTENSION_ID } from "./constants.js";

export class DebugMcpServer {
  private server: McpServer;
  private transport: StdioServerTransport | undefined;

  constructor(private readonly adapter: IDebugAdapter) {
    this.server = new McpServer({
      name: EXTENSION_ID,
      version: "0.1.0",
    });

    registerAllTools(this.server, this.adapter);
  }

  async start(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
  }

  async stop(): Promise<void> {
    await this.server.close();
    this.transport = undefined;
  }
}
