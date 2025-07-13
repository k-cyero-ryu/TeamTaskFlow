/**
 * WebSocket configuration for different environments
 */

interface WebSocketConfig {
  url: string;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  connectionTimeout: number;
}

export function getWebSocketConfig(): WebSocketConfig {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost = window.location.host;
  
  // Base configuration
  const baseConfig: WebSocketConfig = {
    url: `${wsProtocol}//${wsHost}/ws`,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    connectionTimeout: 10000
  };

  // Production environment specific configurations
  if (window.location.hostname.includes('atalou.info')) {
    // For custom domain deployments, try different approaches
    return {
      ...baseConfig,
      maxReconnectAttempts: 10,
      reconnectDelay: 2000,
      connectionTimeout: 15000,
      url: `${wsProtocol}//${wsHost}/ws`
    };
  }

  // Replit deployment configurations
  if (window.location.hostname.includes('.replit.dev') || 
      window.location.hostname.includes('.replit.app')) {
    return {
      ...baseConfig,
      maxReconnectAttempts: 8,
      reconnectDelay: 1500,
      connectionTimeout: 12000
    };
  }

  // Development environment
  return baseConfig;
}

export function validateWebSocketSupport(): boolean {
  return typeof WebSocket !== 'undefined' && WebSocket.CLOSING !== undefined;
}

export function getWebSocketDebugInfo() {
  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    port: window.location.port,
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    webSocketSupport: validateWebSocketSupport()
  };
}