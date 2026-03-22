/**
 * StudyHub Experiment Agent - Main application layout.
 *
 * Left panel: ExperimentControl + GpuMonitor (stacked)
 * Right panel: IterationLog
 * Bottom: StatusBar
 */

import { useCallback, useEffect, useState } from "react";
import { ExperimentControl } from "./components/ExperimentControl";
import { GpuMonitor } from "./components/GpuMonitor";
import { IterationLog } from "./components/IterationLog";
import { StatusBar } from "./components/StatusBar";
import { useExperimentSync } from "./hooks/useExperimentSync";
import { useGpuMetrics } from "./hooks/useGpuMetrics";
import {
  type ExperimentStatus,
  getExperimentStatus,
} from "./lib/invoke";

export default function App() {
  const [status, setStatus] = useState<ExperimentStatus>({ type: "Idle" });
  const [backendUrl, setBackendUrl] = useState("http://101.126.141.165:8000");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { metrics: gpuMetrics } = useGpuMetrics(0);
  const { isConnected, connect, disconnect } = useExperimentSync();

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

  const handleConnect = useCallback(async () => {
    if (isConnected) {
      await disconnect();
    } else {
      await connect(backendUrl, token);
    }
  }, [isConnected, backendUrl, token, connect, disconnect]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>StudyHub Experiment Agent</h1>
        <div style={styles.connectionRow}>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            style={styles.urlInput}
            placeholder="http://localhost:8000"
          />
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={styles.tokenInput}
            placeholder="JWT token"
          />
          <button onClick={handleConnect} style={styles.connectButton}>
            {isConnected ? "Disconnect" : "Connect"}
          </button>
        </div>
      </header>

      {/* Main content: split layout */}
      <main style={styles.main}>
        {/* Left panel: Control + GPU */}
        <div style={styles.leftPanel}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Experiment Control</h2>
            <ExperimentControl status={status} />
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>GPU Monitor</h2>
            <GpuMonitor deviceId={0} />
          </section>
        </div>

        {/* Right panel: Iteration Log */}
        <div style={styles.rightPanel}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Iteration Log</h2>
            <IterationLog />
          </section>
        </div>
      </main>

      {/* Error display */}
      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Status bar */}
      <StatusBar
        isConnected={isConnected}
        experimentStatus={status}
        gpuMetrics={gpuMetrics}
      />
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#e0e0e0",
    backgroundColor: "#1a1a2e",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    borderBottom: "1px solid #333",
    flexShrink: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
    whiteSpace: "nowrap",
  },
  connectionRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  urlInput: {
    padding: "6px 10px",
    backgroundColor: "#0f3460",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 12,
    width: 200,
  },
  tokenInput: {
    padding: "6px 10px",
    backgroundColor: "#0f3460",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 12,
    width: 120,
  },
  connectButton: {
    padding: "6px 14px",
    backgroundColor: "#533483",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
  },
  main: {
    display: "flex",
    flex: 1,
    gap: 16,
    padding: 16,
    overflow: "hidden",
  },
  leftPanel: {
    width: 340,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto",
  },
  rightPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  section: {
    backgroundColor: "#16213e",
    borderRadius: 8,
    padding: 16,
    border: "1px solid #333",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    margin: "0 0 12px 0",
    color: "#7ec8e3",
  },
  error: {
    margin: "0 16px",
    padding: 8,
    backgroundColor: "#4a1a2e",
    border: "1px solid #d9534f",
    borderRadius: 4,
    fontSize: 12,
    color: "#ff8888",
  },
};
