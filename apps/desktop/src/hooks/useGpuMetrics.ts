/**
 * React hook subscribing to Tauri "gpu-metrics" events.
 *
 * Starts GPU monitoring on mount, stops on unmount.
 * Returns latest GPU metrics, monitoring state, and errors.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GpuMetrics } from "../lib/invoke";

interface UseGpuMetricsResult {
  metrics: GpuMetrics | null;
  isMonitoring: boolean;
  error: string | null;
}

export function useGpuMetrics(deviceId: number = 0): UseGpuMetricsResult {
  const [metrics, setMetrics] = useState<GpuMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const startMonitoring = useCallback(async () => {
    try {
      // Listen for GPU metrics events
      const unlisten = await listen<GpuMetrics>("gpu-metrics", (event) => {
        setMetrics(event.payload);
      });
      unlistenRef.current = unlisten;

      // Start the monitoring subprocess
      await invoke("start_gpu_monitoring", { deviceId });
      setIsMonitoring(true);
      setError(null);
    } catch (err) {
      setError(String(err));
      setIsMonitoring(false);
    }
  }, [deviceId]);

  const stopMonitoring = useCallback(async () => {
    try {
      await invoke("stop_gpu_monitoring");
    } catch {
      // Ignore errors on stop
    }

    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    setIsMonitoring(false);
  }, []);

  useEffect(() => {
    startMonitoring();

    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  return { metrics, isMonitoring, error };
}
