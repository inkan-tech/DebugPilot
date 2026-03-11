import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { readSourceContext } from "../src/source-reader.js";

vi.mock("node:fs");

const mockReadFileSync = vi.mocked(fs.readFileSync);

describe("readSourceContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns lines around the current line", () => {
    const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join(
      "\n",
    );
    mockReadFileSync.mockReturnValue(content);

    const result = readSourceContext("/some/file.ts", 10, 3);

    expect(result).toBeDefined();
    expect(result!.contextLines).toBe(3);
    // Lines 7..13
    expect(result!.lines).toHaveLength(7);
    expect(result!.lines[0].line).toBe(7);
    expect(result!.lines[6].line).toBe(13);
    // Current line marked
    const current = result!.lines.find((l) => l.current);
    expect(current).toBeDefined();
    expect(current!.line).toBe(10);
    expect(current!.text).toBe("line 10");
  });

  it("clamps to start of file when currentLine is near beginning", () => {
    const content = "a\nb\nc\nd\ne";
    mockReadFileSync.mockReturnValue(content);

    const result = readSourceContext("/file.ts", 1, 5);

    expect(result).toBeDefined();
    expect(result!.lines[0].line).toBe(1);
    expect(result!.lines[result!.lines.length - 1].line).toBe(5);
    expect(result!.lines.find((l) => l.current)!.line).toBe(1);
  });

  it("clamps to end of file when currentLine is near end", () => {
    const content = "a\nb\nc\nd\ne";
    mockReadFileSync.mockReturnValue(content);

    const result = readSourceContext("/file.ts", 5, 5);

    expect(result).toBeDefined();
    expect(result!.lines[0].line).toBe(1);
    expect(result!.lines[result!.lines.length - 1].line).toBe(5);
    expect(result!.lines.find((l) => l.current)!.line).toBe(5);
  });

  it("returns undefined when file does not exist", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const result = readSourceContext("/nonexistent.ts", 1, 5);
    expect(result).toBeUndefined();
  });

  it("handles single-line files", () => {
    mockReadFileSync.mockReturnValue("only line");

    const result = readSourceContext("/single.ts", 1, 5);

    expect(result).toBeDefined();
    expect(result!.lines).toHaveLength(1);
    expect(result!.lines[0]).toEqual({
      line: 1,
      text: "only line",
      current: true,
    });
  });

  it("handles empty files", () => {
    mockReadFileSync.mockReturnValue("");

    const result = readSourceContext("/empty.ts", 1, 5);

    expect(result).toBeDefined();
    // Empty string split by \n gives [""], so 1 line
    expect(result!.lines).toHaveLength(1);
  });

  it("uses default context lines", () => {
    const content = Array.from({ length: 30 }, (_, i) => `L${i + 1}`).join(
      "\n",
    );
    mockReadFileSync.mockReturnValue(content);

    // Default is 10 context lines
    const result = readSourceContext("/file.ts", 15);

    expect(result).toBeDefined();
    expect(result!.contextLines).toBe(10);
    // Lines 5..25
    expect(result!.lines[0].line).toBe(5);
    expect(result!.lines[result!.lines.length - 1].line).toBe(25);
  });
});
