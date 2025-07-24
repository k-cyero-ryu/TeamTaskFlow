import { Router } from 'express';
import { storage } from '../../../storage';
import { checkExpensePermissions } from '../../../middleware/expense-permissions';
import { insertUserExpensePermissionSchema } from '@shared/schema';
import { Logger } from '../../../utils/logger';

const router = Router();
const logger = new Logger('ExpensePermissions');

// Get all users with their expense permissions
router.get('/', checkExpensePermissions('access'), async (req, res) => {
  try {
    const users = await storage.getUsersWithExpenseAccess();
    logger.info('Fetched users with expense access', { count: users.length });
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users with expense access', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get specific user's expense permissions
router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Users can only fetch their own permissions, unless they have access management permissions
    const requesterId = req.user.id;
    if (requesterId !== userId && requesterId !== 1) {
      // Check if the requester has access management permissions
      const requesterPermissions = await storage.getUserExpensePermissions(requesterId);
      if (!requesterPermissions?.canManageAccess) {
        return res.status(403).json({ error: 'Access denied. You can only view your own permissions.' });
      }
    }

    const permissions = await storage.getUserExpensePermissions(userId);
    res.json(permissions || null);
  } catch (error) {
    logger.error('Error fetching user expense permissions', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

// Set user's expense permissions
router.post('/:userId', checkExpensePermissions('access'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate the request body
    const validationResult = insertUserExpensePermissionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid permissions data', 
        details: validationResult.error.errors 
      });
    }

    const permissions = await storage.setUserExpensePermissions(
      userId,
      validationResult.data,
      req.user.id
    );

    logger.info('User expense permissions updated', { 
      userId, 
      permissions: validationResult.data,
      grantedBy: req.user.id 
    });

    res.json(permissions);
  } catch (error) {
    logger.error('Error setting user expense permissions', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to set user permissions' });
  }
});

export default router;