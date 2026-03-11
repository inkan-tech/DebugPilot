/**
 * Mock vscode module for unit tests.
 */

export const debug = {
  activeDebugSession: undefined as any,
  breakpoints: [] as any[],
  onDidStartDebugSession: (_cb: any) => ({ dispose: () => {} }),
  onDidTerminateDebugSession: (_cb: any) => ({ dispose: () => {} }),
  onDidReceiveDebugSessionCustomEvent: (_cb: any) => ({ dispose: () => {} }),
  registerDebugAdapterTrackerFactory: (_type: string, _factory: any) => ({
    dispose: () => {},
  }),
};

export const workspace = {
  getConfiguration: (_section?: string) => ({
    get: <T>(key: string, defaultValue?: T): T | undefined => defaultValue,
  }),
};

export const window = {
  showInformationMessage: (..._args: any[]) => {},
  showErrorMessage: (..._args: any[]) => {},
  showWarningMessage: (..._args: any[]) => {},
};

export const commands = {
  registerCommand: (_command: string, _callback: (...args: any[]) => any) => ({
    dispose: () => {},
  }),
};

export class Uri {
  static file(path: string) {
    return { fsPath: path, scheme: "file", path };
  }
}

export class Position {
  constructor(
    public line: number,
    public character: number,
  ) {}
}

export class Range {
  constructor(
    public start: Position,
    public end: Position,
  ) {}
}

export class Location {
  constructor(
    public uri: any,
    public range: Range,
  ) {}
}

export class SourceBreakpoint {
  constructor(
    public location: Location,
    public enabled: boolean = true,
    public condition?: string,
  ) {}
}

export enum DebugConsoleMode {
  Separate = 0,
  MergeWithParent = 1,
}
