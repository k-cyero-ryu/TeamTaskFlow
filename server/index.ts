import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { WebSocketServer } from "ws";
import { db } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Test database connection first
    try {
      await db.execute('SELECT 1');
      log('Database connection test successful');
    } catch (dbError) {
      log(`Database connection test failed: ${dbError}`);
      throw dbError;
    }

    const server = registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Setup WebSocket server 
    const wss = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    wss.on('connection', (ws) => {
      log('WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          log(`WebSocket message received: ${JSON.stringify(data)}`);
        } catch (error) {
          log(`Error parsing WebSocket message: ${error}`);
        }
      });

      ws.on('error', (error) => {
        log(`WebSocket error: ${error}`);
      });

      ws.on('close', () => {
        log('WebSocket client disconnected');
      });
    });

    wss.on('error', (error) => {
      log(`WebSocket server error: ${error}`);
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT}`);
      log(`WebSocket server available at ws://0.0.0.0:${PORT}/ws`);
    });
  } catch (error) {
    log(`Server startup error: ${error}`);
    process.exit(1);
  }
})();