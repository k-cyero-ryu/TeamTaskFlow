import { Router } from 'express';
import { storage } from '../../../storage';
import { handleApiError } from '../../../utils/errors';
import { requireAuth } from '../../../middleware';
import { Logger } from '../../../utils/logger';

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

export default router;