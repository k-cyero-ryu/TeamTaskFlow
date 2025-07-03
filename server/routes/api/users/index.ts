import { Router } from 'express';
import { storage } from '../../../storage';
import { handleApiError } from '../../../utils/errors';
import { requireAuth, isAdmin } from '../../../middleware';
import { Logger } from '../../../utils/logger';
import { z } from 'zod';

const router = Router();
const logger = new Logger('UserRoutes');

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const users = await storage.getUsers();
    
    logger.info('Users fetched successfully', { count: users.length });
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users', { error, userId: req.user?.id });
    handleApiError(res, error);
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get a user by ID
 * @access Private
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ 
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Invalid user ID'
        }
      });
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({
        error: {
          type: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    logger.info('User fetched successfully', { userId });
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user', { userId: req.params.id, error });
    handleApiError(res, error);
  }
});

/**
 * @route PUT /api/users/:id
 * @desc Update a user by ID (admin only)
 * @access Admin
 */
router.put('/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ 
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Invalid user ID'
        }
      });
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({
        error: {
          type: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Validate the request body
    const updateSchema = z.object({
      email: z.string().email().optional(),
      notificationPreferences: z.record(z.boolean()).optional(),
      username: z.string().min(3).optional(),
      newPassword: z.string().min(6).optional(),
    });
    
    const validationResult = updateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validationResult.error.format()
        }
      });
    }
    
    let updatedUser = user;
    
    // Update email if provided
    if (req.body.email) {
      updatedUser = await storage.updateUserEmail(userId, req.body.email);
    }
    
    // Update username if provided
    if (req.body.username) {
      // Check if username is already taken
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Username already exists'
          }
        });
      }
      updatedUser = await storage.updateUserUsername(userId, req.body.username);
    }
    
    // Update password if provided
    if (req.body.newPassword) {
      updatedUser = await storage.updateUserPassword(userId, req.body.newPassword);
    }
    
    // Update notification preferences if provided
    if (req.body.notificationPreferences) {
      updatedUser = await storage.updateUserNotificationPreferences(userId, req.body.notificationPreferences);
    }
    
    logger.info('User updated successfully', { userId });
    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user', { userId: req.params.id, error });
    handleApiError(res, error);
  }
});

export default router;