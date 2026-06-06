import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';

interface WsNotification {
  type: 'notification';
  data: {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    is_read: boolean;
    created_at: string;
  };
}

const MAX_RECONNECT_DELAY = 30000;
// 백엔드 장기 장애 시 무한 재시도 방어. 5번 실패 후 포기하고
// 사용자가 명시적으로 페이지 새로고침/재로그인 시 재시도.
const MAX_RECONNECT_ATTEMPTS = 5;

export function useNotificationWs() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  const connect = useCallback(() => {
    if (!accessToken || wsRef.current?.readyState === WebSocket.OPEN) return;

    intentionalCloseRef.current = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // CRIT-08: Do NOT send token in URL query string
    const ws = new WebSocket(`${protocol}//${host}/ws/notifications`);

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      // Send auth token as first message after connection
      ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsNotification;
        if (msg.type === 'notification') {
          queryClient.setQueryData(
            ['notifications', 'unread-count'],
            (old: number | undefined) => (old ?? 0) + 1,
          );
          queryClient.invalidateQueries({ queryKey: ['notifications', 'recent'] });
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (intentionalCloseRef.current) return;
      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        // 최대 재시도 초과 — 무한 루프 회피. 다음 페이지 로드 시 다시 시도됨.
        return;
      }
      const attempt = reconnectAttemptRef.current++;
      const delay = Math.min(5000 * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
      reconnectTimerRef.current = setTimeout(() => connect(), delay);
    };

    ws.onerror = () => {
      // error handled by onclose reconnect
    };

    wsRef.current = ws;
  }, [accessToken, queryClient]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    if (accessToken) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [accessToken, connect, disconnect]);
}
