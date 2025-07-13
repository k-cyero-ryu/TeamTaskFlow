/**
 * Robust chat connection system with WebSocket and HTTP fallback
 */

import { apiRequest } from '@/lib/queryClient';
import { getWebSocketConfig } from './websocket-config';

export interface ChatMessage {
  id: number;
  content: string;
  senderId: number;
  recipientId: number;
  createdAt: string;
  readAt: string | null;
  sender: {
    id: number;
    username: string;
  };
}

export interface ChatConnectionOptions {
  userId: number;
  otherUserId: number;
  onMessage: (message: ChatMessage) => void;
  onConnectionChange: (connected: boolean) => void;
  onError: (error: string) => void;
}

export class ChatConnection {
  private ws: WebSocket | null = null;
  private options: ChatConnectionOptions;
  private isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private lastMessageId = 0;
  private useFallback = false;
  private config = getWebSocketConfig();

  constructor(options: ChatConnectionOptions) {
    this.options = options;
  }

  async connect() {
    if (this.isConnected) return;

    // Check if we should use fallback mode for this domain
    if (this.shouldUseFallback()) {
      console.log('Using HTTP fallback for chat connection');
      this.useFallback = true;
      this.startFallbackMode();
      return;
    }

    try {
      await this.connectWebSocket();
    } catch (error) {
      console.error('WebSocket connection failed, switching to fallback:', error);
      this.useFallback = true;
      this.startFallbackMode();
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.url);
      this.ws = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, this.config.connectionTimeout);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.options.onConnectionChange(true);
        
        // Send identification
        ws.send(JSON.stringify({
          type: 'identify',
          userId: this.options.userId
        }));
        
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'private_message' && data.data) {
            this.options.onMessage(data.data);
          } else if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.ws = null;
        this.options.onConnectionChange(false);

        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          const delay = Math.min(
            this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            30000
          );
          console.log(`Reconnecting in ${delay}ms (${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts})`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connectWebSocket().catch(() => {
              console.log('WebSocket reconnection failed, switching to fallback');
              this.useFallback = true;
              this.startFallbackMode();
            });
          }, delay);
        } else {
          console.log('Max reconnection attempts reached, switching to fallback');
          this.useFallback = true;
          this.startFallbackMode();
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('WebSocket error:', error);
        this.isConnected = false;
        this.options.onConnectionChange(false);
        reject(error);
      };
    });
  }

  private shouldUseFallback(): boolean {
    const hostname = window.location.hostname;
    
    // Known problematic domains that have WebSocket proxy issues
    const problematicDomains = [
      'atalou.info',
      'teamtaskflow.atalou.info'
    ];
    
    return problematicDomains.some(domain => hostname.includes(domain));
  }

  private startFallbackMode() {
    console.log('Starting HTTP fallback mode for chat');
    this.isConnected = true;
    this.options.onConnectionChange(true);
    
    // Poll for new messages every 3 seconds
    this.fallbackInterval = setInterval(() => {
      this.pollForMessages();
    }, 3000);
  }

  private async pollForMessages() {
    try {
      const response = await fetch(`/api/messages/${this.options.otherUserId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) return;
      
      const messages: ChatMessage[] = await response.json();
      
      // Find new messages since last poll
      const newMessages = messages.filter(msg => msg.id > this.lastMessageId);
      
      if (newMessages.length > 0) {
        this.lastMessageId = Math.max(...newMessages.map(m => m.id));
        
        // Notify about new messages
        newMessages.forEach(message => {
          this.options.onMessage(message);
        });
      }
    } catch (error) {
      console.error('Error polling for messages:', error);
    }
  }

  async sendMessage(content: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      if (this.useFallback) {
        // Use HTTP API for fallback
        const response = await fetch(`/api/messages/${this.options.otherUserId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          credentials: 'include'
        });
        
        return response.ok;
      } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Use WebSocket
        this.ws.send(JSON.stringify({
          type: 'NEW_PRIVATE_MESSAGE',
          content,
          recipientId: this.options.otherUserId
        }));
        return true;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.options.onError('Failed to send message');
    }
    
    return false;
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.options.onConnectionChange(false);
  }
}