import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse as parseCookie } from 'cookie';
import { Logger } from './utils/logger';
import { clients } from './websocket';
import { storage } from './storage';

const logger = new Logger('WebSocketHandler');

export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    clientTracking: true,
  });

  wss.on("connection", handleConnection);

  wss.on("error", (error) => {
    logger.error("WebSocket server error", { error });
  });

  return wss;
}

/**
 * Handle new WebSocket connections
 */
async function handleConnection(ws: WebSocket, req: any) {
  try {
    logger.info("WebSocket connection attempt", { 
      ip: req.socket.remoteAddress,
      headers: sanitizeHeaders(req.headers) 
    });

    // Parse cookies from the upgrade request
    const cookies = parseCookie(req.headers.cookie || '');
    const sessionID = extractSessionId(cookies);

    if (!sessionID) {
      logger.warn('WebSocket connection rejected: No valid session ID', { 
        availableCookies: Object.keys(cookies)
      });
      ws.close(1008, 'Unauthorized');
      return;
    }

    logger.info('WebSocket connection attempt with session ID', { sessionId: sessionID });

    // Verify session and get user data
    authenticateWebSocketConnection(ws, sessionID);

    // Set up message handlers
    setupWebSocketEventHandlers(ws);
  } catch (error) {
    logger.error("WebSocket connection error", { error });
    ws.close(1011, 'Internal Server Error');
  }
}

/**
 * Extract session ID from cookies
 */
function extractSessionId(cookies: Record<string, string | undefined>): string | null {
  const sessionCookie = cookies['connect.sid'];
  if (!sessionCookie) return null;
  
  try {
    // Session ID format is typically s:<ID>.<SIGNATURE>
    return sessionCookie.split('.')[0].slice(2);
  } catch (error) {
    logger.error("Error extracting session ID", { error, sessionCookie });
    return null;
  }
}

/**
 * Authenticate the WebSocket connection using the session store
 */
function authenticateWebSocketConnection(ws: WebSocket, sessionID: string): void {
  const sessionStore = storage.sessionStore;
  
  sessionStore.get(sessionID, (err, session) => {
    if (err) {
      logger.error('Session store error', { error: err });
      ws.close(1008, 'Session store error');
      return;
    }

    if (!session) {
      logger.warn('No session found', { sessionID });
      ws.close(1008, 'No session found');
      return;
    }

    if (!session.passport?.user) {
      logger.warn('No passport user in session', { 
        sessionID,
        hasPassport: !!session.passport 
      });
      ws.close(1008, 'Unauthorized');
      return;
    }

    const userId = session.passport.user;
    clients.set(ws, userId);

    logger.info(`WebSocket client connected and authenticated`, { userId });

    ws.send(JSON.stringify({
      type: "connection_status",
      status: "connected",
      userId
    }));
  });
}

/**
 * Set up event handlers for a WebSocket connection
 */
function setupWebSocketEventHandlers(ws: WebSocket): void {
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      const userId = clients.get(ws);
      
      logger.debug("Received WebSocket message", { 
        type: message.type, 
        userId 
      });

      if (message.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      } else if (message.type === "NEW_GROUP_MESSAGE" && message.data) {
        // Handle group message event
        logger.debug("Handling group message event", { 
          channelId: message.data.channelId,
          messageId: message.data.id
        });
        
        // Find members to broadcast to (will be handled in the route handler)
      } else if (message.type === "CHANNEL_MEMBER_ADDED" || message.type === "CHANNEL_MEMBER_REMOVED") {
        // Handle channel membership changes
        logger.debug("Handling channel membership event", { 
          type: message.type,
          channelId: message.data?.channelId
        });
      }
    } catch (error) {
      logger.error("WebSocket message handling error", { error });
      
      try {
        ws.send(JSON.stringify({
          type: "error",
          message: "Failed to process message"
        }));
      } catch (sendError) {
        logger.error("Error sending error response", { error: sendError });
      }
    }
  });

  ws.on("close", () => {
    const userId = clients.get(ws);
    logger.info("WebSocket client disconnected", { userId });
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    const userId = clients.get(ws);
    logger.error("WebSocket client error", { error, userId });
    clients.delete(ws);
    
    try {
      ws.close();
    } catch (closeError) {
      logger.error("Error closing WebSocket", { error: closeError });
    }
  });
}

/**
 * Sanitize headers for logging (removes sensitive info)
 */
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };
  
  // Remove potentially sensitive headers
  ['cookie', 'authorization', 'x-auth-token'].forEach(key => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}