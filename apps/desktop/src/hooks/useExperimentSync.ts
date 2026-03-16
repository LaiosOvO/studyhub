/**
 * React hook managing backend WebSocket sync.
 *
 * Handles connection, disconnection, and payload sending
 * with auto-reconnect on disconnect.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ExperimentSyncPayload } from "../lib/invoke";

interface UseExperimentSyncResult {
  isConnected: boolean;
  error: string | null;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sync: (payload: ExperimentSyncPayload) => Promise<void>;
}

const MAX_RECONNECT_DELAY_MS = 30000;

export function useExperimentSync(): UseExperimentSyncResult {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionRef = useRef<{ url: string; token: string } | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(async (url: string, token: string) => {
    try {
      await invoke("connect_backend", { url, token });
      connectionRef.current = { url, token };
      attemptRef.current = 0;
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(String(err));
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    try {
      await invoke("disconnect_backend");
    } catch {
      // Ignore disconnect errors
    }

    connectionRef.current = null;
    setIsConnected(false);
    setError(null);
  }, []);

  const sync = useCallback(async (payload: ExperimentSyncPayload) => {
    try {
      await invoke("send_sync", { payload });
    } catch (err) {
      setError(String(err));

      // Trigger reconnect on send failure
      if (connectionRef.current && !reconnectRef.current) {
        attemptRef.current += 1;
        const delay = Math.min(
          1000 * Math.pow(2, attemptRef.current),
          MAX_RECONNECT_DELAY_MS,
        );

        reconnectRef.current = setTimeout(async () => {
          reconnectRef.current = null;
          if (connectionRef.current) {
            await connect(connectionRef.current.url, connectionRef.current.token);
          }
        }, delay);
      }
    }
  }, [connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
    };
  }, []);

  return { isConnected, error, connect, disconnect, sync };
}
