/**
 * WebSocket fallback system for production environments
 * This provides alternative connection methods when WebSocket fails
 */

import { apiRequest } from '@/lib/queryClient';

export interface WebSocketFallbackOptions {
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  pollingInterval?: number;
}

export class WebSocketFallback {
  private isPolling = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private options: WebSocketFallbackOptions;
  private lastMessageId: number | null = null;

  constructor(options: WebSocketFallbackOptions) {
    this.options = options;
  }

  start() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    console.log('Starting WebSocket fallback polling system');
    
    this.options.onConnect?.();
    
    // Start polling for new messages
    this.pollingInterval = setInterval(() => {
      this.pollForMessages();
    }, this.options.pollingInterval || 5000);
  }

  stop() {
    if (!this.isPolling) return;
    
    this.isPolling = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    console.log('Stopped WebSocket fallback polling system');
    this.options.onDisconnect?.();
  }

  async send(data: any) {
    // For fallback, we'll use HTTP requests instead of WebSocket
    try {
      if (data.type === 'NEW_PRIVATE_MESSAGE') {
        // Handle private message sending through HTTP
        const response = await fetch(`/api/messages/${data.recipientId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data.content }),
          credentials: 'include'
        });
        return response.ok;
      }
      return false;
    } catch (error) {
      console.error('Error sending message via fallback:', error);
      return false;
    }
  }

  private async pollForMessages() {
    try {
      // This would need to be adapted based on your specific message polling needs
      // For now, we'll just log that we're polling
      console.log('Polling for new messages...');
    } catch (error) {
      console.error('Error polling for messages:', error);
    }
  }
}

export function shouldUseFallback(): boolean {
  // Check if we're in a production environment that commonly has WebSocket issues
  const hostname = window.location.hostname;
  
  // Known environments that might have WebSocket proxy issues
  const problematicHosts = [
    'atalou.info',
    'teamtaskflow.atalou.info'
  ];
  
  return problematicHosts.some(host => hostname.includes(host));
}

export function createWebSocketWithFallback(url: string, options: WebSocketFallbackOptions) {
  return new Promise<WebSocket | WebSocketFallback>((resolve, reject) => {
    // First try WebSocket connection
    const ws = new WebSocket(url);
    let connectionTimeout: NodeJS.Timeout;
    
    const cleanup = () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);
    };
    
    // Set a shorter timeout for production environments
    connectionTimeout = setTimeout(() => {
      cleanup();
      ws.close();
      
      console.log('WebSocket connection failed, falling back to HTTP polling');
      
      // If WebSocket fails, use fallback
      if (shouldUseFallback()) {
        const fallback = new WebSocketFallback(options);
        fallback.start();
        resolve(fallback);
      } else {
        reject(new Error('WebSocket connection timeout'));
      }
    }, 5000); // Shorter timeout for production
    
    ws.onopen = () => {
      cleanup();
      console.log('WebSocket connection successful');
      resolve(ws);
    };
    
    ws.onerror = (error) => {
      cleanup();
      console.error('WebSocket connection error:', error);
      
      // Try fallback if we're in a problematic environment
      if (shouldUseFallback()) {
        const fallback = new WebSocketFallback(options);
        fallback.start();
        resolve(fallback);
      } else {
        reject(error);
      }
    };
  });
}