import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTaskSchema } from "@shared/schema";
import { insertCommentSchema } from "@shared/schema";
import { WebSocketServer, WebSocket } from "ws";
import { insertPrivateMessageSchema } from "@shared/schema";
import passport from 'passport';
import { parse as parseCookie } from 'cookie';
import session from 'express-session';

const clients = new Map<WebSocket, number>();

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const users = await storage.getUsers();
    res.json(users);
  });

  app.get("/api/tasks", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tasks = await storage.getTasks();

    const tasksWithDetails = await Promise.all(
      tasks.map(async (task) => {
        const [subtasks, steps, participants, responsible] = await Promise.all([
          storage.getSubtasks(task.id),
          storage.getTaskSteps(task.id),
          storage.getTaskParticipants(task.id),
          task.responsibleId ? storage.getUser(task.responsibleId) : null,
        ]);

        return {
          ...task,
          subtasks,
          steps,
          participants,
          responsible,
        };
      })
    );

    res.json(tasksWithDetails);
  });

  app.post("/api/tasks", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertTaskSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    const task = await storage.createTask({
      ...result.data,
      creatorId: req.user.id,
    });
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "Status is required" });

    try {
      const task = await storage.updateTaskStatus(parseInt(req.params.id), status);
      res.json(task);
    } catch (error) {
      res.status(404).json({ message: "Task not found" });
    }
  });

  app.patch("/api/subtasks/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { completed } = req.body;
    if (completed === undefined) {
      return res.status(400).json({ message: "Completed status is required" });
    }

    try {
      await storage.updateSubtaskStatus(parseInt(req.params.id), completed);
      res.json({ success: true });
    } catch (error) {
      res.status(404).json({ message: "Subtask not found" });
    }
  });

  app.patch("/api/steps/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { completed } = req.body;
    if (completed === undefined) {
      return res.status(400).json({ message: "Completed status is required" });
    }

    try {
      await storage.updateTaskStepStatus(parseInt(req.params.id), completed);
      res.json({ success: true });
    } catch (error) {
      res.status(404).json({ message: "Step not found" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      await storage.deleteTask(parseInt(req.params.id));
      res.sendStatus(204);
    } catch (error) {
      res.status(404).json({ message: "Task not found" });
    }
  });

  app.get("/api/tasks/:taskId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const comments = await storage.getTaskComments(parseInt(req.params.taskId));
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Error fetching comments" });
    }
  });

  app.post("/api/tasks/:taskId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertCommentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    try {
      const comment = await storage.createComment({
        ...result.data,
        taskId: parseInt(req.params.taskId),
        userId: req.user.id,
      });
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ message: "Error creating comment" });
    }
  });

  app.patch("/api/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }

    try {
      const comment = await storage.updateComment(parseInt(req.params.id), content);
      res.json(comment);
    } catch (error) {
      res.status(500).json({ message: "Error updating comment" });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      await storage.deleteComment(parseInt(req.params.id));
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Error deleting comment" });
    }
  });

  app.get("/api/messages/conversations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const conversations = await storage.getUserConversations(req.user.id);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Error fetching conversations" });
    }
  });

  app.get("/api/messages/unread", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const count = await storage.getUnreadMessageCount(req.user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Error fetching unread count" });
    }
  });

  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const messages = await storage.getPrivateMessages(
        req.user.id,
        parseInt(req.params.userId)
      );
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Error fetching messages" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication failed" });
      }
      res.status(200).json(req.user);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      req.logout((err) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ message: "Logout failed" });
        }
        req.session.destroy((err) => {
          if (err) {
            console.error("Session destruction error:", err);
            return res.status(500).json({ message: "Logout failed" });
          }
          res.status(200).json({ message: "Logged out successfully" });
        });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const result = insertPrivateMessageSchema.safeParse({
        ...req.body,
        recipientId: parseInt(req.params.userId),
      });

      if (!result.success) {
        return res.status(400).json({ message: "Invalid message data", errors: result.error });
      }

      const message = await storage.createPrivateMessage({
        ...result.data,
        senderId: req.user.id,
      });

      const recipientId = parseInt(req.params.userId);

      const clientEntries = Array.from(clients.entries());
      for (const [client, userId] of clientEntries) {
        if (
          client.readyState === WebSocket.OPEN &&
          (userId === recipientId || userId === req.user.id)
        ) {
          try {
            client.send(JSON.stringify({
              type: "private_message",
              data: {
                ...message,
                sender: {
                  id: req.user.id,
                  username: req.user.username,
                },
              },
            }));
          } catch (wsError) {
            console.error("WebSocket send error:", wsError);
          }
        }
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Error sending message" });
    }
  });

  app.post("/api/messages/:userId/read", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      await storage.markMessagesAsRead(
        req.user.id,
        parseInt(req.params.userId)
      );
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Error marking messages as read" });
    }
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    clientTracking: true,
    verifyClient: async ({ req }, done) => {
      try {
        if (!req.headers.cookie) {
          console.log('WebSocket connection rejected: No cookie');
          return done(false, 401, 'Unauthorized');
        }

        const cookies = parseCookie(req.headers.cookie);
        const sid = cookies['connect.sid'];

        if (!sid) {
          console.log('WebSocket connection rejected: No session ID');
          return done(false, 401, 'Unauthorized');
        }

        const sessionStore = storage.sessionStore;
        const sessionID = sid.split('.')[0].slice(2);

        sessionStore.get(sessionID, (err, session) => {
          if (err || !session) {
            console.log('WebSocket connection rejected: Invalid session');
            return done(false, 401, 'Unauthorized');
          }

          console.log('WebSocket connection authorized');
          done(true);
        });
      } catch (error) {
        console.error('WebSocket verification error:', error);
        done(false, 500, 'Internal Server Error');
      }
    }
  });

  wss.on("connection", (ws, req) => {
    console.log("New WebSocket client connected");

    ws.send(JSON.stringify({
      type: "connection_status",
      status: "connected"
    }));

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log("Received WebSocket message:", message);

        if (message.type === "identify" && typeof message.userId === "number") {
          clients.set(ws, message.userId);
          console.log(`Client identified with userId: ${message.userId}`);

          ws.send(JSON.stringify({
            type: "identification_status",
            status: "success",
            userId: message.userId
          }));
        }
      } catch (error) {
        console.error("WebSocket message handling error:", error);
        ws.send(JSON.stringify({
          type: "error",
          message: "Failed to process message"
        }));
      }
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket client error:", error);
      clients.delete(ws);
      try {
        ws.close();
      } catch (closeError) {
        console.error("Error closing WebSocket:", closeError);
      }
    });
  });

  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });

  return httpServer;
}