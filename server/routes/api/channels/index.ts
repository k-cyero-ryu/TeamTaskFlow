import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../../../storage';
import { requireAuth, validateParams, validateRequest } from '../../../middleware';
import { insertGroupChannelSchema, insertGroupMessageSchema } from '@shared/schema';
import { z } from 'zod';
import { broadcastWebSocketMessage, sendWebSocketMessageToUser } from '../../../websocket';
import { Logger } from '../../../utils/logger';

// Create a router
const router = Router();
const logger = new Logger('ChannelRoutes');

// Get all channels for the current user
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('Authentication required for fetching channels');
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching channels for user', { userId });
    const channels = await storage.getGroupChannels(userId);
    logger.info('Channels fetched successfully', { userId, channelCount: channels.length });
    return res.json(channels);
  } catch (error) {
    logger.error('Error fetching channels', { error, userId: req.user?.id });
    next(error);
  }
});

// Get a specific channel by ID
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const channel = await storage.getGroupChannel(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // For private channels, check if the user is a member
    if (channel.isPrivate) {
      const members = await storage.getChannelMembers(channelId);
      const isMember = members.some(member => member.userId === userId);
      
      if (!isMember) {
        return res.status(403).json({ error: 'You do not have access to this private channel' });
      }
    }

    return res.json(channel);
  } catch (error) {
    next(error);
  }
});

// Create a new channel
router.post('/', 
  requireAuth,
  validateRequest(insertGroupChannelSchema), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('Authentication required for creating channel');
        return res.status(401).json({ error: 'Authentication required' });
      }

      logger.info('Creating new channel', { userId, channelName: req.body.name });
      
      const channelData = req.body;
      const newChannel = await storage.createGroupChannel({
        ...channelData,
        creatorId: userId,
      });
      
      logger.info('Channel created successfully', { 
        channelId: newChannel.id, 
        channelName: newChannel.name,
        userId
      });
      
      // Automatically add the creator as an admin member
      logger.debug('Adding creator as admin member', { channelId: newChannel.id, userId });
      await storage.addChannelMember(newChannel.id, userId, true);

      logger.info('Channel creation completed', { channelId: newChannel.id, userId });
      return res.status(201).json(newChannel);
    } catch (error) {
      logger.error('Error creating channel', { error, userId: req.user?.id });
      next(error);
    }
});

// Get all members of a channel
router.get('/:id/members', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    // Get channel members without checking membership first
    const members = await storage.getChannelMembers(channelId);
    
    return res.json(members);
  } catch (error) {
    next(error);
  }
});

// Add a user to a channel
router.post('/:id/members', 
  requireAuth,
  validateRequest(z.object({
    userId: z.number(),
    isAdmin: z.boolean().optional(),
  })), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const channelId = parseInt(req.params.id);
      if (isNaN(channelId)) {
        return res.status(400).json({ error: 'Invalid channel ID' });
      }

      // Check if the current user is an admin of the channel
      const members = await storage.getChannelMembers(channelId);
      const currentUserMember = members.find(member => member.userId === currentUserId);
      
      if (!currentUserMember) {
        return res.status(403).json({ error: 'You are not a member of this channel' });
      }

      if (!currentUserMember.isAdmin) {
        return res.status(403).json({ error: 'Only admins can add members to the channel' });
      }

      const { userId, isAdmin = false } = req.body;
      const newMember = await storage.addChannelMember(channelId, userId, isAdmin);
      
      // Get the added user details
      const user = await storage.getUser(userId);
      if (user) {
        // Notify the added user
        sendWebSocketMessageToUser(userId, {
          type: 'CHANNEL_MEMBER_ADDED',
          data: {
            channelId,
            addedBy: currentUserId,
          },
        });
      }

      return res.status(201).json(newMember);
    } catch (error) {
      next(error);
    }
});

