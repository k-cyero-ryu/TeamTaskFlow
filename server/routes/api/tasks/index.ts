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
import { notificationService } from '../../../services/notification-service';
import historyRouter from './history';

const router = Router();
const logger = new Logger('TaskRoutes');

/**
 * @route GET /api/tasks
 * @desc Get all tasks with details
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const tasks = await storage.getTasksForUser(userId);

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

    // Normalize participant IDs to make sure we have valid numbers
    // This will prevent issues when adding participants
    const normalizedParticipantIds = Array.isArray(participantIds) 
      ? participantIds
          .filter(id => id !== null && id !== undefined) // Remove null/undefined entries
          .map(id => typeof id === 'string' ? parseInt(id, 10) : id) // Convert string IDs to numbers
          .filter(id => !isNaN(id) && id > 0) // Keep only valid positive numbers
      : [];
      
    logger.info('Normalized participant IDs', { 
      original: participantIds,
      normalized: normalizedParticipantIds
    });
    
    const task = await storage.createTask({
      ...taskData,
      dueDate: processedDueDate,
      workflowId: workflowId || null,
      stageId: stageId || null,
      creatorId: userId,
      participantIds: normalizedParticipantIds,
    });
    
    // Participants are added in the storage.createTask method using the normalized IDs
    // We've added extensive logging and error handling there to ensure this works correctly

    // Broadcast the new task to all connected clients
    broadcastWebSocketMessage({
      type: "task_created",
      data: task,
    });
    
    // Send email notifications to task participants
    try {
      const creator = await storage.getUser(userId);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Get task participants and responsible person
      const taskParticipants = await storage.getTaskParticipants(task.id);
      const responsibleUser = task.responsibleId ? await storage.getUser(task.responsibleId) : null;
      
      // Collect all users who should receive notifications (excluding creator)
      const usersToNotify = new Set<number>();
      
      // Add participants
      taskParticipants.forEach(p => {
        if (p.id !== userId) usersToNotify.add(p.id);
      });
      
      // Add responsible person
      if (responsibleUser && responsibleUser.id !== userId) {
        usersToNotify.add(responsibleUser.id);
      }
      
      // Send assignment notifications
      for (const participantUserId of Array.from(usersToNotify)) {
        const participant = await storage.getUser(participantUserId);
        if (participant && creator) {
          await notificationService.sendTaskAssignmentNotification({
            task,
            assignedUser: participant,
            user: creator,
            baseUrl
          });
        }
      }
    } catch (error) {
      // Don't fail the request if notification creation fails
      logger.error('Error sending task notifications', { error, taskId: task.id });
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
      logger.info('Task status update - found participants', { 
        taskId,
        participants: taskParticipants 
      });
      
      // Make sure to include all participants in notifications
      const allInvolvedUserIds = taskParticipants.map(p => p.id);
      
      // Always include responsible person if set
      if (updatedTask.responsibleId && !allInvolvedUserIds.includes(updatedTask.responsibleId)) {
        allInvolvedUserIds.push(updatedTask.responsibleId);
      }
      
      // Always include the creator in status update notifications
      if (updatedTask.creatorId && !allInvolvedUserIds.includes(updatedTask.creatorId)) {
        allInvolvedUserIds.push(updatedTask.creatorId);
      }
      
      logger.info('All involved users for status update notifications', { 
        taskId,
        allInvolvedUserIds 
      });
      
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
 * @route PATCH /api/tasks/:id/due-date
 * @desc Update a task's due date (only task responsible or creator can update)
 * @access Private
 */
router.patch('/:id/due-date', requireAuth, async (req, res) => {
  try {
    const { dueDate } = req.body;
    const taskId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    if (isNaN(taskId)) {
      throw new ValidationError('Invalid task ID');
    }

    // Get the task to check permissions
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Check if user is the task responsible person or creator
    const isResponsible = task.responsibleId === userId;
    const isCreator = task.creatorId === userId;
    
    if (!isResponsible && !isCreator) {
      return res.status(403).json({
        error: {
          type: 'AUTHORIZATION_ERROR',
          message: 'Only the task responsible person or creator can update the due date'
        }
      });
    }

    // Process the due date
    let processedDueDate = null;
    if (dueDate) {
      processedDueDate = new Date(dueDate);
      if (isNaN(processedDueDate.getTime())) {
        throw new ValidationError('Invalid due date format');
      }
    }

    const updatedTask = await storage.updateTaskDueDate(taskId, processedDueDate);
    
    // Broadcast the due date update to all connected clients
    broadcastWebSocketMessage({
      type: "task_due_date_updated",
      data: updatedTask,
    });
    
    logger.info('Task due date updated successfully', { taskId, dueDate, userId });
    res.json(updatedTask);
  } catch (error) {
    logger.error('Error updating task due date', { 
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
    
    // Create notifications for task comments
    try {
      // Get the task to know who's involved
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }
      
      // Get all involved users
      const taskParticipants = await storage.getTaskParticipants(taskId);
      logger.info('Comment notification - found participants', { 
        taskId,
        commentId: comment.id,
        participants: taskParticipants 
      });
      
      // Make sure to include all participants in notifications
      const allInvolvedUserIds = taskParticipants.map(p => p.id);
      
      // Always include responsible person if set
      if (task.responsibleId && !allInvolvedUserIds.includes(task.responsibleId)) {
        allInvolvedUserIds.push(task.responsibleId);
      }
      
      // Always include the creator in comment notifications
      if (task.creatorId && !allInvolvedUserIds.includes(task.creatorId)) {
        allInvolvedUserIds.push(task.creatorId);
      }
      
      logger.info('All involved users for comment notifications', { 
        taskId,
        commentId: comment.id,
        allInvolvedUserIds 
      });
      
      // Get all user details
      const users = await storage.getUsers();
      const commenter = users.find(u => u.id === userId);
      const commenterName = commenter ? commenter.username : 'Someone';
      
      // Create notifications for each involved user
      for (const involvedUserId of allInvolvedUserIds) {
        if (involvedUserId === userId) continue; // Skip the commenter
        
        const user = users.find(u => u.id === involvedUserId);
        if (!user || !user.email) continue; // Skip if no user or no email
        
        // Create comment notification
        await storage.createEmailNotification({
          userId: involvedUserId,
          recipientEmail: user.email,
          subject: `New comment on task: ${task.title}`,
          content: `${commenterName} commented on the task "${task.title}": "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
          type: 'task_comment',
          status: 'pending',
          relatedEntityId: taskId,
          relatedEntityType: 'task'
        });
        
        logger.info('Comment notification created', { 
          taskId, 
          userId: involvedUserId,
          commenterId: userId
        });
      }
    } catch (error) {
      // Don't fail the request if notification creation fails
      logger.error('Error creating comment notifications', { error, taskId, commentId: comment.id });
    }
    
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

// Mount history routes
router.use('/:taskId/history', historyRouter);

export default router;