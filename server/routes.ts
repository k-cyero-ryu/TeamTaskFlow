import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTaskSchema } from "@shared/schema";

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
    res.json(tasks);
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
      res.sendStatus(200);
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
      res.sendStatus(200);
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

  const httpServer = createServer(app);
  return httpServer;
}