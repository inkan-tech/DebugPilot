import type { WsClient, DebugEvent } from "./ws-client.js";
import type { Config } from "./config.js";
import { triage } from "./triage.js";
import { DeepAnalyzer } from "./deep-analyzer.js";

const SEVERITY_LABELS = ["", "NOISE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const SEVERITY_COLORS = ["", "\x1b[90m", "\x1b[37m", "\x1b[33m", "\x1b[31m", "\x1b[91m\x1b[1m"];
const RESET = "\x1b[0m";

/**
 * Orchestrates triage (Groq) → deep analysis (Claude CLI).
 *
 * Flow:
 * 1. Debug event fires (stopped with exception/breakpoint)
 * 2. Fetch state via WS
 * 3. Groq triage: severity 1-5, one-line summary, escalate?
 * 4. If escalate → Claude CLI with --continue for deep analysis
 * 5. If not → just print the triage summary
 */
export class Analyzer {
  private busy = false;
  private deepAnalyzer: DeepAnalyzer;
  private currentSessionId: string | undefined;

  constructor(
    private readonly ws: WsClient,
    private readonly config: Config,
  ) {
    this.deepAnalyzer = new DeepAnalyzer(config);
  }

  async onEvent(event: DebugEvent): Promise<void> {
    if (this.busy) {
      this.log("Already analyzing, queuing skipped");
      return;
    }

    // Session lifecycle
    if (event.type === "session.started") {
      console.log(`\n[session] Started: ${event.data.name} (${event.sessionId})`);
      // New session → reset Claude conversation context
      if (event.sessionId !== this.currentSessionId) {
        this.currentSessionId = event.sessionId;
        this.deepAnalyzer.resetContext();
      }
      return;
    }
    if (event.type === "session.terminated") {
      console.log(`[session] Terminated: ${event.sessionId}`);
      return;
    }

    if (event.type !== "stopped") return;

    const reason = event.data.reason as string;
    const sessionId = event.sessionId;
    if (!sessionId) return;

    if (reason === "exception" && !this.config.analyzeExceptions) return;
    if (reason === "breakpoint" && !this.config.analyzeBreakpoints) return;
    if (reason !== "exception" && reason !== "breakpoint") return;

    // Track session for --continue context
    if (sessionId !== this.currentSessionId) {
      this.currentSessionId = sessionId;
      this.deepAnalyzer.resetContext();
    }

    this.busy = true;
    try {
      await this.handleStop(sessionId, reason);
    } finally {
      this.busy = false;
    }
  }

  private async handleStop(sessionId: string, reason: string): Promise<void> {
    // 1. Fetch state via WS
    let state: unknown;
    try {
      state = await this.ws.request("state", { sessionId });
    } catch (err) {
      console.error(`Failed to get state: ${err}`);
      return;
    }

    // 2. Groq triage (fast, cheap)
    console.log(`\n[triage] Analyzing ${reason}...`);
    let triageResult;
    try {
      triageResult = await triage(state, reason, this.config);
    } catch (err) {
      console.error(`Triage failed: ${err instanceof Error ? err.message : err}`);
      // Triage failed — escalate to be safe
      triageResult = {
        severity: 4,
        summary: `${reason} (triage unavailable)`,
        hint: "Triage failed, escalating",
        escalate: true,
      };
    }

    const sev = triageResult.severity;
    const color = SEVERITY_COLORS[sev] ?? "";
    const label = SEVERITY_LABELS[sev] ?? "?";

    console.log(`${color}[${label}]${RESET} ${triageResult.summary}`);
    if (triageResult.hint) {
      console.log(`  hint: ${triageResult.hint}`);
    }

    // 3. Escalate?
    if (!triageResult.escalate) {
      console.log(`  → Skipping deep analysis (severity ${sev} < threshold ${this.config.escalationThreshold})`);
      return;
    }

    console.log(`  → Escalating to Claude for deep analysis...`);

    // 4. Claude CLI deep analysis (--continue for context)
    try {
      await this.deepAnalyzer.analyze(state, reason, sessionId, triageResult);
    } catch (err) {
      console.error(`Deep analysis failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async dispose(): Promise<void> {
    await this.deepAnalyzer.dispose();
  }

  private log(msg: string): void {
    if (this.config.verbose) {
      console.error(`[analyzer] ${msg}`);
    }
  }
}
