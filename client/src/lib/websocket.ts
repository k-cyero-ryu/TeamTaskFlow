import { queryClient } from "./queryClient";

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'workflow_stage_created':
            // Invalidate workflow stages cache to trigger a refetch
            queryClient.invalidateQueries({
              queryKey: [`/api/workflows/${message.data.workflowId}/stages`]
            });
            break;
          case 'task_created':
            // Invalidate tasks cache
            queryClient.invalidateQueries({
              queryKey: ['/api/tasks']
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/workflows/${message.data.workflowId}/stages/${message.data.stageId}/tasks`]
            });
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
