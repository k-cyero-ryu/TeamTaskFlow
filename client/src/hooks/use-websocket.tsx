import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './use-auth';

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

// Maximum number of reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 5;
// Base delay for reconnection (will be multiplied by attempt number)
const RECONNECT_DELAY = 1000;

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);

  // Create a function to handle connection attempts with retries
  const connect = useCallback(() => {
    if (!user) return;

    // Clear any existing ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log('Connecting to WebSocket at', wsUrl);

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnect counter on success
        
        // Start heartbeat when connection opens
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
              console.error('Error sending ping:', error);
            }
          }
        }, 30000) as unknown as number;
      };

      socket.onmessage = (event) => {
        try {
          if (typeof event.data !== 'string') {
            console.error('Non-string message received:', event.data);
            return;
          }

          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message.type);
          
          // Process standard message types here
          if (message.type === 'pong') {
            // No need to log heartbeats
          } 
          else if (message.type === 'connection_status') {
            console.log('WebSocket connection status:', message.status);
            if (message.status === 'connected') {
              // Connection successfully authenticated
              setConnected(true);
            }
          }
          else if (message.type === 'NEW_GROUP_MESSAGE') {
            // Dispatch a custom event that components can listen for
            const customEvent = new CustomEvent('groupMessage', { 
              detail: message
            });
            window.dispatchEvent(customEvent);
          }
          else if (message.type === 'CHANNEL_MEMBER_ADDED' || message.type === 'CHANNEL_MEMBER_REMOVED') {
            // Dispatch a custom event for membership changes
            const customEvent = new CustomEvent('channelMembershipChanged', { 
              detail: message
            });
            window.dispatchEvent(customEvent);
          }
          else {
            console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      socket.onclose = (event) => {
        console.log('WebSocket closed with code', event.code);
        setConnected(false);
        
        // Clean up the ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Attempt reconnection with backoff
        const reconnectAttempt = ++reconnectAttemptsRef.current;
        if (reconnectAttempt <= MAX_RECONNECT_ATTEMPTS) {
          console.log(`Attempting reconnect ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS}`);
          const delay = RECONNECT_DELAY * reconnectAttempt;
          console.log(`Attempting reconnect in ${delay}ms`);
          setTimeout(() => {
            if (user) {
              connect();
            }
          }, delay);
        } else {
          console.error('Maximum reconnection attempts reached, giving up');
        }
      };

      return () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'User initiated close');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnected(false);
    }
  }, [user]);

  // Initial connection and cleanup
  useEffect(() => {
    const cleanup = connect();
    
    // Window focus event to attempt reconnection if needed
    const handleFocus = () => {
      if (socketRef.current?.readyState !== WebSocket.OPEN && user) {
        connect();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      cleanup?.();
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close(1000, 'Cleanup');
        }
        socketRef.current = null;
      }
    };
  }, [connect, user]);

  // Safe method to send messages
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('WebSocket is not connected, message not sent');
      
      // Try to reconnect if not already connected
      if (socketRef.current?.readyState !== WebSocket.CONNECTING && user) {
        console.log('Attempting reconnection due to message send failure');
        connect();
      }
      
      return false;
    }
  }, [connect, user]);

  return { 
    sendMessage, 
    socket: socketRef.current,
    connected
  };
}