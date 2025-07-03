import { queryClient } from "./queryClient";

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    try {
      // If already connected, do nothing
      if (this.ws?.readyState === WebSocket.OPEN) return;
      
      // Clean up any existing connection first
      this.disconnect();
      
      // Create new connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        console.error("Failed to create WebSocket connection:", err);
        return;
      }

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
          console.log("WebSocket message received:", message.type);
          
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
            case 'task_due_date_updated':
              // Update the task directly in the cache
              const updatedTask = message.data;
              queryClient.setQueryData<any[]>(['/api/tasks'], (oldTasks) => {
                if (!oldTasks) return oldTasks;
                return oldTasks.map(task => 
                  task.id === updatedTask.id ? { ...task, dueDate: updatedTask.dueDate } : task
                );
              });
              
              // Also invalidate to trigger any other queries that might be affected
              queryClient.invalidateQueries({
                queryKey: ['/api/tasks']
              });
              if (message.data.workflowId && message.data.stageId) {
                queryClient.invalidateQueries({
                  queryKey: [`/api/workflows/${message.data.workflowId}/stages/${message.data.stageId}/tasks`]
                });
              }
              break;
            default:
              console.log("Unknown WebSocket message type:", message.type);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`WebSocket closed with code ${event.code}${event.reason ? `: ${event.reason}` : ''}`);
        
        // Only attempt to reconnect if this wasn't a clean close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`Attempting reconnect ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
          this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Error handling is delegated to onclose which will be called after onerror
      };
    } catch (error) {
      console.error("Unexpected error in WebSocket connect():", error);
    }
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    try {
      // Cancel any pending reconnection attempts
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Close the connection if it exists
      if (this.ws) {
        // Only try to close if the socket is not already closing or closed
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          try {
            console.log("Closing WebSocket connection");
            this.ws.close(1000, "Client disconnecting");
          } catch (err) {
            console.error("Error closing WebSocket:", err);
          }
        }
        // Clean up reference
        this.ws = null;
      }
      
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error("Error in disconnect:", error);
    }
  }
}

export const wsClient = new WebSocketClient();
