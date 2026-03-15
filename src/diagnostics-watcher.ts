import * as vscode from "vscode";
import type { SessionManager } from "./session-manager.js";
import type { DiagnosticInfo } from "./types.js";

/**
 * Watches VS Code diagnostics changes and emits events on SessionManager.
 */
export class DiagnosticsWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly sessionManager: SessionManager) {
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics((e) => {
        this.onDiagnosticsChanged(e.uris);
      }),
    );
  }

  private onDiagnosticsChanged(uris: readonly vscode.Uri[]): void {
    // Debounce 300ms to avoid flooding
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      const files = uris.map((u) => u.fsPath);
      this.sessionManager.events.emit("diagnosticsChanged", { files });
    }, 300);
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

/**
 * Collect diagnostics from VS Code, optionally filtered by file path.
 */
export function collectDiagnostics(file?: string): DiagnosticInfo[] {
  const results: DiagnosticInfo[] = [];
  const allDiagnostics = file
    ? [[vscode.Uri.file(file), vscode.languages.getDiagnostics(vscode.Uri.file(file))] as const]
    : vscode.languages.getDiagnostics();

  for (const [uri, diagnostics] of allDiagnostics) {
    for (const d of diagnostics) {
      results.push({
        file: uri.fsPath,
        severity: mapSeverity(d.severity),
        range: {
          startLine: d.range.start.line + 1,
          startCol: d.range.start.character + 1,
          endLine: d.range.end.line + 1,
          endCol: d.range.end.character + 1,
        },
        message: d.message,
        source: d.source,
        code: d.code != null && typeof d.code === "object" ? String(d.code.value) : d.code != null ? d.code : undefined,
      });
    }
  }

  return results;
}

function mapSeverity(severity: vscode.DiagnosticSeverity): DiagnosticInfo["severity"] {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "info";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "info";
  }
}
