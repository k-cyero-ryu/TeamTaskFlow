import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTaskSchema, insertCommentSchema, insertWorkflowSchema, insertWorkflowStageSchema, insertWorkflowTransitionSchema } from "@shared/schema";
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
  });

  wss.on("connection", async (ws, req) => {
    try {
      console.log("WebSocket connection attempt");
      console.log("Request headers:", req.headers);

      // Parse cookies from the upgrade request
      const cookies = parseCookie(req.headers.cookie || '');
      console.log('Parsed cookies:', cookies);

      const sessionID = cookies['connect.sid']?.split('.')[0].slice(2);

      if (!sessionID) {
        console.error('WebSocket connection rejected: No valid session ID');
        console.log('Available cookies:', cookies);
        console.log('Headers:', req.headers);
        ws.close(1008, 'Unauthorized');
        return;
      }

      console.log('WebSocket connection attempt with session ID:', sessionID);

      // Verify session and get user data
      const sessionStore = storage.sessionStore;
      sessionStore.get(sessionID, (err, session) => {
        if (err) {
          console.error('Session store error:', err);
          ws.close(1008, 'Session store error');
          return;
        }

        if (!session) {
          console.error('WebSocket connection rejected: No session found');
          ws.close(1008, 'No session found');
          return;
        }

        if (!session.passport?.user) {
          console.error('WebSocket connection rejected: No passport user in session');
          console.log('Session data:', session);
          ws.close(1008, 'Unauthorized');
          return;
        }

        const userId = session.passport.user;
        clients.set(ws, userId);

        console.log(`WebSocket client connected and authenticated with userId: ${userId}`);

        ws.send(JSON.stringify({
          type: "connection_status",
          status: "connected",
          userId
        }));
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log("Received WebSocket message:", message);

          if (message.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
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

    } catch (error) {
      console.error("WebSocket connection error:", error);
      console.error("Error stack:", error.stack);
      ws.close(1011, 'Internal Server Error');
    }
  });

  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });

  app.get("/api/workflows", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const workflows = await storage.getWorkflows();
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ message: "Error fetching workflows" });
    }
  });

  app.post("/api/workflows", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertWorkflowSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    try {
      const workflow = await storage.createWorkflow({
        ...result.data,
        creatorId: req.user.id,
      });
      res.status(201).json(workflow);
    } catch (error) {
      res.status(500).json({ message: "Error creating workflow" });
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const workflow = await storage.getWorkflow(parseInt(req.params.id));
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ message: "Error fetching workflow" });
    }
  });

  app.get("/api/workflows/:id/stages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const stages = await storage.getWorkflowStages(parseInt(req.params.id));
      res.json(stages);
    } catch (error) {
      res.status(500).json({ message: "Error fetching workflow stages" });
    }
  });

  app.post("/api/workflows/:id/stages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertWorkflowStageSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    try {
      const stage = await storage.createWorkflowStage({
        ...result.data,
        workflowId: parseInt(req.params.id),
      });

      // Notify all connected clients about the new stage
      const clientEntries = Array.from(clients.entries());
      for (const [client, userId] of clientEntries) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify({
              type: "workflow_stage_update",
              workflowId: parseInt(req.params.id),
              data: stage
            }));
          } catch (wsError) {
            console.error("WebSocket send error:", wsError);
          }
        }
      }

      res.status(201).json(stage);
    } catch (error) {
      res.status(500).json({ message: "Error creating workflow stage" });
    }
  });

  app.get("/api/workflows/:id/transitions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const transitions = await storage.getWorkflowTransitions(parseInt(req.params.id));
      res.json(transitions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching workflow transitions" });
    }
  });

  app.post("/api/workflows/:id/transitions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertWorkflowTransitionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    try {
      const transition = await storage.createWorkflowTransition(result.data);
      res.status(201).json(transition);
    } catch (error) {
      res.status(500).json({ message: "Error creating workflow transition" });
    }
  });

  app.patch("/api/tasks/:id/stage", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { stageId } = req.body;
    if (!stageId) {
      return res.status(400).json({ message: "Stage ID is required" });
    }

    try {
      const task = await storage.updateTaskStage(parseInt(req.params.id), stageId);
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Error updating task stage" });
    }
  });

  app.get("/api/workflows/:workflowId/stages/:stageId/tasks", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const tasks = await storage.getTasksByWorkflowStage(
        parseInt(req.params.workflowId),
        parseInt(req.params.stageId)
      );
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Error fetching tasks" });
    }
  });

  return httpServer;
}