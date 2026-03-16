/**
 * Scrollable iteration log showing experiment round history.
 *
 * Listens for "experiment-iteration" Tauri events and displays
 * each round with color-coded status indicators.
 */

import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import type { ExperimentRoundResult } from "../lib/invoke";

/** Status colors and icons. */
function statusIndicator(status: string): { color: string; icon: string } {
  switch (status) {
    case "keep":
      return { color: "#5cb85c", icon: "+" };
    case "discard":
      return { color: "#888", icon: "-" };
    case "crash":
      return { color: "#d9534f", icon: "!" };
    case "baseline":
      return { color: "#7ec8e3", icon: "B" };
    default:
      return { color: "#888", icon: "?" };
  }
}

export function IterationLog() {
  const [entries, setEntries] = useState<ExperimentRoundResult[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Listen for iteration events
  useEffect(() => {
    const unlisten = listen<ExperimentRoundResult>(
      "experiment-iteration",
      (event) => {
        setEntries((prev) => [...prev, event.payload]);
      },
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Auto-scroll to latest entry
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div style={styles.empty}>
        No iterations yet. Start an experiment to see results here.
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={styles.container}>
      {entries.map((entry, idx) => {
        const indicator = statusIndicator(entry.status);
        const isBaseline = entry.status === "baseline";

        return (
          <div
            key={idx}
            style={{
              ...styles.entry,
              ...(isBaseline ? styles.baselineEntry : {}),
            }}
          >
            <div style={styles.entryHeader}>
              <span
                style={{
                  ...styles.statusIcon,
                  backgroundColor: indicator.color,
                }}
              >
                {indicator.icon}
              </span>
              <span style={styles.roundLabel}>
                {isBaseline ? "Baseline" : `Round ${entry.round}`}
              </span>
              <span style={styles.statusLabel}>{entry.status}</span>
              {entry.metric_value !== null && (
                <span style={styles.metricLabel}>
                  {entry.metric_value.toFixed(4)}
                </span>
              )}
              {entry.duration_seconds !== null && (
                <span style={styles.durationLabel}>
                  {entry.duration_seconds.toFixed(1)}s
                </span>
              )}
            </div>
            {entry.description && (
              <div style={styles.description}>{entry.description}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxHeight: 500,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  empty: {
    color: "#888",
    fontSize: 13,
    fontStyle: "italic",
    padding: "16px 0",
  },
  entry: {
    padding: "8px 10px",
    backgroundColor: "#0f3460",
    borderRadius: 4,
    borderLeft: "3px solid transparent",
  },
  baselineEntry: {
    backgroundColor: "#1a3a5c",
    borderLeftColor: "#7ec8e3",
  },
  entryHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
  },
  statusIcon: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  },
  roundLabel: {
    fontWeight: 600,
    color: "#e0e0e0",
  },
  statusLabel: {
    color: "#888",
    textTransform: "uppercase" as const,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  metricLabel: {
    color: "#7ec8e3",
    fontFamily: "monospace",
    fontSize: 13,
    marginLeft: "auto",
  },
  durationLabel: {
    color: "#888",
    fontSize: 11,
  },
  description: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 4,
    paddingLeft: 28,
    lineHeight: 1.4,
  },
};
