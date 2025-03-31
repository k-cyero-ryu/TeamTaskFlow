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

    console.log('Attempting WebSocket connection to:', wsUrl);

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connection established');
        // Start heartbeat when connection opens
        const pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        // Clean up interval when connection closes
        socket.onclose = () => {
          clearInterval(pingInterval);
        };
      };

      socket.onmessage = (event) => {
        try {
          let message: WebSocketMessage;
          
          // Handle both string-only messages and JSON objects
          if (typeof event.data === 'string') {
            try {
              message = JSON.parse(event.data);
            } catch (parseError) {
              // If it's not valid JSON, treat it as a plain string message
              console.log('WebSocket message received:', event.data);
              return;
            }
          } else {
            console.error('Non-string message received:', event.data);
            return;
          }
          
          console.log('WebSocket message received:', message);

          if (message.type === 'pong') {
            console.log('Heartbeat acknowledged');
          }
          
          // Let the message event propagate naturally
          // This allows components to add their own listeners and handle specific message types
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
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
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
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

  return { sendMessage, socket: socketRef.current };
}