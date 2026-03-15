import { EventEmitter } from "node:events";
import { describe, it, expect, beforeEach } from "vitest";
import { ConsoleBuffer } from "../src/console-buffer.js";
import { DebugOutputTracker, DebugOutputTrackerFactory } from "../src/debug-tracker.js";
import type { SessionManager } from "../src/session-manager.js";

function createMockSessionManager(
  buffers: Map<string, ConsoleBuffer>,
): SessionManager {
  return {
    getConsoleBuffer: (id: string) => buffers.get(id),
    events: new EventEmitter(),
  } as unknown as SessionManager;
}

describe("DebugOutputTracker", () => {
  let buffer: ConsoleBuffer;
  let tracker: DebugOutputTracker;

  beforeEach(() => {
    buffer = new ConsoleBuffer(100);
    const buffers = new Map([["session-1", buffer]]);
    const mgr = createMockSessionManager(buffers);
    tracker = new DebugOutputTracker("session-1", mgr);
  });

  it("captures stdout output events", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "stdout", output: "hello world\n" },
    });

    const msgs = buffer.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe("stdout");
    expect(msgs[0].text).toBe("hello world\n");
  });

  it("captures stderr output events", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "stderr", output: "error!\n" },
    });

    const msgs = buffer.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe("stderr");
  });

  it("captures console output events", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "console", output: "console log\n" },
    });

    const msgs = buffer.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe("console");
  });

  it("maps unknown categories to debug", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "telemetry", output: "some data" },
    });

    const msgs = buffer.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe("debug");
  });

  it("maps missing category to debug", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { output: "no category" },
    });

    const msgs = buffer.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe("debug");
  });

  it("ignores non-output events", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "stopped",
      body: { reason: "breakpoint" },
    });

    expect(buffer.getMessages()).toHaveLength(0);
  });

  it("ignores response messages", () => {
    tracker.onDidSendMessage({
      type: "response",
      command: "evaluate",
      body: { result: "42" },
    });

    expect(buffer.getMessages()).toHaveLength(0);
  });

  it("ignores messages with empty output", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "stdout", output: "" },
    });

    expect(buffer.getMessages()).toHaveLength(0);
  });

  it("ignores messages when buffer not found", () => {
    const mgr = createMockSessionManager(new Map());
    const orphanTracker = new DebugOutputTracker("no-session", mgr);

    // Should not throw
    orphanTracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "stdout", output: "data" },
    });
  });

  it("ignores non-object messages", () => {
    tracker.onDidSendMessage(null);
    tracker.onDidSendMessage(undefined);
    tracker.onDidSendMessage("string");
    tracker.onDidSendMessage(42);

    expect(buffer.getMessages()).toHaveLength(0);
  });

  it("adds timestamps to captured messages", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "stdout", output: "timed" },
    });

    const msgs = buffer.getMessages();
    expect(msgs[0].timestamp).toBeTruthy();
    // Verify it's a valid ISO timestamp
    expect(new Date(msgs[0].timestamp).toISOString()).toBe(msgs[0].timestamp);
  });

  it("captures multiple messages in order", () => {
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "stdout", output: "first" },
    });
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "stderr", output: "second" },
    });
    tracker.onDidSendMessage({
      type: "event",
      event: "output",
      body: { category: "console", output: "third" },
    });

    const msgs = buffer.getMessages();
    expect(msgs).toHaveLength(3);
    expect(msgs.map((m) => m.text)).toEqual(["first", "second", "third"]);
  });
});

describe("DebugOutputTrackerFactory", () => {
  it("creates a tracker for a session", () => {
    const buffer = new ConsoleBuffer(100);
    const buffers = new Map([["sess-1", buffer]]);
    const mgr = createMockSessionManager(buffers);
    const factory = new DebugOutputTrackerFactory(mgr);

    const session = { id: "sess-1" } as any;
    const tracker = factory.createDebugAdapterTracker(session);

    expect(tracker).toBeDefined();
    expect(tracker.onDidSendMessage).toBeDefined();

    // Verify it actually captures to the right buffer
    tracker.onDidSendMessage!({
      type: "event",
      event: "output",
      body: { category: "stdout", output: "from factory" },
    });

    const msgs = buffer.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("from factory");
  });
});
