import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { NotificationManager } from "../src/notifications.js";
import type { SessionManager } from "../src/session-manager.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

function createMockServer() {
  return {
    sendResourceUpdated: vi.fn().mockResolvedValue(undefined),
    sendResourceListChanged: vi.fn().mockResolvedValue(undefined),
  } as unknown as Server;
}

function createMockSessionManager() {
  const emitter = new EventEmitter();
  return {
    events: emitter,
    _emit: (event: string, data?: unknown) => emitter.emit(event, data),
  };
}

describe("NotificationManager", () => {
  let server: ReturnType<typeof createMockServer>;
  let sm: ReturnType<typeof createMockSessionManager>;
  let manager: NotificationManager;

  beforeEach(() => {
    server = createMockServer();
    sm = createMockSessionManager();
    manager = new NotificationManager(server, sm as unknown as SessionManager);
  });

  it("notifies sessions resource on sessionStarted", () => {
    sm._emit("sessionStarted", { sessionId: "s1", name: "Test", type: "node" });

    expect(server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: "debug://sessions",
    });
    expect(server.sendResourceListChanged).toHaveBeenCalled();
  });

  it("notifies sessions resource on sessionTerminated", () => {
    sm._emit("sessionTerminated", { sessionId: "s1" });

    expect(server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: "debug://sessions",
    });
    expect(server.sendResourceListChanged).toHaveBeenCalled();
  });

  it("notifies sessions resource on stopped (any reason)", () => {
    sm._emit("stopped", { sessionId: "s1", reason: "step" });

    expect(server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: "debug://sessions",
    });
  });

  it("notifies breakpoints resource on breakpoint hit", () => {
    sm._emit("stopped", { sessionId: "s1", reason: "breakpoint" });

    expect(server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: "debug://breakpoints",
    });
  });

  it("does NOT notify breakpoints resource on exception stop", () => {
    sm._emit("stopped", { sessionId: "s1", reason: "exception" });

    const calls = (server.sendResourceUpdated as ReturnType<typeof vi.fn>).mock.calls;
    const breakpointCalls = calls.filter(
      (c: unknown[]) => (c[0] as { uri: string }).uri === "debug://breakpoints",
    );
    expect(breakpointCalls).toHaveLength(0);
  });

  it("notifies sessions resource on continued", () => {
    sm._emit("continued", { sessionId: "s1" });

    expect(server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: "debug://sessions",
    });
  });

  it("handles server notification errors gracefully", () => {
    (server.sendResourceUpdated as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("not subscribed"),
    );
    (server.sendResourceListChanged as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("not subscribed"),
    );

    // Should not throw
    sm._emit("sessionStarted", { sessionId: "s1", name: "Test", type: "node" });
    sm._emit("stopped", { sessionId: "s1", reason: "breakpoint" });
  });

  it("stops listening after dispose", () => {
    manager.dispose();

    (server.sendResourceUpdated as ReturnType<typeof vi.fn>).mockClear();
    (server.sendResourceListChanged as ReturnType<typeof vi.fn>).mockClear();

    sm._emit("sessionStarted", { sessionId: "s1", name: "Test", type: "node" });
    sm._emit("stopped", { sessionId: "s1", reason: "breakpoint" });

    expect(server.sendResourceUpdated).not.toHaveBeenCalled();
    expect(server.sendResourceListChanged).not.toHaveBeenCalled();
  });

  it("dispose is idempotent", () => {
    manager.dispose();
    manager.dispose(); // should not throw
  });
});
