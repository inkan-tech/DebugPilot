import type { ConsoleMessage } from "./types.js";
import { DEFAULT_CONSOLE_BUFFER_SIZE } from "./constants.js";

/**
 * Ring buffer for debug console messages.
 * Fixed-size circular buffer that overwrites oldest messages when full.
 */
export class ConsoleBuffer {
  private buffer: ConsoleMessage[];
  private head = 0;
  private count = 0;
  private readonly maxSize: number;

  constructor(maxSize: number = DEFAULT_CONSOLE_BUFFER_SIZE) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
  }

  push(message: ConsoleMessage): void {
    this.buffer[this.head] = message;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) {
      this.count++;
    }
  }

  /**
   * Get messages, optionally filtered by timestamp and pattern.
   */
  getMessages(since?: string, pattern?: string): ConsoleMessage[] {
    const messages: ConsoleMessage[] = [];
    const start =
      this.count < this.maxSize
        ? 0
        : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.maxSize;
      const msg = this.buffer[idx];

      if (since && msg.timestamp < since) continue;
      if (pattern) {
        const re = new RegExp(pattern);
        if (!re.test(msg.text)) continue;
      }

      messages.push(msg);
    }

    return messages;
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
