import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './use-auth';

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();

  const connect = useCallback(() => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connection established');
      // Start heartbeat
      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      socket.onclose = () => {
        clearInterval(pingInterval);
      };
    };

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket message received:', message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (user) {
          connect();
        }
      }, 5000);
    };

    return () => {
      clearInterval(pingInterval);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [user]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  return { sendMessage };
}
