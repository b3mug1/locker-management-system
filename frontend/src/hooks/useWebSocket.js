import { useEffect, useRef, useCallback } from 'react';

const getWsUrl = () => {
  let apiUrl = import.meta.env.VITE_API_URL || 'https://locker-backend-4e74.onrender.com';
  if (apiUrl.includes('locker-management-backend')) {
    apiUrl = 'https://locker-backend-4e74.onrender.com';
  }

  if (apiUrl && apiUrl.startsWith('http')) {
    try {
      const url = new URL(apiUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}/ws`;
    } catch {
      // fallback if invalid URL
    }
  }
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
};

const WS_URL = getWsUrl();

/**
 * Custom hook for WebSocket real-time updates.
 * @param {Object} handlers - Map of event names to callback functions
 *   e.g. { locker_change: () => refetch(), student_change: () => refetch() }
 */
export function useWebSocket(handlers) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const handler = handlersRef.current[msg.event];
        if (handler) handler(msg.data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);
}
