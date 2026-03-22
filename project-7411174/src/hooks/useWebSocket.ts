/**
 * useWebSocket — gpt-researcher pattern
 *
 * Features:
 * - Lazy initialization: socket only opens when you call connect()
 * - Auto-reconnect with exponential back-off (max 5 attempts)
 * - Connection-state machine: idle → connecting → open → closing → closed | error
 * - Per-message-type event handlers
 * - Clean unmount: cancels pending reconnect timers and closes socket
 *
 * Usage:
 *   const { status, connect, disconnect, send } = useWebSocket({
 *     url: 'ws://localhost:8000/ws/research/task-123',
 *     onMessage: (msg) => dispatch(msg),
 *   });
 */

import { useRef, useState, useCallback, useEffect } from "react";

export type WsStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closing"
  | "closed"
  | "error";

export interface WsMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export interface UseWebSocketOptions {
  /** WebSocket URL, e.g. ws://api.example.com/ws/task/42 */
  url?: string;
  /** Called for every parsed JSON message received */
  onMessage?: (msg: WsMessage) => void;
  /** Called when the connection opens */
  onOpen?: () => void;
  /** Called when the connection closes */
  onClose?: (code: number, reason: string) => void;
  /** Called on a connection error */
  onError?: (event: Event) => void;
  /** Max reconnect attempts before giving up (default: 5) */
  maxRetries?: number;
  /** Base back-off delay in ms (doubles each retry, default: 1000) */
  baseDelay?: number;
  /** Whether to auto-reconnect on unexpected close (default: true) */
  autoReconnect?: boolean;
}

export interface UseWebSocketReturn {
  /** Current connection state */
  status: WsStatus;
  /** Open the WebSocket connection */
  connect: (url?: string) => void;
  /** Gracefully close the connection */
  disconnect: () => void;
  /** Send a JSON-serializable payload */
  send: (payload: WsMessage) => boolean;
  /** Current retry attempt count */
  retryCount: number;
}

const MAX_RETRIES_DEFAULT = 5;
const BASE_DELAY_DEFAULT = 1000;

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url: initialUrl,
    onMessage,
    onOpen,
    onClose,
    onError,
    maxRetries = MAX_RETRIES_DEFAULT,
    baseDelay = BASE_DELAY_DEFAULT,
    autoReconnect = true,
  } = options;

  const [status, setStatus] = useState<WsStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);

  // Keep mutable refs so callbacks always see the latest values without
  // requiring reconnect on every options change.
  const socketRef = useRef<WebSocket | null>(null);
  const urlRef = useRef<string | undefined>(initialUrl);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);

  // Keep option callbacks in refs so they can be updated without recreating
  // the connect function.
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (socketRef.current) {
        intentionalCloseRef.current = true;
        socketRef.current.close(1000, "component_unmount");
      }
    };
  }, []);

  const scheduleReconnect = useCallback(
    (wsUrl: string) => {
      const attempt = retryCountRef.current;
      if (!autoReconnect || attempt >= maxRetries) {
        if (isMountedRef.current) setStatus("error");
        return;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      retryCountRef.current = attempt + 1;
      if (isMountedRef.current) {
        setRetryCount(attempt + 1);
        setStatus("reconnecting");
      }

      retryTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && !intentionalCloseRef.current) {
          openSocket(wsUrl);
        }
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoReconnect, maxRetries, baseDelay]
  );

  const openSocket = useCallback(
    (wsUrl: string) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      intentionalCloseRef.current = false;
      if (isMountedRef.current) setStatus("connecting");

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        console.error("[useWebSocket] Failed to create WebSocket:", err);
        if (isMountedRef.current) setStatus("error");
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        retryCountRef.current = 0;
        setRetryCount(0);
        setStatus("open");
        onOpenRef.current?.();
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const parsed: WsMessage = typeof event.data === "string"
            ? JSON.parse(event.data)
            : event.data;
          onMessageRef.current?.(parsed);
        } catch {
          // Non-JSON frames — wrap in a generic message
          onMessageRef.current?.({ type: "raw", data: event.data });
        }
      };

      ws.onerror = (event: Event) => {
        console.error("[useWebSocket] Connection error", event);
        onErrorRef.current?.(event);
        if (isMountedRef.current) setStatus("error");
      };

      ws.onclose = (event: CloseEvent) => {
        if (!isMountedRef.current) return;
        onCloseRef.current?.(event.code, event.reason);

        if (intentionalCloseRef.current || event.code === 1000) {
          setStatus("closed");
        } else {
          scheduleReconnect(wsUrl);
        }
      };
    },
    [scheduleReconnect]
  );

  const connect = useCallback(
    (url?: string) => {
      const wsUrl = url ?? urlRef.current;
      if (!wsUrl) {
        console.warn("[useWebSocket] connect() called without a URL");
        return;
      }
      urlRef.current = wsUrl;
      retryCountRef.current = 0;
      setRetryCount(0);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      openSocket(wsUrl);
    },
    [openSocket]
  );

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (socketRef.current) {
      setStatus("closing");
      socketRef.current.close(1000, "client_disconnect");
    }
  }, []);

  const send = useCallback((payload: WsMessage): boolean => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      console.warn("[useWebSocket] send() called but socket is not open");
      return false;
    }
    try {
      socketRef.current.send(JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error("[useWebSocket] send() error:", err);
      return false;
    }
  }, []);

  return { status, connect, disconnect, send, retryCount };
}

// ── Status helper ────────────────────────────────────────────────────────────
export function wsStatusLabel(status: WsStatus): string {
  const labels: Record<WsStatus, string> = {
    idle: "未连接",
    connecting: "连接中",
    open: "已连接",
    reconnecting: "重新连接中",
    closing: "断开中",
    closed: "已断开",
    error: "连接错误",
  };
  return labels[status];
}

export function wsStatusColor(status: WsStatus): string {
  const colors: Record<WsStatus, string> = {
    idle: "text-text-muted",
    connecting: "text-amber-400",
    open: "text-green-400",
    reconnecting: "text-amber-400",
    closing: "text-text-muted",
    closed: "text-text-muted",
    error: "text-red-400",
  };
  return colors[status];
}