// Remove a user from a channel
router.delete('/:channelId/members/:userId', 
  requireAuth, 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const channelId = parseInt(req.params.channelId);
      const userId = parseInt(req.params.userId);
      
      if (isNaN(channelId) || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid channel ID or user ID' });
      }

      // Check if the current user is an admin of the channel
      const members = await storage.getChannelMembers(channelId);
      const currentUserMember = members.find(member => member.userId === currentUserId);
      
      if (!currentUserMember) {
        return res.status(403).json({ error: 'You are not a member of this channel' });
      }

      // Users can remove themselves or admins can remove anyone
      if (currentUserId !== userId && !currentUserMember.isAdmin) {
        return res.status(403).json({ error: 'Only admins can remove other members from the channel' });
      }

      await storage.removeChannelMember(channelId, userId);
      
      // Notify the removed user if it's not the current user
      if (currentUserId !== userId) {
        sendWebSocketMessageToUser(userId, {
          type: 'CHANNEL_MEMBER_REMOVED',
          data: {
            channelId,
            removedBy: currentUserId,
          },
        });
      }

      return res.status(204).end();
    } catch (error) {
      next(error);
    }
});



// Get all messages in a channel
router.get('/:id/messages', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    // Allow access to messages without checking channel membership
    // This makes channel messages publicly visible to any authenticated user
    const messages = await storage.getGroupMessages(channelId);
    return res.json(messages);
  } catch (error) {
    next(error);
  }
});

// Send a message to a channel
router.post('/:id/messages', 
  requireAuth,
  validateRequest(insertGroupMessageSchema), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('Authentication required for sending channel message');
        return res.status(401).json({ error: 'Authentication required' });
      }

      const channelId = parseInt(req.params.id);
      if (isNaN(channelId)) {
        logger.warn('Invalid channel ID provided', { channelId: req.params.id, userId });
        return res.status(400).json({ error: 'Invalid channel ID' });
      }

      logger.info('Attempting to send message to channel', { 
        channelId, 
        userId,
        messageContent: req.body.content?.substring(0, 50) // Log the first 50 chars of message for debugging
      });

      // Get the channel to check if it's public or private
      const channel = await storage.getGroupChannel(channelId);
      if (!channel) {
        logger.warn('Channel not found', { channelId, userId });
        return res.status(404).json({ error: 'Channel not found' });
      }

      // Check if the user is a member of the channel
      const members = await storage.getChannelMembers(channelId);
      logger.debug('Retrieved channel members', { 
        channelId, 
        membersCount: members.length,
        memberIds: members.map(m => m.userId)
      });

      let isMember = members.some(member => member.userId === userId);
      
      // For private channels, require membership
      if (channel.isPrivate && !isMember) {
        logger.warn('User attempted to send message to private channel without membership', {
          channelId,
          userId,
          isPrivate: channel.isPrivate
        });
        return res.status(403).json({ error: 'You are not a member of this private channel' });
      }
      
      // For public channels, automatically add the user as a member if they're not already
      if (!channel.isPrivate && !isMember) {
        logger.info('Adding user as member to public channel', { channelId, userId });
        await storage.addChannelMember(channelId, userId, false);
        // Update member status
        isMember = true;
        // Get updated members list
        const updatedMembers = await storage.getChannelMembers(channelId);
        members.push(...updatedMembers.filter(m => m.userId === userId));
        
        logger.debug('User added as member to channel', {
          channelId,
          userId,
          totalMembers: members.length
        });
      }

      // Make sure channelId is explicitly set in the message data, but don't modify the original request body
      const messageData = {
        content: req.body.content,
        channelId: channelId // Ensure channelId is set correctly
      };
      
      logger.debug('Preparing to create group message', {
        channelId,
        userId,
        messageData: { ...messageData, content: messageData.content?.substring(0, 50) }
      });
      
      // Create the message
      const newMessage = await storage.createGroupMessage({
        ...messageData,
        senderId: userId,
      });

      logger.info('Created new group message', {
        channelId,
        messageId: newMessage.id,
        userId
      });

      // Get sender details for the response
      const sender = await storage.getUser(userId);
      const messageWithSender = {
        ...newMessage,
        sender: {
          id: sender?.id,
          username: sender?.username,
        }
      };

      // Broadcast message to all channel members 
      const memberIds = members.map(member => member.userId);
      logger.debug('Broadcasting message to channel members', {
        channelId,
        messageId: newMessage.id,
        memberCount: memberIds.length,
        memberIds
      });
      
      broadcastWebSocketMessage({
        type: 'NEW_GROUP_MESSAGE',
        data: messageWithSender,
      }, memberIds);

      logger.info('Group message sent successfully', {
        channelId,
        messageId: newMessage.id,
        userId
      });

      return res.status(201).json(messageWithSender);
    } catch (error) {
      logger.error('Error sending channel message', { 
        error, 
        channelId: req.params.id, 
        userId: req.user?.id 
      });
      next(error);
    }
});

export default router;