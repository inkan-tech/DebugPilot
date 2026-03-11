import type * as vscode from "vscode";

// --- Debug session types ---

export interface SessionInfo {
  id: string;
  name: string;
  type: string;
  status: "running" | "paused" | "stopped";
  pauseReason?: "breakpoint" | "exception" | "step" | "pause";
  pauseLocation?: SourceLocation;
}

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
  function?: string;
}

export interface SourceContext {
  lines: Array<{ line: number; text: string; current?: boolean }>;
  contextLines: number;
}

export interface StackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  column?: number;
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  variableReference: number;
  children?: Variable[];
}

export interface ConsoleMessage {
  type: "stdout" | "stderr" | "console" | "debug";
  text: string;
  timestamp: string;
}

export interface BreakpointInfo {
  id: string;
  file: string;
  line: number;
  enabled: boolean;
  condition?: string;
  hitCount?: number;
}

// --- Debug state (composite) ---

export interface DebugState {
  paused: boolean;
  reason?: string;
  location?: SourceLocation;
  source?: SourceContext;
  locals: Variable[];
  callStack: StackFrame[];
}

// --- IDebugAdapter interface ---

export interface IDebugAdapter {
  /** List all active debug sessions */
  getSessions(): SessionInfo[];

  /** Get full debug state for a session */
  getState(sessionId: string): Promise<DebugState>;

  /** Get variables for a scope or expand a variable reference */
  getVariables(
    sessionId: string,
    variableReference: number,
    depth?: number,
  ): Promise<Variable[]>;

  /** Evaluate an expression in a frame context */
  evaluate(
    sessionId: string,
    expression: string,
    frameId?: number,
  ): Promise<{ result: string; type?: string; variableReference: number }>;

  /** Get buffered console messages */
  getConsoleMessages(
    sessionId: string,
    since?: string,
    pattern?: string,
  ): ConsoleMessage[];

  /** List all breakpoints */
  getBreakpoints(): BreakpointInfo[];

  // --- Phase 2: Control ---

  /** Continue execution of a paused session */
  continue(sessionId: string, threadId?: number): Promise<void>;

  /** Step over / into / out */
  step(
    sessionId: string,
    type: "over" | "into" | "out",
    threadId?: number,
  ): Promise<void>;

  /** Pause a running session */
  pause(sessionId: string, threadId?: number): Promise<void>;

  /** Set a breakpoint */
  setBreakpoint(
    file: string,
    line: number,
    condition?: string,
    logMessage?: string,
  ): Promise<BreakpointInfo>;

  /** Remove a breakpoint by ID */
  removeBreakpoint(id: string): Promise<void>;

  /** Configure exception breakpoints */
  setExceptionBreakpoints(
    sessionId: string,
    filters: string[],
  ): Promise<void>;

  /** Send a custom DAP request (e.g., Flutter hotReload/hotRestart) */
  customRequest(
    sessionId: string,
    command: string,
    args?: Record<string, unknown>,
  ): Promise<unknown>;

  /** Dispose resources */
  dispose(): void;
}
