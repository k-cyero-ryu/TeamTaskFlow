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
    // Add WebSocket compression options for better performance
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Only use compression for messages larger than 1KB
      threshold: 1024,
      // Disable context takeover for consistent performance
      serverNoContextTakeover: true,
      clientNoContextTakeover: true
    }
  });

  wss.on("connection", handleConnection);

  wss.on("error", (error) => {
    logger.error("WebSocket server error", { error });
  });

  // Set up a server-side heartbeat to keep connections alive
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Send ping to active clients
          ws.send(JSON.stringify({ type: "ping" }));
        } catch (error) {
          logger.error("Error sending ping", { error });
        }
      }
    });
  }, 30000); // Send ping every 30 seconds

  // Clean up interval when server shuts down
  server.on("close", () => {
    clearInterval(pingInterval);
    logger.info("WebSocket server closed, heartbeat stopped");
  });

  return wss;
}

/**
 * Handle new WebSocket connections with more robust error handling
 */
async function handleConnection(ws: WebSocket, req: any) {
  try {
    // Get IP address with fallbacks
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket.remoteAddress || 
               'unknown';
               
    logger.info("WebSocket connection attempt", { 
      ip,
      headers: sanitizeHeaders(req.headers) 
    });

    // Ensure cookie header exists
    if (!req.headers.cookie) {
      logger.warn('WebSocket connection rejected: No cookies provided');
      ws.close(1008, 'No cookies provided');
      return;
    }

    try {
      // Parse cookies from the upgrade request with error handling
      const cookies = parseCookie(req.headers.cookie);
      const sessionID = extractSessionId(cookies);

      if (!sessionID) {
        logger.warn('WebSocket connection rejected: No valid session ID', { 
          availableCookies: Object.keys(cookies)
        });
        ws.close(1008, 'No valid session ID');
        return;
      }

      logger.info('WebSocket connection attempt with session ID', { sessionId: sessionID });

      // Verify session and get user data
      authenticateWebSocketConnection(ws, sessionID);

      // Set up message handlers
      setupWebSocketEventHandlers(ws);
      
      // Set a timeout in case authentication doesn't respond
      const authTimeout = setTimeout(() => {
        if (!clients.has(ws) && ws.readyState === WebSocket.OPEN) {
          logger.warn('WebSocket authentication timed out');
          ws.close(1008, 'Authentication timeout');
        }
      }, 10000); // 10 second timeout
      
      // Clear the timeout when the connection closes
      ws.once('close', () => {
        clearTimeout(authTimeout);
      });
      
    } catch (cookieError) {
      logger.error('Error parsing cookies', { error: cookieError });
      ws.close(1008, 'Invalid cookie format');
      return;
    }
  } catch (error) {
    logger.error("WebSocket connection error", { error });
    try {
      ws.close(1011, 'Internal Server Error');
    } catch (closeError) {
      logger.error("Error closing WebSocket after error", { error: closeError });
    }
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

    // Get the user ID from the session
    // The session shape depends on passport, but we need to handle it safely
    let userId: number | undefined;

    // Cast session to any to avoid TypeScript errors with properties that
    // might exist at runtime but are not in the type definition
    const anySession = session as any;

    // Check if session has passport data, which is the expected shape
    if (anySession.passport && typeof anySession.passport === 'object' && 'user' in anySession.passport) {
      userId = anySession.passport.user;
    } 
    // Fallback method for non-standard session structures
    else if (anySession.user && typeof anySession.user === 'object' && 'id' in anySession.user) {
      // Some implementations store the user object directly
      userId = anySession.user.id;
    }
    // Second fallback if user ID is stored directly
    else if (anySession.userId && typeof anySession.userId === 'number') {
      userId = anySession.userId;
    }

    if (!userId) {
      logger.warn('No user ID found in session', { 
        sessionID,
        sessionKeys: Object.keys(anySession)
      });
      ws.close(1008, 'Unauthorized');
      return;
    }

    // Store the client connection with user ID for later use
    clients.set(ws, userId);

    logger.info(`WebSocket client connected and authenticated`, { userId });

    // Send a confirmation to the client
    try {
      ws.send(JSON.stringify({
        type: "connection_status",
        status: "connected",
        userId
      }));
    } catch (error) {
      logger.error('Error sending connection status', { error, userId });
    }
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