import { describe, it, expect, beforeEach, vi } from "vitest";
import { debug } from "vscode";
import { SessionManager } from "../src/session-manager.js";

/**
 * Helper: captures the callbacks registered by SessionManager on construction.
 */
function createManagerWithCallbacks() {
  let onStartSession: ((session: any) => void) | undefined;
  let onTerminateSession: ((session: any) => void) | undefined;
  let trackerFactory: any;

  vi.spyOn(debug, "onDidStartDebugSession").mockImplementation((cb: any) => {
    onStartSession = cb;
    return { dispose: () => {} };
  });

  vi.spyOn(debug, "onDidTerminateDebugSession").mockImplementation(
    (cb: any) => {
      onTerminateSession = cb;
      return { dispose: () => {} };
    },
  );

  vi.spyOn(debug, "registerDebugAdapterTrackerFactory").mockImplementation(
    (_type: string, factory: any) => {
      trackerFactory = factory;
      return { dispose: () => {} };
    },
  );

  const manager = new SessionManager();

  return { manager, onStartSession: onStartSession!, onTerminateSession: onTerminateSession!, trackerFactory };
}

function fakeSession(id: string, name = "Test", type = "node") {
  return { id, name, type } as any;
}

describe("SessionManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (debug as any).activeDebugSession = undefined;
  });

  it("tracks sessions on start and terminate", () => {
    const { manager, onStartSession, onTerminateSession } =
      createManagerWithCallbacks();

    const session = fakeSession("s1");
    onStartSession(session);

    expect(manager.getSession("s1")).toBe(session);
    expect(manager.getSessionInfoList()).toHaveLength(1);
    expect(manager.getSessionInfoList()[0].status).toBe("running");

    onTerminateSession(session);
    expect(manager.getSession("s1")).toBeUndefined();
    expect(manager.getSessionInfoList()).toHaveLength(0);

    manager.dispose();
  });

  it("returns running status by default", () => {
    const { manager, onStartSession } = createManagerWithCallbacks();

    onStartSession(fakeSession("s1", "My Session", "python"));

    const list = manager.getSessionInfoList();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: "s1",
      name: "My Session",
      type: "python",
      status: "running",
    });
    expect(list[0].pauseReason).toBeUndefined();

    manager.dispose();
  });

  describe("debug adapter tracker", () => {
    it("marks session as paused on stopped event", () => {
      const { manager, onStartSession, trackerFactory } =
        createManagerWithCallbacks();

      const session = fakeSession("s1");
      onStartSession(session);

      // Create tracker and simulate stopped event
      const tracker = trackerFactory.createDebugAdapterTracker(session);
      tracker.onDidSendMessage({
        type: "event",
        event: "stopped",
        body: { reason: "breakpoint", threadId: 1 },
      });

      const list = manager.getSessionInfoList();
      expect(list[0].status).toBe("paused");
      expect(list[0].pauseReason).toBe("breakpoint");

      manager.dispose();
    });

    it("marks session as running on continued event", () => {
      const { manager, onStartSession, trackerFactory } =
        createManagerWithCallbacks();

      const session = fakeSession("s1");
      onStartSession(session);

      const tracker = trackerFactory.createDebugAdapterTracker(session);

      // Stop then continue
      tracker.onDidSendMessage({
        type: "event",
        event: "stopped",
        body: { reason: "step" },
      });
      expect(manager.getSessionInfoList()[0].status).toBe("paused");

      tracker.onDidSendMessage({
        type: "event",
        event: "continued",
        body: {},
      });
      expect(manager.getSessionInfoList()[0].status).toBe("running");
      expect(manager.getSessionInfoList()[0].pauseReason).toBeUndefined();

      manager.dispose();
    });

    it("maps stop reasons correctly", () => {
      const { manager, onStartSession, trackerFactory } =
        createManagerWithCallbacks();

      const session = fakeSession("s1");
      onStartSession(session);
      const tracker = trackerFactory.createDebugAdapterTracker(session);

      const testCases: Array<{ input: string; expected: string }> = [
        { input: "breakpoint", expected: "breakpoint" },
        { input: "function breakpoint", expected: "breakpoint" },
        { input: "data breakpoint", expected: "breakpoint" },
        { input: "exception", expected: "exception" },
        { input: "step", expected: "step" },
        { input: "pause", expected: "pause" },
        { input: "entry", expected: "pause" }, // unknown maps to pause
      ];

      for (const { input, expected } of testCases) {
        tracker.onDidSendMessage({
          type: "event",
          event: "stopped",
          body: { reason: input },
        });
        expect(
          manager.getSessionInfoList()[0].pauseReason,
          `reason "${input}" should map to "${expected}"`,
        ).toBe(expected);
      }

      manager.dispose();
    });

    it("ignores non-event messages", () => {
      const { manager, onStartSession, trackerFactory } =
        createManagerWithCallbacks();

      const session = fakeSession("s1");
      onStartSession(session);
      const tracker = trackerFactory.createDebugAdapterTracker(session);

      // Response message should be ignored
      tracker.onDidSendMessage({
        type: "response",
        command: "stackTrace",
      });

      expect(manager.getSessionInfoList()[0].status).toBe("running");

      manager.dispose();
    });
  });

  it("cleans up pause state on session terminate", () => {
    const { manager, onStartSession, onTerminateSession, trackerFactory } =
      createManagerWithCallbacks();

    const session = fakeSession("s1");
    onStartSession(session);

    const tracker = trackerFactory.createDebugAdapterTracker(session);
    tracker.onDidSendMessage({
      type: "event",
      event: "stopped",
      body: { reason: "breakpoint" },
    });

    onTerminateSession(session);
    expect(manager.getPauseState("s1")).toBeUndefined();

    manager.dispose();
  });
});
