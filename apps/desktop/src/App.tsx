/**
 * StudyHub Experiment Agent - Main application shell.
 *
 * Displays connection status, experiment state, and placeholder
 * sections for experiment control and GPU monitoring.
 */

import { useCallback, useEffect, useState } from "react";
import {
  type ExperimentStatus,
  getExperimentStatus,
} from "./lib/invoke";

/** Format experiment status for display. */
function formatStatus(status: ExperimentStatus): string {
  switch (status.type) {
    case "Idle":
      return "Idle - Ready to start";
    case "SettingUp":
      return `Setting up experiment for plan ${status.data.plan_id}`;
    case "RunningBaseline":
      return `Running baseline for plan ${status.data.plan_id}`;
    case "Running":
      return `Running round ${status.data.round} (best: ${status.data.best_metric.toFixed(4)})`;
    case "Paused":
      return `Paused at round ${status.data.round}`;
    case "Completed":
      return `Completed after ${status.data.rounds} rounds`;
    case "Failed":
      return `Failed: ${status.data.error}`;
  }
}

/** Status color based on experiment state. */
function statusColor(status: ExperimentStatus): string {
  switch (status.type) {
    case "Idle":
      return "#888";
    case "SettingUp":
    case "RunningBaseline":
      return "#f0ad4e";
    case "Running":
      return "#5cb85c";
    case "Paused":
      return "#f0ad4e";
    case "Completed":
      return "#5cb85c";
    case "Failed":
      return "#d9534f";
  }
}

export default function App() {
  const [status, setStatus] = useState<ExperimentStatus>({ type: "Idle" });
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll experiment status every 2 seconds
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const result = await getExperimentStatus();
        setStatus(result);
        setError(null);
      } catch (err) {
        setError(String(err));
      }
    }, 2000);

    return () => clearInterval(poll);
  }, []);

  const handleConnect = useCallback(() => {
    // Connection logic will be wired in Plan 08-03
    setConnected(true);
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>StudyHub Experiment Agent</h1>
        <div style={styles.statusBadge}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: statusColor(status),
            }}
          />
          <span>{formatStatus(status)}</span>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        {/* Connection Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Backend Connection</h2>
          <div style={styles.connectionRow}>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              style={styles.input}
              placeholder="http://localhost:8000"
            />
            <button onClick={handleConnect} style={styles.button}>
              {connected ? "Connected" : "Connect"}
            </button>
            <span
              style={{
                ...styles.connectionDot,
                backgroundColor: connected ? "#5cb85c" : "#d9534f",
              }}
            />
          </div>
        </section>

        {/* Experiment Control Placeholder */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Experiment Control</h2>
          <p style={styles.placeholder}>
            Experiment control panel will be added in Plan 08-04.
            Start, pause, resume, and configure experiments here.
          </p>
        </section>

        {/* GPU Monitor Placeholder */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>GPU Monitor</h2>
          <p style={styles.placeholder}>
            Real-time GPU utilization, memory, and temperature
            display will be added in Plan 08-03.
          </p>
        </section>
      </main>

      {/* Error display */}
      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: 1000,
    margin: "0 auto",
    padding: 20,
    color: "#e0e0e0",
    backgroundColor: "#1a1a2e",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #333",
    paddingBottom: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  section: {
    backgroundColor: "#16213e",
    borderRadius: 8,
    padding: 20,
    border: "1px solid #333",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: "0 0 12px 0",
    color: "#7ec8e3",
  },
  connectionRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    backgroundColor: "#0f3460",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 14,
  },
  button: {
    padding: "8px 20px",
    backgroundColor: "#533483",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  connectionDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    display: "inline-block",
  },
  placeholder: {
    color: "#888",
    fontSize: 14,
    fontStyle: "italic",
  },
  error: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#4a1a2e",
    border: "1px solid #d9534f",
    borderRadius: 4,
    fontSize: 13,
    color: "#ff8888",
  },
};
