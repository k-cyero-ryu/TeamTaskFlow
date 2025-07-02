import { Router } from 'express';
import { storage } from '../../../storage';
import { 
  handleApiError, 
  ValidationError, 
  NotFoundError 
} from '../../../utils/errors';
import { requireAuth, validateParams, validateRequest } from '../../../middleware';
import { Logger } from '../../../utils/logger';
import { insertCommentSchema } from '@shared/schema';
import { broadcastWebSocketMessage } from '../../../websocket';
import { notificationService } from '../../../services/notification-service';

const router = Router();
const logger = new Logger('CommentRoutes');

/**
 * @route GET /api/comments/:taskId
 * @desc Get comments for a task
 * @access Private
 */
router.get('/:taskId', requireAuth, validateParams({
  taskId: (id) => !isNaN(parseInt(id))
}), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    // Check if task exists
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new NotFoundError(`Task with id ${taskId} not found`);
    }
    
    const comments = await storage.getTaskComments(taskId);
    logger.info('Comments fetched successfully', { taskId, count: comments.length });
    res.json(comments);
  } catch (error) {
    logger.error('Error fetching comments', { taskId: req.params.taskId, error });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/comments/:taskId
 * @desc Create a new comment for a task
 * @access Private
 */
router.post('/:taskId', requireAuth, validateParams({
  taskId: (id) => !isNaN(parseInt(id))
}), validateRequest(insertCommentSchema), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const userId = req.user!.id;
    
    // Check if task exists
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new NotFoundError(`Task with id ${taskId} not found`);
    }
    
    // Create the comment
    const comment = await storage.createComment({
      ...req.body,
      taskId,
      userId
    });
    
    // Get the complete comment with user info for the response
    const comments = await storage.getTaskComments(taskId);
    const newComment = comments.find(c => c.id === comment.id);
    
    if (!newComment) {
      throw new Error('Failed to retrieve created comment');
    }
    
    // Broadcast comment creation to all connected clients
    broadcastWebSocketMessage({
      type: 'COMMENT_CREATED',
      data: newComment
    });
    
    // Send email notifications to task participants
    try {
      const commenter = await storage.getUser(userId);
      const taskParticipants = await storage.getTaskParticipants(taskId);
      const responsibleUser = task.responsibleId ? await storage.getUser(task.responsibleId) : null;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Collect all users who should receive notifications (excluding commenter)
      const usersToNotify = new Set<number>();
      
      // Add participants
      taskParticipants.forEach(p => {
        if (p.id !== userId) usersToNotify.add(p.id);
      });
      
      // Add responsible person
      if (responsibleUser && responsibleUser.id !== userId) {
        usersToNotify.add(responsibleUser.id);
      }
      
      // Add task creator
      if (task.creatorId !== userId) {
        usersToNotify.add(task.creatorId);
      }
      
      // Send comment notifications
      for (const recipientUserId of Array.from(usersToNotify)) {
        const recipient = await storage.getUser(recipientUserId);
        if (recipient && commenter) {
          await notificationService.sendTaskCommentNotification({
            task,
            comment: newComment,
            commenter,
            recipient,
            baseUrl
          });
        }
      }
    } catch (error) {
      // Don't fail the request if notification creation fails
      logger.error('Error sending comment notifications', { error, taskId, commentId: comment.id });
    }
    
    logger.info('Comment created successfully', { taskId, commentId: comment.id, userId });
    res.status(201).json(newComment);
  } catch (error) {
    logger.error('Error creating comment', { taskId: req.params.taskId, userId: req.user?.id, error });
    handleApiError(res, error);
  }
});

/**
 * @route PUT /api/comments/:commentId
 * @desc Update a comment
 * @access Private - Only comment author or admin
 */
router.put('/:commentId', requireAuth, validateParams({
  commentId: (id) => !isNaN(parseInt(id))
}), async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const { content } = req.body;
    
    if (!content || typeof content !== 'string' || content.trim() === '') {
      throw new ValidationError('Comment content is required');
    }
    
    // Get the task comments to find the one we're updating
    // We need to verify the user is allowed to update this comment
    const taskComments = await storage.getTaskComments(req.body.taskId);
    const comment = taskComments.find(c => c.id === commentId);
    
    if (!comment) {
      throw new NotFoundError(`Comment with id ${commentId} not found`);
    }
    
    // Only allow the comment author or an admin to update the comment
    if (comment.user.id !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({
        error: {
          type: 'AUTHORIZATION_ERROR',
          message: 'You are not authorized to update this comment'
        }
      });
    }
    
    // Update the comment
    const updatedComment = await storage.updateComment(commentId, content);
    
    // Broadcast comment update to all connected clients
    broadcastWebSocketMessage({
      type: 'COMMENT_UPDATED',
      data: {
        ...comment,
        content: updatedComment.content
      }
    });
    
    logger.info('Comment updated successfully', { commentId, userId: req.user!.id });
    res.json({
      ...comment,
      content: updatedComment.content
    });
  } catch (error) {
    logger.error('Error updating comment', { commentId: req.params.commentId, userId: req.user?.id, error });
    handleApiError(res, error);
  }
});

/**
 * @route DELETE /api/comments/:commentId
 * @desc Delete a comment
 * @access Private - Only comment author or admin
 */
router.delete('/:commentId', requireAuth, validateParams({
  commentId: (id) => !isNaN(parseInt(id))
}), async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    
    // Get all task comments
    // We'll need to find the one being deleted to verify permissions
    // and to get the taskId for WebSocket broadcasting
    const taskId = parseInt(req.query.taskId as string);
    
    if (isNaN(taskId)) {
      throw new ValidationError('Task ID is required');
    }
    
    const taskComments = await storage.getTaskComments(taskId);
    const comment = taskComments.find(c => c.id === commentId);
    
    if (!comment) {
      throw new NotFoundError(`Comment with id ${commentId} not found`);
    }
    
    // Only allow the comment author or an admin to delete the comment
    if (comment.user.id !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({
        error: {
          type: 'AUTHORIZATION_ERROR',
          message: 'You are not authorized to delete this comment'
        }
      });
    }
    
    // Delete the comment
    await storage.deleteComment(commentId);
    
    // Broadcast comment deletion to all connected clients
    broadcastWebSocketMessage({
      type: 'COMMENT_DELETED',
      data: {
        id: commentId,
        taskId
      }
    });
    
    logger.info('Comment deleted successfully', { commentId, taskId, userId: req.user!.id });
    res.json({ success: true, id: commentId });
  } catch (error) {
    logger.error('Error deleting comment', { commentId: req.params.commentId, userId: req.user?.id, error });
    handleApiError(res, error);
  }
});

export default router;