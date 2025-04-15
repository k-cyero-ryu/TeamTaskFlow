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
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Extract workflow and stage IDs from the request
    const { workflowId, stageId, dueDate, participantIds, ...taskData } = req.body;

    // Make sure dueDate is properly handled
    let processedDueDate = null;
    if (dueDate) {
      // Ensure it's a proper Date object
      try {
        processedDueDate = new Date(dueDate);
        // Validate the date
        if (isNaN(processedDueDate.getTime())) {
          processedDueDate = null;
        }
      } catch (e) {
        logger.warn('Invalid date format received for dueDate', { dueDate });
        processedDueDate = null;
      }
    }

    const task = await storage.createTask({
      ...taskData,
      dueDate: processedDueDate,
      workflowId: workflowId || null,
      stageId: stageId || null,
      creatorId: userId,
    });
    
    // Add task participants if provided
    if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
      try {
        for (const participantId of participantIds) {
          await storage.addTaskParticipant(task.id, participantId);
          logger.info('Task participant added', { taskId: task.id, participantId });
        }
      } catch (error) {
        logger.error('Error adding task participants', { error, taskId: task.id });
      }
    }

    // Broadcast the new task to all connected clients
    broadcastWebSocketMessage({
      type: "task_created",
      data: task,
    });
    
    // Generate email notifications for task participants and responsible person
    try {
      // Get all involved users (participants and responsible person)
      // Get task participants
      const taskParticipants = await storage.getTaskParticipants(task.id);
      const allInvolvedUserIds = taskParticipants.map(p => p.userId);
      if (task.responsibleId && !allInvolvedUserIds.includes(task.responsibleId)) {
        allInvolvedUserIds.push(task.responsibleId);
      }
      
      // Get all user details
      const users = await storage.getUsers();
      
      // Create notification for the creator (task created)
      const creator = users.find(u => u.id === userId);
      if (creator && creator.email) {
        // Create task creation notification for the creator
        await storage.createEmailNotification({
          userId: userId,
          recipientEmail: creator.email,
          subject: `Task created: ${task.title}`,
          content: `You have created a new task: "${task.title}". ${
            task.dueDate ? `The task is due on ${new Date(task.dueDate).toLocaleDateString()}.` : ''
          }`,
          type: 'task_created',
          status: 'pending',
          relatedEntityId: task.id,
          relatedEntityType: 'task'
        });
        
        logger.info('Task creation notification created', { 
          taskId: task.id, 
          userId: userId 
        });
      }
      
      // Create notifications for each involved user
      for (const involvedUserId of allInvolvedUserIds) {
        if (involvedUserId === userId) continue; // Skip creator
        
        const user = users.find(u => u.id === involvedUserId);
        if (!user || !user.email) continue; // Skip if no user or no email
        
        // Create task assignment notification
        await storage.createEmailNotification({
          userId: involvedUserId,
          recipientEmail: user.email,
          subject: `You've been assigned to a task: ${task.title}`,
          content: `You have been assigned to the task "${task.title}". ${
            task.dueDate ? `The task is due on ${new Date(task.dueDate).toLocaleDateString()}.` : ''
          }`,
          type: 'task_assignment',
          status: 'pending',
          relatedEntityId: task.id,
          relatedEntityType: 'task'
        });
        
        logger.info('Task assignment notification created', { 
          taskId: task.id, 
          userId: involvedUserId 
        });
      }
    } catch (error) {
      // Don't fail the request if notification creation fails
      logger.error('Error creating task notifications', { error, taskId: task.id });
    }

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
    
    // Create notifications for task status updates
    try {
      // First get the task details to know who's involved
      const updatedTask = await storage.getTask(taskId);
      if (!updatedTask) {
        throw new Error('Task not found after status update');
      }
      
      // Get all involved users (participants and responsible person)
      // Get task participants
      const taskParticipants = await storage.getTaskParticipants(taskId);
      const allInvolvedUserIds = taskParticipants.map(p => p.id);
      if (updatedTask.responsibleId && !allInvolvedUserIds.includes(updatedTask.responsibleId)) {
        allInvolvedUserIds.push(updatedTask.responsibleId);
      }
      if (updatedTask.creatorId && !allInvolvedUserIds.includes(updatedTask.creatorId)) {
        allInvolvedUserIds.push(updatedTask.creatorId);
      }
      
      // Get all user details
      const users = await storage.getUsers();
      
      // Create notifications for each involved user
      for (const involvedUserId of allInvolvedUserIds) {
        if (involvedUserId === req.user!.id) continue; // Skip the user who updated the status
        
        const user = users.find(u => u.id === involvedUserId);
        if (!user || !user.email) continue; // Skip if no user or no email
        
        // Create task status update notification
        await storage.createEmailNotification({
          userId: involvedUserId,
          recipientEmail: user.email,
          subject: `Task status updated: ${updatedTask.title}`,
          content: `The status of task "${updatedTask.title}" has been updated to "${status}".`,
          type: 'task_update',
          status: 'pending',
          relatedEntityId: taskId,
          relatedEntityType: 'task'
        });
        
        logger.info('Task status notification created', { 
          taskId, 
          userId: involvedUserId,
          status
        });
      }
    } catch (error) {
      // Don't fail the request if notification creation fails
      logger.error('Error creating task status notifications', { error, taskId });
    }
    
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
router.post('/:taskId/comments', requireAuth, validateParams({
  taskId: (id) => !isNaN(parseInt(id))
}), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const userId = req.user!.id;
    
    if (isNaN(taskId)) {
      throw new ValidationError('Invalid task ID');
    }
    
    // Validate comment content
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim() === '') {
      throw new ValidationError('Comment content is required');
    }

    // Create the comment with the validated content
    const comment = await storage.createComment({
      content,
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