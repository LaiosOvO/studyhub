/**
 * Experiment control panel with config form and active controls.
 *
 * Shows config form when idle, active controls (pause/resume/skip/guide)
 * when running.
 */

import { useCallback, useState } from "react";
import type { ExperimentStatus } from "../lib/invoke";
import {
  cancelExperiment,
  pauseExperiment,
  resumeExperiment,
  startExperiment,
} from "../lib/invoke";

interface ExperimentControlProps {
  status: ExperimentStatus;
}

export function ExperimentControl({ status }: ExperimentControlProps) {
  const [planId, setPlanId] = useState("");
  const [gpuDevice, setGpuDevice] = useState(0);
  const [maxRounds, setMaxRounds] = useState(20);
  const [noImproveLimit, setNoImproveLimit] = useState(5);
  const [timeBudget, setTimeBudget] = useState<number | "">("");
  const [guidance, setGuidance] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    if (!planId.trim()) {
      setError("Plan ID is required");
      return;
    }
    try {
      await startExperiment(planId, {
        gpu_device: gpuDevice,
        max_rounds: maxRounds,
        consecutive_no_improve_limit: noImproveLimit,
        time_budget: timeBudget || null,
      });
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [planId, gpuDevice, maxRounds, noImproveLimit, timeBudget]);

  const handlePause = useCallback(async () => {
    try {
      await pauseExperiment();
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleResume = useCallback(async () => {
    try {
      await resumeExperiment();
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleCancel = useCallback(async () => {
    if (!confirm("Cancel the current experiment?")) return;
    try {
      await cancelExperiment();
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleGuidance = useCallback(async () => {
    if (!guidance.trim()) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("send_guidance", { guidance });
      setGuidance("");
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [guidance]);

  const handleSkip = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("skip_iteration");
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const isIdle = status.type === "Idle";
  const isRunning = status.type === "Running" || status.type === "RunningBaseline";
  const isPaused = status.type === "Paused";
  const isActive = isRunning || isPaused || status.type === "SettingUp";

  return (
    <div>
      {isIdle && (
        <div style={styles.form}>
          <label style={styles.label}>
            Plan ID
            <input
              type="text"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              style={styles.input}
              placeholder="Enter experiment plan ID"
            />
          </label>

          <label style={styles.label}>
            GPU Device
            <input
              type="number"
              value={gpuDevice}
              onChange={(e) => setGpuDevice(Number(e.target.value))}
              style={styles.inputSmall}
              min={0}
            />
          </label>

          <label style={styles.label}>
            Max Rounds
            <input
              type="range"
              min={1}
              max={100}
              value={maxRounds}
              onChange={(e) => setMaxRounds(Number(e.target.value))}
              style={styles.slider}
            />
            <span style={styles.sliderValue}>{maxRounds}</span>
          </label>

          <label style={styles.label}>
            No-Improvement Limit
            <input
              type="number"
              value={noImproveLimit}
              onChange={(e) => setNoImproveLimit(Number(e.target.value))}
              style={styles.inputSmall}
              min={1}
              max={20}
            />
          </label>

          <label style={styles.label}>
            Time Budget (min, optional)
            <input
              type="number"
              value={timeBudget}
              onChange={(e) =>
                setTimeBudget(e.target.value ? Number(e.target.value) : "")
              }
              style={styles.inputSmall}
              min={1}
              placeholder="No limit"
            />
          </label>

          <button onClick={handleStart} style={styles.startButton}>
            Start Experiment
          </button>
        </div>
      )}

      {isActive && (
        <div style={styles.controls}>
          {/* Progress */}
          {status.type === "Running" && (
            <div style={styles.progress}>
              <div style={styles.progressLabel}>
                Round {status.data.round} / {maxRounds}
              </div>
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${(status.data.round / maxRounds) * 100}%`,
                  }}
                />
              </div>
              <div style={styles.metricDisplay}>
                Best: {status.data.best_metric.toFixed(4)}
              </div>
            </div>
          )}

          {/* Control buttons */}
          <div style={styles.buttonRow}>
            {isRunning && (
              <button onClick={handlePause} style={styles.controlButton}>
                Pause
              </button>
            )}
            {isPaused && (
              <button onClick={handleResume} style={styles.controlButton}>
                Resume
              </button>
            )}
            {(isRunning || isPaused) && (
              <button onClick={handleSkip} style={styles.skipButton}>
                Skip Iteration
              </button>
            )}
            <button onClick={handleCancel} style={styles.cancelButton}>
              Cancel
            </button>
          </div>

          {/* Manual guidance */}
          {(isRunning || isPaused) && (
            <div style={styles.guidanceRow}>
              <input
                type="text"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                style={styles.guidanceInput}
                placeholder="Manual guidance for next iteration..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGuidance();
                }}
              />
              <button onClick={handleGuidance} style={styles.guidanceButton}>
                Send
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    color: "#aaa",
  },
  input: {
    padding: "8px 12px",
    backgroundColor: "#0f3460",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 14,
  },
  inputSmall: {
    padding: "6px 10px",
    backgroundColor: "#0f3460",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 14,
    width: 100,
  },
  slider: {
    width: "100%",
  },
  sliderValue: {
    fontSize: 14,
    color: "#7ec8e3",
    fontWeight: 600,
  },
  startButton: {
    padding: "10px 20px",
    backgroundColor: "#5cb85c",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    marginTop: 8,
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  progress: {
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: "#aaa",
    marginBottom: 4,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#0f3460",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#5cb85c",
    borderRadius: 4,
    transition: "width 0.3s ease",
  },
  metricDisplay: {
    fontSize: 14,
    color: "#7ec8e3",
    marginTop: 4,
    fontWeight: 500,
  },
  buttonRow: {
    display: "flex",
    gap: 8,
  },
  controlButton: {
    padding: "8px 16px",
    backgroundColor: "#533483",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  skipButton: {
    padding: "8px 16px",
    backgroundColor: "#f0ad4e",
    border: "none",
    borderRadius: 4,
    color: "#333",
    cursor: "pointer",
    fontSize: 13,
  },
  cancelButton: {
    padding: "8px 16px",
    backgroundColor: "#d9534f",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  guidanceRow: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  guidanceInput: {
    flex: 1,
    padding: "8px 12px",
    backgroundColor: "#0f3460",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 13,
  },
  guidanceButton: {
    padding: "8px 16px",
    backgroundColor: "#533483",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  error: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#4a1a2e",
    border: "1px solid #d9534f",
    borderRadius: 4,
    fontSize: 12,
    color: "#ff8888",
  },
};
