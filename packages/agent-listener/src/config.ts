export interface Config {
  /** DebugPilot WebSocket URL */
  wsUrl: string;

  // ── Groq (triage) ────────────────────────────────
  /** Groq API key */
  groqApiKey: string;
  /** Groq model for fast triage */
  groqModel: string;
  /** Groq API base URL (OpenAI-compatible) */
  groqBaseUrl: string;

  // ── Claude CLI (deep analysis) ───────────────────
  /** Min severity to escalate to Claude (1-5, default 3) */
  escalationThreshold: number;

  // ── Behavior ─────────────────────────────────────
  /** Events to react to */
  events: string[];
  /** Auto-analyze exceptions */
  analyzeExceptions: boolean;
  /** Auto-analyze breakpoint stops */
  analyzeBreakpoints: boolean;
  /** Verbose logging */
  verbose: boolean;
}

export function loadConfig(): Config {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error("GROQ_API_KEY environment variable required");
    process.exit(1);
  }

  const port = process.env.DEBUGPILOT_PORT ?? "45853";
  const host = process.env.DEBUGPILOT_HOST ?? "127.0.0.1";

  return {
    wsUrl: process.env.DEBUGPILOT_WS_URL ?? `ws://${host}:${port}/ws`,

    groqApiKey,
    groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    groqBaseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",

    escalationThreshold: parseInt(process.env.DEBUGPILOT_ESCALATION_THRESHOLD ?? "3", 10),

    events: (process.env.DEBUGPILOT_EVENTS ?? "stopped").split(","),
    analyzeExceptions: process.env.DEBUGPILOT_ANALYZE_EXCEPTIONS !== "false",
    analyzeBreakpoints: process.env.DEBUGPILOT_ANALYZE_BREAKPOINTS !== "false",
    verbose: process.env.DEBUGPILOT_VERBOSE === "true",
  };
}
