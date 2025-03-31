import { Router } from 'express';
import { WebSocket } from 'ws';
import { storage } from '../../../storage';
import { insertTaskSchema, insertCommentSchema } from '@shared/schema';
import { 
  handleApiError, 
  ValidationError, 
  NotFoundError, 
  InternalServerError 
} from '../../../utils/errors';
import { validateParams, requireAuth } from '../../../middleware';
import { Logger } from '../../../utils/logger';
import { broadcastWebSocketMessage } from '../../../websocket';

const router = Router();
const logger = new Logger('TaskRoutes');

/**
 * @route GET /api/tasks
 * @desc Get all tasks with details
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const tasks = await storage.getTasks();

    const tasksWithDetails = await Promise.all(
      tasks.map(async (task) => {
        const [subtasks, steps, participants, responsible, workflow, stage] = await Promise.all([
          storage.getSubtasks(task.id),
          storage.getTaskSteps(task.id),
          storage.getTaskParticipants(task.id),
          task.responsibleId ? storage.getUser(task.responsibleId) : null,
          task.workflowId ? storage.getWorkflow(task.workflowId) : null,
          task.stageId ? storage.getWorkflowStage(task.workflowId!, task.stageId) : null,
        ]);

        return {
          ...task,
          subtasks,
          steps,
          participants,
          responsible,
          workflow,
          stage,
        };
      })
    );

    logger.info('Tasks fetched successfully', { count: tasksWithDetails.length });
    res.json(tasksWithDetails);
  } catch (error) {
    logger.error('Error fetching tasks', { error });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/tasks
 * @desc Create a new task
 * @access Private
 */
router.post('/', requireAuth, validateParams(insertTaskSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Extract workflow and stage IDs from the request
    const { workflowId, stageId, ...taskData } = req.body;

    const task = await storage.createTask({
      ...taskData,
      workflowId: workflowId || null,
      stageId: stageId || null,
      creatorId: userId,
    });

    // Broadcast the new task to all connected clients
    broadcastWebSocketMessage({
      type: "task_created",
      data: task,
    });

    logger.info('Task created successfully', { taskId: task.id, userId });
    res.status(201).json(task);
  } catch (error) {
    logger.error('Error creating task', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route PATCH /api/tasks/:id/status
 * @desc Update a task's status
 * @access Private
 */
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const taskId = parseInt(req.params.id);
    
    if (!status) {
      throw new ValidationError('Status is required');
    }
    
    if (isNaN(taskId)) {
      throw new ValidationError('Invalid task ID');
    }

    const task = await storage.updateTaskStatus(taskId, status);
    
    logger.info('Task status updated successfully', { taskId, status, userId: req.user?.id });
    res.json(task);
  } catch (error) {
    logger.error('Error updating task status', { 
      taskId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route DELETE /api/tasks/:id
 * @desc Delete a task
 * @access Private
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      throw new ValidationError('Invalid task ID');
    }

    await storage.deleteTask(taskId);
    
    logger.info('Task deleted successfully', { taskId, userId: req.user?.id });
    res.sendStatus(204);
  } catch (error) {
    logger.error('Error deleting task', { taskId: req.params.id, error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/tasks/:taskId/comments
 * @desc Get all comments for a task
 * @access Private
 */
router.get('/:taskId/comments', requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(taskId)) {
      throw new ValidationError('Invalid task ID');
    }

    const comments = await storage.getTaskComments(taskId);
    
    logger.info('Task comments fetched successfully', { taskId, count: comments.length });
    res.json(comments);
  } catch (error) {
    logger.error('Error fetching task comments', { 
      taskId: req.params.taskId, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/tasks/:taskId/comments
 * @desc Create a new comment for a task
 * @access Private
 */
router.post('/:taskId/comments', requireAuth, validateParams(insertCommentSchema), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const userId = req.user!.id;
    
    if (isNaN(taskId)) {
      throw new ValidationError('Invalid task ID');
    }

    const comment = await storage.createComment({
      ...req.body,
      taskId,
      userId,
    });
    
    logger.info('Comment created successfully', { taskId, commentId: comment.id, userId });
    res.status(201).json(comment);
  } catch (error) {
    logger.error('Error creating comment', { 
      taskId: req.params.taskId, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * Subtask routes
 */

/**
 * @route PATCH /api/tasks/subtasks/:id/status
 * @desc Update a subtask's completion status
 * @access Private
 */
router.patch('/subtasks/:id/status', requireAuth, async (req, res) => {
  try {
    const subtaskId = parseInt(req.params.id);
    const { completed } = req.body;
    
    if (isNaN(subtaskId)) {
      throw new ValidationError('Invalid subtask ID');
    }
    
    if (completed === undefined) {
      throw new ValidationError('Completed status is required');
    }

    await storage.updateSubtaskStatus(subtaskId, completed);
    
    logger.info('Subtask status updated successfully', { 
      subtaskId, 
      completed, 
      userId: req.user?.id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating subtask status', { 
      subtaskId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route PATCH /api/tasks/steps/:id/status
 * @desc Update a task step's completion status
 * @access Private
 */
router.patch('/steps/:id/status', requireAuth, async (req, res) => {
  try {
    const stepId = parseInt(req.params.id);
    const { completed } = req.body;
    
    if (isNaN(stepId)) {
      throw new ValidationError('Invalid step ID');
    }
    
    if (completed === undefined) {
      throw new ValidationError('Completed status is required');
    }

    await storage.updateTaskStepStatus(stepId, completed);
    
    logger.info('Task step status updated successfully', { 
      stepId, 
      completed, 
      userId: req.user?.id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating task step status', { 
      stepId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * Comment routes
 */

/**
 * @route PATCH /api/tasks/comments/:id
 * @desc Update a comment
 * @access Private
 */
router.patch('/comments/:id', requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const { content } = req.body;
    
    if (isNaN(commentId)) {
      throw new ValidationError('Invalid comment ID');
    }
    
    if (!content) {
      throw new ValidationError('Content is required');
    }

    const comment = await storage.updateComment(commentId, content);
    
    logger.info('Comment updated successfully', { commentId, userId: req.user?.id });
    res.json(comment);
  } catch (error) {
    logger.error('Error updating comment', { 
      commentId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route DELETE /api/tasks/comments/:id
 * @desc Delete a comment
 * @access Private
 */
router.delete('/comments/:id', requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    
    if (isNaN(commentId)) {
      throw new ValidationError('Invalid comment ID');
    }

    await storage.deleteComment(commentId);
    
    logger.info('Comment deleted successfully', { commentId, userId: req.user?.id });
    res.sendStatus(204);
  } catch (error) {
    logger.error('Error deleting comment', { 
      commentId: req.params.id, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

export default router;