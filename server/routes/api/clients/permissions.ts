import { Router } from 'express';
import { storage } from '../../../storage';
import { checkClientPermissions } from '../../../middleware/client-permissions';
import { insertUserClientPermissionSchema } from '@shared/schema';
import { Logger } from '../../../utils/logger';

const router = Router();
const logger = new Logger('ClientPermissions');

// Get all users with their client permissions
router.get('/', checkClientPermissions('access'), async (req, res) => {
  try {
    const users = await storage.getUsersWithClientAccess();
    logger.info('Fetched users with client access', { count: users.length });
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users with client access', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get specific user's client permissions
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
      const requesterPermissions = await storage.getUserClientPermissions(requesterId);
      if (!requesterPermissions?.canManageAccess) {
        return res.status(403).json({ error: 'Access denied. You can only view your own permissions.' });
      }
    }

    const permissions = await storage.getUserClientPermissions(userId);
    res.json(permissions || null);
  } catch (error) {
    logger.error('Error fetching user client permissions', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

// Set user's client permissions
router.post('/:userId', checkClientPermissions('access'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate the request body
    const validationResult = insertUserClientPermissionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid permissions data', 
        details: validationResult.error.errors 
      });
    }

    const permissions = await storage.setUserClientPermissions(
      userId,
      validationResult.data,
      req.user.id
    );

    logger.info('User client permissions updated', { 
      userId, 
      permissions: validationResult.data,
      grantedBy: req.user.id 
    });

    res.json(permissions);
  } catch (error) {
    logger.error('Error setting user client permissions', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to set user permissions' });
  }
});

export default router;