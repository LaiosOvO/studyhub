/**
 * Real-time GPU metrics display component.
 *
 * Shows GPU utilization, memory, temperature, and power
 * with color-coded progress bars.
 */

import { useGpuMetrics } from "../hooks/useGpuMetrics";

interface GpuMonitorProps {
  deviceId?: number;
}

/** Get color based on utilization percentage. */
function utilizationColor(pct: number): string {
  if (pct >= 85) return "#d9534f";
  if (pct >= 60) return "#f0ad4e";
  return "#5cb85c";
}

/** Progress bar component. */
function ProgressBar({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div style={styles.barContainer}>
      <div style={styles.barLabel}>
        <span>{label}</span>
        <span>
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export function GpuMonitor({ deviceId = 0 }: GpuMonitorProps) {
  const { metrics, isMonitoring, error } = useGpuMetrics(deviceId);

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.noGpu}>GPU monitoring error: {error}</div>
      </div>
    );
  }

  if (!metrics || metrics.name === "unavailable") {
    return (
      <div style={styles.container}>
        <div style={styles.noGpu}>
          No GPU detected
          {isMonitoring ? " (monitoring active)" : ""}
        </div>
      </div>
    );
  }

  const utilPct = metrics.gpu_utilization_pct;
  const memPct =
    metrics.memory_total_mb > 0
      ? (metrics.memory_used_mb / metrics.memory_total_mb) * 100
      : 0;
  const tempWarning = metrics.temperature_c > 80;

  return (
    <div style={styles.container}>
      <div style={styles.header}>{metrics.name}</div>

      <ProgressBar
        value={utilPct}
        max={100}
        label="Utilization %"
        color={utilizationColor(utilPct)}
      />

      <ProgressBar
        value={metrics.memory_used_mb}
        max={metrics.memory_total_mb}
        label="Memory (MB)"
        color={utilizationColor(memPct)}
      />

      <div style={styles.metricsRow}>
        <div style={styles.metric}>
          <span style={tempWarning ? styles.tempWarning : styles.tempNormal}>
            {tempWarning ? "! " : ""}
            {metrics.temperature_c}C
          </span>
          <span style={styles.metricLabel}>Temperature</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{metrics.power_watts}W</span>
          <span style={styles.metricLabel}>Power</span>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 0,
  },
  header: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 12,
    color: "#7ec8e3",
  },
  noGpu: {
    color: "#888",
    fontSize: 13,
    fontStyle: "italic",
    padding: "8px 0",
  },
  barContainer: {
    marginBottom: 10,
  },
  barLabel: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#aaa",
    marginBottom: 4,
  },
  barTrack: {
    height: 8,
    backgroundColor: "#0f3460",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.3s ease",
  },
  metricsRow: {
    display: "flex",
    gap: 24,
    marginTop: 8,
  },
  metric: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 500,
    color: "#e0e0e0",
  },
  tempNormal: {
    fontSize: 16,
    fontWeight: 500,
    color: "#e0e0e0",
  },
  tempWarning: {
    fontSize: 16,
    fontWeight: 500,
    color: "#d9534f",
  },
};
