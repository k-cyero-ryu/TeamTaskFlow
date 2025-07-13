import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import mainRouter from "./routes/index";
import { setupWebSocketServer } from "./websocket-handler";
import { setupWebSocketProxy } from "./middleware/websocket-proxy";
import { Logger } from "./utils/logger";

const logger = new Logger('Routes');

export function registerRoutes(app: Express): Server {
  // Setup authentication
  setupAuth(app);

  // Setup WebSocket proxy middleware for production support
  setupWebSocketProxy(app);

  // Register main router
  logger.info('Registering API routes');
  app.use(mainRouter);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server
  logger.info('Setting up WebSocket server');
  setupWebSocketServer(httpServer);

  return httpServer;
}