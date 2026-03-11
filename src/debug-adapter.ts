import * as vscode from "vscode";
import type {
  IDebugAdapter,
  SessionInfo,
  DebugState,
  Variable,
  ConsoleMessage,
  BreakpointInfo,
  StackFrame,
} from "./types.js";
import { SessionManager } from "./session-manager.js";
import { readSourceContext } from "./source-reader.js";
import {
  CONFIG_SECTION,
  DEFAULT_SOURCE_CONTEXT_LINES,
  DEFAULT_VARIABLE_DEPTH_LIMIT,
  MAX_VARIABLE_DEPTH,
} from "./constants.js";

/**
 * IDebugAdapter implementation wrapping vscode.debug.* APIs.
 */
export class VscodeDebugAdapter implements IDebugAdapter {
  constructor(private readonly sessionManager: SessionManager) {}

  getSessions(): SessionInfo[] {
    return this.sessionManager.getSessionInfoList();
  }

  async getState(sessionId: string): Promise<DebugState> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return { paused: false, locals: [], callStack: [] };
    }

    // Get threads
    const threadsResponse = await session.customRequest("threads");
    const threads: Array<{ id: number }> = threadsResponse.threads ?? [];
    if (threads.length === 0) {
      return { paused: false, locals: [], callStack: [] };
    }

    const threadId = threads[0].id;

    // Get stack trace
    let stackFrames: StackFrame[] = [];
    let locals: Variable[] = [];
    let paused = false;

    try {
      const stackResponse = await session.customRequest("stackTrace", {
        threadId,
        startFrame: 0,
        levels: 20,
      });

      const rawFrames: Array<{
        id: number;
        name: string;
        source?: { path?: string };
        line: number;
        column?: number;
      }> = stackResponse.stackFrames ?? [];

      paused = rawFrames.length > 0;

      stackFrames = rawFrames.map((f) => ({
        id: f.id,
        name: f.name,
        file: f.source?.path ?? "<unknown>",
        line: f.line,
        column: f.column,
      }));

      // Get locals from first frame
      if (rawFrames.length > 0) {
        const scopesResponse = await session.customRequest("scopes", {
          frameId: rawFrames[0].id,
        });
        const scopes: Array<{ variablesReference: number; name: string }> =
          scopesResponse.scopes ?? [];

        const localScope = scopes.find(
          (s) => s.name === "Local" || s.name === "Locals",
        );
        if (localScope) {
          locals = await this.fetchVariables(
            session,
            localScope.variablesReference,
          );
        }
      }
    } catch {
      // Session may not be paused — that's OK
      return { paused: false, locals: [], callStack: [] };
    }

    const topFrame = stackFrames[0];
    const contextLines =
      vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<number>("sourceContextLines") ?? DEFAULT_SOURCE_CONTEXT_LINES;

    const source = topFrame
      ? readSourceContext(topFrame.file, topFrame.line, contextLines)
      : undefined;

    return {
      paused,
      reason: this.sessionManager.getPauseState(sessionId)?.reason,
      location: topFrame
        ? {
            file: topFrame.file,
            line: topFrame.line,
            column: topFrame.column,
            function: topFrame.name,
          }
        : undefined,
      source,
      locals,
      callStack: stackFrames,
    };
  }

  async getVariables(
    sessionId: string,
    variableReference: number,
    depth: number = DEFAULT_VARIABLE_DEPTH_LIMIT,
  ): Promise<Variable[]> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return [];

    const clampedDepth = Math.min(depth, MAX_VARIABLE_DEPTH);
    return this.fetchVariables(session, variableReference, clampedDepth);
  }

  async evaluate(
    sessionId: string,
    expression: string,
    frameId?: number,
  ): Promise<{ result: string; type?: string; variableReference: number }> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const args: Record<string, unknown> = {
      expression,
      context: "repl",
    };
    if (frameId !== undefined) {
      args.frameId = frameId;
    }

    const response = await session.customRequest("evaluate", args);
    return {
      result: response.result,
      type: response.type,
      variableReference: response.variablesReference ?? 0,
    };
  }

  getConsoleMessages(
    sessionId: string,
    since?: string,
    pattern?: string,
  ): ConsoleMessage[] {
    const buffer = this.sessionManager.getConsoleBuffer(sessionId);
    if (!buffer) return [];
    return buffer.getMessages(since, pattern);
  }

  getBreakpoints(): BreakpointInfo[] {
    return vscode.debug.breakpoints
      .filter(
        (bp): bp is vscode.SourceBreakpoint =>
          bp instanceof vscode.SourceBreakpoint,
      )
      .map((bp, idx) => ({
        id: `BP#${idx + 1}`,
        file: bp.location.uri.fsPath,
        line: bp.location.range.start.line + 1, // VS Code is 0-indexed
        enabled: bp.enabled,
        condition: bp.condition,
        hitCount: undefined,
      }));
  }

  dispose(): void {
    // No own resources to dispose; SessionManager handles its own
  }

  // --- Private helpers ---

  private async fetchVariables(
    session: vscode.DebugSession,
    variableReference: number,
    depth: number = 1,
  ): Promise<Variable[]> {
    const response = await session.customRequest("variables", {
      variablesReference: variableReference,
    });

    const rawVars: Array<{
      name: string;
      value: string;
      type?: string;
      variablesReference: number;
    }> = response.variables ?? [];

    const variables: Variable[] = rawVars.map((v) => ({
      name: v.name,
      value: v.value,
      type: v.type,
      variableReference: v.variablesReference,
    }));

    // Recursively expand children if depth > 1
    if (depth > 1) {
      for (const v of variables) {
        if (v.variableReference > 0) {
          const children = await this.fetchVariables(
            session,
            v.variableReference,
            depth - 1,
          );
          if (children.length > 0) {
            v.children = children;
          }
        }
      }
    }

    return variables;
  }
}
