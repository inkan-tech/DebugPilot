import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "./config.js";
import type { TriageResult } from "./triage.js";

/**
 * Deep analysis via `claude -p --continue`.
 *
 * Uses the Claude CLI with DebugPilot MCP config so Claude can
 * call debug tools (state, variables, evaluate, etc.) natively.
 *
 * `--continue` preserves context across calls within a debug session.
 */
export class DeepAnalyzer {
  private mcpConfigPath: string | undefined;
  private isFirstCall = true;

  constructor(private readonly config: Config) {}

  async analyze(
    state: unknown,
    reason: string,
    sessionId: string,
    triageResult: TriageResult,
  ): Promise<void> {
    // Ensure MCP config exists
    if (!this.mcpConfigPath) {
      this.mcpConfigPath = await this.writeMcpConfig();
    }

    const prompt = this.buildPrompt(state, reason, sessionId, triageResult);

    // Build claude CLI args
    const args = [
      "-p", prompt,
      "--mcp-config", this.mcpConfigPath,
      "--allowedTools", "mcp__debugpilot__*",
    ];

    // Continue previous conversation (accumulate debug context)
    if (!this.isFirstCall) {
      args.push("--continue");
    }
    this.isFirstCall = false;

    console.log("\n--- Claude Analysis ---\n");

    await this.runClaude(args);

    console.log("\n--- End Analysis ---\n");
  }

  /**
   * Reset conversation context (e.g., on new debug session).
   */
  resetContext(): void {
    this.isFirstCall = true;
  }

  private buildPrompt(
    state: unknown,
    reason: string,
    sessionId: string,
    triageResult: TriageResult,
  ): string {
    const stateJson = JSON.stringify(state, null, 2);

    if (this.isFirstCall) {
      return `You are debugging a live application via DebugPilot MCP tools.
Session ID: ${sessionId}

The debugger stopped (${reason}). Triage assessment:
- Severity: ${triageResult.severity}/5
- Summary: ${triageResult.summary}
- Hint: ${triageResult.hint}

Current debug state:
\`\`\`json
${stateJson}
\`\`\`

Investigate this ${reason}:
1. Use debug tools to expand suspicious variables, evaluate expressions, check console
2. Identify the root cause
3. Suggest a specific fix with code

Be concise. Use the MCP debug tools — don't guess.`;
    }

    // Continuation — shorter prompt, context is preserved
    return `The debugger stopped again (${reason}).
Triage: severity ${triageResult.severity}/5 — ${triageResult.summary}

Updated state:
\`\`\`json
${stateJson}
\`\`\`

Continue investigating. Use debug tools if needed. What changed since last stop?`;
  }

  private async writeMcpConfig(): Promise<string> {
    const port = this.config.wsUrl.match(/:(\d+)/)?.[1] ?? "45853";

    const mcpConfig = {
      mcpServers: {
        debugpilot: {
          url: `http://127.0.0.1:${port}/mcp`,
        },
      },
    };

    const dir = await mkdtemp(join(tmpdir(), "debugpilot-agent-"));
    const configPath = join(dir, "mcp.json");
    await writeFile(configPath, JSON.stringify(mcpConfig, null, 2));

    // Clean up on exit
    process.on("exit", () => {
      rm(dir, { recursive: true }).catch(() => {});
    });

    return configPath;
  }

  private runClaude(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn("claude", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (data: Buffer) => {
        process.stdout.write(data);
      });

      child.stderr.on("data", (data: Buffer) => {
        // Claude CLI writes progress to stderr — show if verbose
        if (this.config.verbose) {
          process.stderr.write(data);
        }
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`claude exited with code ${code}`));
        }
      });

      child.on("error", (err) => {
        reject(new Error(`Failed to spawn claude: ${err.message}. Is Claude CLI installed?`));
      });
    });
  }

  async dispose(): Promise<void> {
    if (this.mcpConfigPath) {
      const dir = join(this.mcpConfigPath, "..");
      await rm(dir, { recursive: true }).catch(() => {});
    }
  }
}
