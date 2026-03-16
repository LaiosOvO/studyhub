/**
 * Connection status bar displayed at the bottom of the desktop app.
 *
 * Shows backend connection status, current experiment state,
 * and compact GPU indicators.
 */

import type { ExperimentStatus, GpuMetrics } from "../lib/invoke";

interface StatusBarProps {
  isConnected: boolean;
  experimentStatus: ExperimentStatus;
  gpuMetrics: GpuMetrics | null;
}

function getStatusLabel(status: ExperimentStatus): string {
  switch (status.type) {
    case "Idle":
      return "Idle";
    case "SettingUp":
      return "Setting Up";
    case "RunningBaseline":
      return "Baseline";
    case "Running":
      return `Round ${status.data.round}`;
    case "Paused":
      return "Paused";
    case "Completed":
      return "Done";
    case "Failed":
      return "Failed";
  }
}

export function StatusBar({
  isConnected,
  experimentStatus,
  gpuMetrics,
}: StatusBarProps) {
  return (
    <div style={styles.bar}>
      {/* Connection indicator */}
      <div style={styles.segment}>
        <span
          style={{
            ...styles.dot,
            backgroundColor: isConnected ? "#5cb85c" : "#d9534f",
          }}
        />
        <span style={styles.label}>
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Experiment status */}
      <div style={styles.segment}>
        <span style={styles.label}>
          Experiment: {getStatusLabel(experimentStatus)}
        </span>
      </div>

      {/* GPU compact indicators */}
      {gpuMetrics && gpuMetrics.name !== "unavailable" && (
        <div style={styles.segment}>
          <span style={styles.label}>
            GPU: {gpuMetrics.gpu_utilization_pct.toFixed(0)}% |{" "}
            {gpuMetrics.temperature_c}C
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "6px 16px",
    backgroundColor: "#0f3460",
    borderTop: "1px solid #333",
    fontSize: 12,
    color: "#aaa",
  },
  segment: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  label: {
    whiteSpace: "nowrap",
  },
};
