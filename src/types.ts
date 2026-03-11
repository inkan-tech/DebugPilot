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

  /** Dispose resources */
  dispose(): void;
}
