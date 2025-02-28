import { queryClient } from "./queryClient";

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      // Use relative WebSocket URL to match current protocol and host
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
      console.log('Attempting WebSocket connection to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          switch (message.type) {
            case 'workflow_stage_created':
              queryClient.invalidateQueries({
                queryKey: [`/api/workflows/${message.data.workflowId}/stages`]
              });
              break;
            case 'task_created':
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
        console.log('WebSocket disconnected');
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectTimer = setTimeout(() => {
            console.log(`Attempting to reconnect... (attempt ${this.reconnectAttempts + 1})`);
            this.reconnectAttempts++;
            this.connect();
          }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectTimer = setTimeout(() => {
          console.log(`Attempting to reconnect after error... (attempt ${this.reconnectAttempts + 1})`);
          this.reconnectAttempts++;
          this.connect();
        }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
      }
    }
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected, message not sent:', data);
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