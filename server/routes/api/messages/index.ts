import { Router } from 'express';
import { WebSocket } from 'ws';
import { storage } from '../../../storage';
import { insertPrivateMessageSchema } from '@shared/schema';
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
const logger = new Logger('MessageRoutes');

/**
 * @route GET /api/messages/conversations
 * @desc Get all conversations for the current user
 * @access Private
 */
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const conversations = await storage.getUserConversations(userId);
    
    logger.info('User conversations fetched successfully', { 
      userId, 
      count: conversations.length 
    });
    
    res.json(conversations);
  } catch (error) {
    logger.error('Error fetching user conversations', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/messages/unread
 * @desc Get unread message count for the current user
 * @access Private
 */
router.get('/unread', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const count = await storage.getUnreadMessageCount(userId);
    
    logger.info('Unread message count fetched successfully', { userId, count });
    res.json({ count });
  } catch (error) {
    logger.error('Error fetching unread message count', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/messages/:userId
 * @desc Get messages between current user and specified user
 * @access Private
 */
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = parseInt(req.params.userId);
    
    if (isNaN(otherUserId)) {
      throw new ValidationError('Invalid user ID');
    }

    const messages = await storage.getPrivateMessages(currentUserId, otherUserId);
    
    logger.info('Private messages fetched successfully', { 
      currentUserId, 
      otherUserId, 
      count: messages.length 
    });
    
    res.json(messages);
  } catch (error) {
    logger.error('Error fetching private messages', { 
      otherUserId: req.params.userId, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/messages/:userId
 * @desc Send a message to specified user
 * @access Private
 */
router.post('/:userId', requireAuth, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const recipientId = parseInt(req.params.userId);
    
    if (isNaN(recipientId)) {
      throw new ValidationError('Invalid recipient user ID');
    }

    const result = insertPrivateMessageSchema.safeParse({
      ...req.body,
      recipientId,
    });

    if (!result.success) {
      throw new ValidationError('Invalid message data', result.error);
    }

    const message = await storage.createPrivateMessage({
      ...result.data,
      senderId,
    });

    // Broadcast message to relevant users (sender and recipient)
    broadcastWebSocketMessage({
      type: "private_message",
      data: {
        ...message,
        sender: {
          id: req.user!.id,
          username: req.user!.username,
        },
      },
    }, [senderId, recipientId]);

    logger.info('Private message sent successfully', { 
      messageId: message.id, 
      senderId, 
      recipientId 
    });
    
    res.status(201).json(message);
  } catch (error) {
    logger.error('Error sending private message', { 
      recipientId: req.params.userId, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

/**
 * @route POST /api/messages/:userId/read
 * @desc Mark messages from specified user as read
 * @access Private
 */
router.post('/:userId/read', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = parseInt(req.params.userId);
    
    if (isNaN(otherUserId)) {
      throw new ValidationError('Invalid user ID');
    }

    await storage.markMessagesAsRead(currentUserId, otherUserId);
    
    logger.info('Messages marked as read successfully', { currentUserId, otherUserId });
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error marking messages as read', { 
      otherUserId: req.params.userId, 
      error, 
      userId: req.user?.id 
    });
    handleApiError(res, error);
  }
});

export default router;