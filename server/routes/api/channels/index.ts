import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../../../storage';
import { requireAuth, validateParams } from '../../../middleware';
import { insertGroupChannelSchema, insertGroupMessageSchema } from '@shared/schema';
import { z } from 'zod';
import { broadcastWebSocketMessage, sendWebSocketMessageToUser } from '../../../websocket';

// Create a router
const router = Router();

// Get all channels for the current user
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const channels = await storage.getGroupChannels(userId);
    return res.json(channels);
  } catch (error) {
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

    // Check if the user is a member of the channel
    const members = await storage.getChannelMembers(channelId);
    const isMember = members.some(member => member.userId === userId);
    
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this channel' });
    }

    return res.json(channel);
  } catch (error) {
    next(error);
  }
});

// Create a new channel
router.post('/', 
  requireAuth,
  validateParams(insertGroupChannelSchema), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const channelData = req.body;
      const newChannel = await storage.createGroupChannel({
        ...channelData,
        creatorId: userId,
      });
      
      // Automatically add the creator as an admin member
      await storage.addChannelMember(newChannel.id, userId, true);

      return res.status(201).json(newChannel);
    } catch (error) {
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

    // Check if the user is a member of the channel
    const members = await storage.getChannelMembers(channelId);
    const isMember = members.some(member => member.userId === userId);
    
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this channel' });
    }

    return res.json(members);
  } catch (error) {
    next(error);
  }
});

// Add a user to a channel
router.post('/:id/members', 
  requireAuth,
  validateParams(z.object({
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

    // Check if the user is a member of the channel
    const members = await storage.getChannelMembers(channelId);
    const isMember = members.some(member => member.userId === userId);
    
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this channel' });
    }

    const messages = await storage.getGroupMessages(channelId);
    return res.json(messages);
  } catch (error) {
    next(error);
  }
});

// Send a message to a channel
router.post('/:id/messages', 
  requireAuth,
  validateParams(insertGroupMessageSchema), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const channelId = parseInt(req.params.id);
      if (isNaN(channelId)) {
        return res.status(400).json({ error: 'Invalid channel ID' });
      }

      // Check if the user is a member of the channel
      const members = await storage.getChannelMembers(channelId);
      const isMember = members.some(member => member.userId === userId);
      
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this channel' });
      }

      const messageData = req.body;
      const newMessage = await storage.createGroupMessage({
        ...messageData,
        channelId,
        senderId: userId,
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
      broadcastWebSocketMessage({
        type: 'NEW_GROUP_MESSAGE',
        data: messageWithSender,
      }, memberIds);

      return res.status(201).json(messageWithSender);
    } catch (error) {
      next(error);
    }
});

export default router;