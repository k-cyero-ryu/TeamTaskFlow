import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface WebSocketConnectionOptions {
  url: string;
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  connectionTimeout?: number;
}

export function useWebSocketConnection(options: WebSocketConnectionOptions) {
  const { url, onMessage, onConnect, onDisconnect, maxReconnectAttempts = 5, reconnectDelay = 1000, connectionTimeout = 10000 } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('Attempting WebSocket connection to:', url);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      // Clear any existing timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }

      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.error('WebSocket connection timeout');
          ws.close();
        }
      }, connectionTimeout);

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        setIsConnected(true);
        setReconnectAttempts(0);
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        setIsConnected(false);
        wsRef.current = null;
        onDisconnect?.();

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Attempt to reconnect if within limits
        if (reconnectAttempts < maxReconnectAttempts) {
          const backoffDelay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts), 30000);
          console.log(`Attempting reconnect in ${backoffDelay}ms (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, backoffDelay);
        } else {
          console.error('Max reconnection attempts reached');
          toast({
            title: "Connection Failed",
            description: "Unable to connect to chat server. Please refresh the page.",
            variant: "destructive",
          });
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        console.error('WebSocket error details:', {
          url,
          readyState: ws.readyState,
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          port: window.location.port
        });
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        setIsConnected(false);
        
        // Show error toast only if this is the first few attempts
        if (reconnectAttempts < 3) {
          toast({
            title: "Connection Error",
            description: "Failed to connect to chat server. Retrying...",
            variant: "destructive",
          });
        }
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setReconnectAttempts(0);
  };

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  };

  useEffect(() => {
    connect();
    return disconnect;
  }, [url]);

  return {
    isConnected,
    reconnectAttempts,
    send,
    disconnect,
    reconnect: connect
  };
}