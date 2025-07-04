import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../../../storage';
import { requireAuth } from '../../../middleware';
import { Logger } from '../../../utils/logger';

const router = Router();
const logger = new Logger('UploadRoutes');

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with uuid to prevent filename collisions
    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueFilename);
  },
});

// Configure file filtering
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow all file types for now - can add restrictions later if needed
  cb(null, true);
};

// Initialize the multer middleware
const upload = multer({
  storage: multerStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit file size to 10MB
  },
});

/**
 * @route POST /api/uploads/private-message/:userId
 * @desc Upload file(s) and send as private message
 * @access Private
 */
router.post('/private-message/:userId', requireAuth, upload.array('files', 5), async (req, res) => {
  try {
    const senderId = req.user!.id;
    const recipientId = parseInt(req.params.userId);
    
    if (isNaN(recipientId)) {
      return res.status(400).json({ error: 'Invalid recipient user ID' });
    }

    if (!req.body.content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const files = req.files as Express.Multer.File[];
    
    // Create private message with attachments
    const message = await storage.createPrivateMessageWithAttachments(
      {
        content: req.body.content,
        senderId,
        recipientId,
      },
      files
    );

    // Get the created file attachments
    const attachments = await storage.getPrivateMessageAttachments(message.id);

    logger.info('Private message with attachments sent successfully', { 
      messageId: message.id, 
      senderId, 
      recipientId,
      attachmentCount: attachments.length
    });
    
    // Return both the message and attachments
    res.status(201).json({
      ...message,
      sender: {
        id: req.user!.id,
        username: req.user!.username,
      },
      attachments,
    });
  } catch (error) {
    logger.error('Error sending private message with attachments', { 
      recipientId: req.params.userId, 
      error, 
      userId: req.user?.id 
    });
    
    // Clean up any uploaded files if the message creation failed
    if (req.files && Array.isArray(req.files)) {
      (req.files as Express.Multer.File[]).forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          logger.error('Error deleting file after failed message creation', { 
            filePath: file.path, error: err 
          });
        }
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send message with attachments',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * @route POST /api/uploads/group-message/:channelId
 * @desc Upload file(s) and send as group message
 * @access Private
 */
router.post('/group-message/:channelId', requireAuth, upload.array('files', 5), async (req, res) => {
  try {
    const senderId = req.user!.id;
    const channelId = parseInt(req.params.channelId);
    
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    if (!req.body.content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Check if channel exists
    const channel = await storage.getGroupChannel(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if the user is a member of the channel if it's private
    if (channel.isPrivate) {
      const members = await storage.getChannelMembers(channelId);
      const isMember = members.some(member => member.userId === senderId);
      
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this private channel' });
      }
    }

    const files = req.files as Express.Multer.File[];
    
    // Create group message with attachments
    const message = await storage.createGroupMessageWithAttachments(
      {
        content: req.body.content,
        senderId,
        channelId,
      },
      files
    );

    // Get the created file attachments
    const attachments = await storage.getGroupMessageAttachments(message.id);

    // Get sender details for the response
    const sender = await storage.getUser(senderId);
    
    logger.info('Group message with attachments sent successfully', { 
      messageId: message.id, 
      senderId, 
      channelId,
      attachmentCount: attachments.length
    });
    
    // Return both the message and attachments
    const messageWithDetails = {
      ...message,
      sender: {
        id: sender?.id,
        username: sender?.username,
      },
      attachments,
    };
    
    res.status(201).json(messageWithDetails);
  } catch (error) {
    logger.error('Error sending group message with attachments', { 
      channelId: req.params.channelId, 
      error, 
      userId: req.user?.id 
    });
    
    // Clean up any uploaded files if the message creation failed
    if (req.files && Array.isArray(req.files)) {
      (req.files as Express.Multer.File[]).forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          logger.error('Error deleting file after failed message creation', { 
            filePath: file.path, error: err 
          });
        }
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send message with attachments',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * @route GET /api/uploads/file/*
 * @desc Download a file by full path or filename
 * @access Private
 */
router.get('/file/*', requireAuth, async (req, res) => {
  try {
    // Get the full path after /file/
    const requestedPath = req.params[0];
    
    // If path starts with uploads/, it's a full path, otherwise just a filename
    let filePath;
    if (requestedPath.startsWith('uploads/')) {
      // Full path from root - remove leading uploads/ since uploadDir already points to uploads
      const relativePath = requestedPath.substring('uploads/'.length);
      filePath = path.join(uploadDir, relativePath);
    } else {
      // Just a filename
      filePath = path.join(uploadDir, requestedPath);
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filePath);
  } catch (error) {
    logger.error('Error downloading file', { 
      requestedPath: req.params[0], 
      error, 
      userId: req.user?.id 
    });
    
    res.status(500).json({ 
      error: 'Failed to download file',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * @route POST /api/uploads/comment/:taskId
 * @desc Upload file(s) and send as comment
 * @access Private
 */
router.post('/comment/:taskId', requireAuth, upload.array('files', 5), async (req, res) => {
  try {
    const userId = req.user!.id;
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    if (!req.body.content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Check if task exists
    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const files = req.files as Express.Multer.File[];
    
    // Create comment with attachments
    const comment = await storage.createCommentWithAttachments(
      {
        content: req.body.content,
        taskId,
        userId,
      },
      files
    );

    // Get the created file attachments
    const attachments = await storage.getCommentAttachments(comment.id);

    // Get comment author details
    const user = await storage.getUser(userId);
    
    // Return the comment with attachments and user info
    const commentWithDetails = {
      ...comment,
      user: {
        id: user?.id,
        username: user?.username,
      },
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    
    logger.info('Comment with attachments created successfully', { 
      commentId: comment.id, 
      taskId, 
      userId, 
      attachmentCount: attachments.length 
    });
    
    res.status(201).json(commentWithDetails);
  } catch (error) {
    logger.error('Error creating comment with attachments', { 
      taskId: req.params.taskId, 
      error, 
      userId: req.user?.id 
    });
    
    // Clean up any uploaded files if the comment creation failed
    if (req.files && Array.isArray(req.files)) {
      const files = req.files as Express.Multer.File[];
      for (const file of files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupError) {
          logger.error('Failed to clean up uploaded file', { 
            filename: file.filename, 
            path: file.path, 
            error: cleanupError 
          });
        }
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to create comment with attachments',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

export default router;