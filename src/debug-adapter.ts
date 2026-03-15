import * as vscode from "vscode";
import type {
  IDebugAdapter,
  SessionInfo,
  DebugState,
  Variable,
  ConsoleMessage,
  BreakpointInfo,
  DiagnosticInfo,
  StackFrame,
} from "./types.js";
import { collectDiagnostics } from "./diagnostics-watcher.js";
import { SessionManager } from "./session-manager.js";
import { readSourceContext } from "./source-reader.js";
import {
  CONFIG_SECTION,
  DEFAULT_SOURCE_CONTEXT_LINES,
  DEFAULT_VARIABLE_DEPTH_LIMIT,
  MAX_VARIABLE_DEPTH,
} from "./constants.js";

/**
 * Validates that a session exists and returns it, or throws an actionable error.
 */
export function requireSession(sessionManager: SessionManager, sessionId: string): vscode.DebugSession {
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    const available = sessionManager.getSessionInfoList().map(s => s.id);
    if (available.length === 0) {
      throw new Error(`No active debug sessions. Start a debug session first, then call debug_sessions to get the sessionId.`);
    }
    throw new Error(`Session "${sessionId}" not found. Available sessions: ${available.join(", ")}. Call debug_sessions to see current sessions.`);
  }
  return session;
}

/**
 * IDebugAdapter implementation wrapping vscode.debug.* APIs.
 */
export class VscodeDebugAdapter implements IDebugAdapter {
  constructor(private readonly sessionManager: SessionManager) {}

  getSessions(): SessionInfo[] {
    return this.sessionManager.getSessionInfoList();
  }

  async getState(sessionId: string): Promise<DebugState> {
    const session = requireSession(this.sessionManager, sessionId);

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
    const session = requireSession(this.sessionManager, sessionId);

    const clampedDepth = Math.min(depth, MAX_VARIABLE_DEPTH);
    return this.fetchVariables(session, variableReference, clampedDepth);
  }

  async evaluate(
    sessionId: string,
    expression: string,
    frameId?: number,
    context?: "watch" | "repl" | "hover",
  ): Promise<{ result: string; type?: string; variableReference: number }> {
    const session = requireSession(this.sessionManager, sessionId);

    const args: Record<string, unknown> = {
      expression,
      context: context ?? "watch",
    };
    if (frameId !== undefined) {
      args.frameId = frameId;
    }

    const timeoutMs = 10_000;
    const response = await Promise.race([
      session.customRequest("evaluate", args),
      new Promise((_, reject) => setTimeout(() => reject(new Error(
        `Expression evaluation timed out after ${timeoutMs}ms. The expression may be too complex or caused an infinite loop.`
      )), timeoutMs)),
    ]);
    return {
      result: (response as any).result,
      type: (response as any).type,
      variableReference: (response as any).variablesReference ?? 0,
    };
  }

