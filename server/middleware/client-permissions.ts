import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { Logger } from '../utils/logger';

const logger = new Logger('ClientPermissions');

type ClientPermissionLevel = 'view' | 'manage' | 'delete' | 'access';

export function checkClientPermissions(level: ClientPermissionLevel) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        logger.warn('Unauthenticated access attempt to client resource', { 
          requiredLevel: level,
          ip: req.ip 
        });
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }

      const userId = req.user.id;

      // Admin user (ID 1) always has all permissions
      if (userId === 1) {
        logger.debug('Admin user granted full client access', { 
          userId, 
          requiredLevel: level,
          ip: req.ip 
        });
        return next();
      }

      // Get user's client permissions from database
      const permissions = await storage.getUserClientPermissions(userId);
      
      if (!permissions) {
        logger.warn('Access denied - no client permissions found', { 
          userId, 
          requiredLevel: level,
          ip: req.ip 
        });
        return res.status(403).json({ 
          error: 'Access denied. You do not have permission to access clients.' 
        });
      }

      // Check specific permission level
      let hasPermission = false;
      switch (level) {
        case 'view':
          hasPermission = Boolean(permissions.canViewClients);
          break;
        case 'manage':
          hasPermission = Boolean(permissions.canManageClients);
          break;
        case 'delete':
          hasPermission = Boolean(permissions.canDeleteClients);
          break;
        case 'access':
          hasPermission = Boolean(permissions.canManageAccess);
          break;
      }

      if (!hasPermission) {
        logger.warn('Access denied - insufficient client permissions', { 
          userId, 
          requiredLevel: level, 
          userPermissions: permissions,
          ip: req.ip 
        });
        return res.status(403).json({ 
          error: `Access denied. You do not have permission to ${level} clients.` 
        });
      }

      logger.debug('Client permission check passed', { 
        userId, 
        requiredLevel: level,
        ip: req.ip 
      });
      
      next();
    } catch (error) {
      logger.error('Error checking client permissions', { 
        error, 
        userId: req.user?.id, 
        requiredLevel: level,
        ip: req.ip 
      });
      
      res.status(500).json({ 
        error: 'Failed to verify permissions' 
      });
    }
  };
}