import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTaskSchema } from "@shared/schema";
import { insertCommentSchema } from "@shared/schema"; // Assuming this schema exists


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

    // Fetch related data for each task
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

  // Comments endpoints
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

  const httpServer = createServer(app);
  return httpServer;
}