  getConsoleMessages(
    sessionId: string,
    since?: string,
    pattern?: string,
  ): ConsoleMessage[] {
    requireSession(this.sessionManager, sessionId);
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

  async continue(sessionId: string, threadId?: number): Promise<void> {
    const session = requireSession(this.sessionManager, sessionId);
    const tid = await this.resolveThreadId(session, threadId);
    await session.customRequest("continue", { threadId: tid });
  }

  async step(sessionId: string, type: "over" | "into" | "out", threadId?: number): Promise<void> {
    const session = requireSession(this.sessionManager, sessionId);
    const tid = await this.resolveThreadId(session, threadId);
    const command = type === "over" ? "next" : type === "into" ? "stepIn" : "stepOut";
    await session.customRequest(command, { threadId: tid });
  }

  async pause(sessionId: string, threadId?: number): Promise<void> {
    const session = requireSession(this.sessionManager, sessionId);
    const tid = await this.resolveThreadId(session, threadId);
    await session.customRequest("pause", { threadId: tid });
  }

  async setBreakpoint(
    file: string,
    line: number,
    condition?: string,
    logMessage?: string,
  ): Promise<BreakpointInfo> {
    const uri = vscode.Uri.file(file);
    const position = new vscode.Position(line - 1, 0); // VS Code is 0-indexed
    const location = new vscode.Location(uri, position);
    const bp = new vscode.SourceBreakpoint(location, true, condition, undefined, logMessage);
    vscode.debug.addBreakpoints([bp]);

    return {
      id: `BP#${vscode.debug.breakpoints.length}`,
      file,
      line,
      enabled: true,
      condition,
    };
  }

  async removeBreakpoint(id: string): Promise<void> {
    // BP#N format — find the breakpoint by index
    const match = id.match(/^BP#(\d+)$/);
    if (!match) throw new Error(`Invalid breakpoint ID: ${id}`);

    const index = parseInt(match[1], 10) - 1;
    const sourceBreakpoints = vscode.debug.breakpoints.filter(
      (bp): bp is vscode.SourceBreakpoint => bp instanceof vscode.SourceBreakpoint,
    );

    if (index < 0 || index >= sourceBreakpoints.length) {
      throw new Error(`Breakpoint ${id} not found`);
    }

    vscode.debug.removeBreakpoints([sourceBreakpoints[index]]);
  }

  async setExceptionBreakpoints(sessionId: string, filters: string[]): Promise<void> {
    const session = requireSession(this.sessionManager, sessionId);
    await session.customRequest("setExceptionBreakpoints", { filters });
  }

  async launch(configName: string): Promise<{ sessionId: string; status: string }> {
    const sessionsBefore = new Set(this.sessionManager.getAllSessions().keys());
    const started = await vscode.debug.startDebugging(undefined, configName);
    if (!started) {
      throw new Error(`Failed to launch configuration "${configName}"`);
    }

    // Find the newly created session
    const sessionsAfter = this.sessionManager.getAllSessions();
    for (const [id] of sessionsAfter) {
      if (!sessionsBefore.has(id)) {
        return { sessionId: id, status: "launched" };
      }
    }

    // Fallback: use active session
    const active = vscode.debug.activeDebugSession;
    if (active) {
      return { sessionId: active.id, status: "launched" };
    }

    throw new Error("Session started but could not determine sessionId");
  }

  async stop(sessionId: string): Promise<void> {
    const session = requireSession(this.sessionManager, sessionId);
    await vscode.debug.stopDebugging(session);
  }

  async setLogpoint(
    file: string,
    line: number,
    message: string,
    condition?: string,
  ): Promise<BreakpointInfo> {
    return this.setBreakpoint(file, line, condition, message);
  }

  async runTo(sessionId: string, file: string, line: number): Promise<void> {
    await this.setBreakpoint(file, line);
    await this.continue(sessionId);
  }

  async customRequest(sessionId: string, command: string, args?: Record<string, unknown>): Promise<unknown> {
    const session = requireSession(this.sessionManager, sessionId);
    return session.customRequest(command, args);
  }

  getConsoleHistory(sessionId?: string) {
    const terminated = this.sessionManager.getTerminatedSessions();
    const filtered = sessionId
      ? terminated.filter((t) => t.id === sessionId)
      : terminated;

    return filtered.map((t) => ({
      sessionId: t.id,
      name: t.name,
      type: t.type,
      terminatedAt: t.terminatedAt,
      messages: this.sessionManager.getHistoryBuffer(t.id)?.getMessages() ?? [],
    }));
  }

  getDiagnostics(file?: string): DiagnosticInfo[] {
    return collectDiagnostics(file);
  }

  dispose(): void {
    // No own resources to dispose; SessionManager handles its own
  }

  // --- Private helpers ---

  private async resolveThreadId(session: vscode.DebugSession, threadId?: number): Promise<number> {
    if (threadId !== undefined) return threadId;
    const threadsResponse = await session.customRequest("threads");
    const threads: Array<{ id: number }> = threadsResponse.threads ?? [];
    if (threads.length === 0) throw new Error("No threads available");
    return threads[0].id;
  }

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
