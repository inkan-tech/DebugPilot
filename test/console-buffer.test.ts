import { describe, it, expect } from "vitest";
import { ConsoleBuffer } from "../src/console-buffer.js";
import type { ConsoleMessage } from "../src/types.js";

function makeMsg(text: string, timestamp: string): ConsoleMessage {
  return { type: "stdout", text, timestamp };
}

describe("ConsoleBuffer", () => {
  it("stores and retrieves messages", () => {
    const buf = new ConsoleBuffer(100);
    buf.push(makeMsg("hello", "2026-01-01T00:00:00Z"));
    buf.push(makeMsg("world", "2026-01-01T00:00:01Z"));

    const msgs = buf.getMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0].text).toBe("hello");
    expect(msgs[1].text).toBe("world");
  });

  it("wraps around when full", () => {
    const buf = new ConsoleBuffer(3);
    buf.push(makeMsg("a", "2026-01-01T00:00:00Z"));
    buf.push(makeMsg("b", "2026-01-01T00:00:01Z"));
    buf.push(makeMsg("c", "2026-01-01T00:00:02Z"));
    buf.push(makeMsg("d", "2026-01-01T00:00:03Z"));

    expect(buf.size).toBe(3);
    const msgs = buf.getMessages();
    expect(msgs.map((m) => m.text)).toEqual(["b", "c", "d"]);
  });

  it("filters by since timestamp", () => {
    const buf = new ConsoleBuffer(100);
    buf.push(makeMsg("old", "2026-01-01T00:00:00Z"));
    buf.push(makeMsg("new", "2026-01-02T00:00:00Z"));

    const msgs = buf.getMessages("2026-01-01T12:00:00Z");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("new");
  });

  it("filters by pattern", () => {
    const buf = new ConsoleBuffer(100);
    buf.push(makeMsg("[ERROR] bad thing", "2026-01-01T00:00:00Z"));
    buf.push(makeMsg("[INFO] good thing", "2026-01-01T00:00:01Z"));
    buf.push(makeMsg("[ERROR] another bad", "2026-01-01T00:00:02Z"));

    const msgs = buf.getMessages(undefined, "\\[ERROR\\]");
    expect(msgs).toHaveLength(2);
  });

  it("clear empties the buffer", () => {
    const buf = new ConsoleBuffer(100);
    buf.push(makeMsg("a", "2026-01-01T00:00:00Z"));
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.getMessages()).toHaveLength(0);
  });
});
