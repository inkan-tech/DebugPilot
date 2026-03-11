import * as fs from "node:fs";
import type { SourceContext } from "./types.js";
import { DEFAULT_SOURCE_CONTEXT_LINES } from "./constants.js";

/**
 * Read source lines around a given line number.
 */
export function readSourceContext(
  filePath: string,
  currentLine: number,
  contextLines: number = DEFAULT_SOURCE_CONTEXT_LINES,
): SourceContext | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }

  const allLines = content.split("\n");
  const startLine = Math.max(1, currentLine - contextLines);
  const endLine = Math.min(allLines.length, currentLine + contextLines);

  const lines: SourceContext["lines"] = [];
  for (let i = startLine; i <= endLine; i++) {
    lines.push({
      line: i,
      text: allLines[i - 1],
      ...(i === currentLine ? { current: true } : {}),
    });
  }

  return { lines, contextLines };
}
