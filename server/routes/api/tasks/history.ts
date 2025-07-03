import express from "express";
import { storage } from "../../../storage";
import { Logger } from "../../../utils/logger";

const router = express.Router({ mergeParams: true });
const logger = new Logger('TaskHistoryRoutes');

// GET /api/tasks/:taskId/history - Get task history
router.get("/", async (req: any, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    if (!taskId || isNaN(taskId)) {
      logger.warn('Invalid task ID provided', { taskId: req.params.taskId });
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const history = await storage.getTaskHistory(taskId);
    
    logger.info('Task history fetched successfully', { 
      taskId, 
      historyCount: history.length,
      userId: req.user?.id 
    });
    
    res.json(history);
  } catch (error) {
    logger.error('Failed to fetch task history', { 
      error, 
      taskId: req.params.taskId,
      userId: req.user?.id 
    });
    
    res.status(500).json({ 
      error: "Failed to fetch task history",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;