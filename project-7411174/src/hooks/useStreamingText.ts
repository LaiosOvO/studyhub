/**
 * useStreamingText — khoj chatHistory pattern
 *
 * Simulates token-by-token streaming of a full text string.
 * Useful for AI response bubbles, typing indicators, etc.
 *
 * Usage:
 *   const { displayed, isDone, reset } = useStreamingText(fullText, enabled, {
 *     charsPerTick: 2,
 *     speedMs: 16,
 *     onDone: () => console.log("streaming done"),
 *   });
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseStreamingTextOptions {
  /** Characters revealed per tick (default: 2) */
  charsPerTick?: number;
  /**
   * Milliseconds between ticks.
   * Pass 0 to auto-calculate based on text length (default behavior).
   */
  speedMs?: number;
  /** Called once when the full text has been revealed */
  onDone?: () => void;
}

export interface UseStreamingTextReturn {
  /** The currently visible portion of the text */
  displayed: string;
  /** True once the full text has been revealed */
  isDone: boolean;
  /** Restart streaming from the beginning */
  reset: () => void;
}

const AUTO_SPEED_TOTAL_MS = 1200; // Target ~1.2 s to reveal the full text
const DEFAULT_CHARS_PER_TICK = 2;
const MIN_SPEED_MS = 12;
const MAX_SPEED_MS = 80;

export function useStreamingText(
  fullText: string,
  enabled: boolean,
  options: UseStreamingTextOptions = {}
): UseStreamingTextReturn {
  const { charsPerTick = DEFAULT_CHARS_PER_TICK, speedMs: speedMsOption, onDone } = options;

  const [displayed, setDisplayed] = useState("");
  const [isDone, setIsDone] = useState(false);
  const onDoneRef = useRef(onDone);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const reset = useCallback(() => {
    clearTimer();
    setDisplayed("");
    setIsDone(false);
  }, []);

  useEffect(() => {
    if (!enabled || !fullText) {
      setDisplayed("");
      setIsDone(false);
      return;
    }

    setDisplayed("");
    setIsDone(false);
    clearTimer();

    let cursor = 0;

    // Auto-calculate speed so the text streams in ~1.2 s unless overridden
    const speedMs =
      speedMsOption ??
      Math.min(
        MAX_SPEED_MS,
        Math.max(
          MIN_SPEED_MS,
          Math.floor(AUTO_SPEED_TOTAL_MS / (fullText.length / charsPerTick))
        )
      );

    intervalRef.current = setInterval(() => {
      cursor += charsPerTick;
      const slice = fullText.slice(0, cursor);
      setDisplayed(slice);

      if (cursor >= fullText.length) {
        clearTimer();
        setDisplayed(fullText);
        setIsDone(true);
        onDoneRef.current?.();
      }
    }, speedMs);

    return clearTimer;
  }, [fullText, enabled, charsPerTick, speedMsOption]);

  return { displayed, isDone, reset };
}

// ── Cursor blink indicator ───────────────────────────────────────────────────
/**
 * Returns true during active streaming (for rendering a blinking cursor).
 * Use alongside useStreamingText:
 *   const showCursor = useStreamingCursor(enabled, isDone);
 */
export function useStreamingCursor(enabled: boolean, isDone: boolean): boolean {
  return enabled && !isDone;
}
