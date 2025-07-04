import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { Logger } from '../utils/logger';

const logger = new Logger('ProformaPermissions');

type ProformaPermissionLevel = 'view' | 'manage' | 'delete' | 'access';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email?: string;
  };
}

export function checkProformaPermissions(level: ProformaPermissionLevel) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      // Admin (user ID 1) has all permissions
      if (userId === 1) {
        return next();
      }

      // Get user's proforma permissions
      const permissions = await storage.getUserProformaPermissions(userId);

      if (!permissions) {
        logger.warn('Access denied - no proforma permissions', { 
          userId, 
          requiredLevel: level, 
          ip: req.ip 
        });
        return res.status(403).json({ 
          error: 'Access denied. You do not have permission to access proformas.' 
        });
      }

      // Check specific permission level
      let hasPermission = false;
      switch (level) {
        case 'view':
          hasPermission = Boolean(permissions.canViewProformas);
          break;
        case 'manage':
          hasPermission = Boolean(permissions.canManageProformas);
          break;
        case 'delete':
          hasPermission = Boolean(permissions.canDeleteProformas);
          break;
        case 'access':
          hasPermission = Boolean(permissions.canManageAccess);
          break;
      }

      if (!hasPermission) {
        logger.warn('Access denied - insufficient proforma permissions', { 
          userId, 
          requiredLevel: level, 
          userPermissions: permissions,
          ip: req.ip 
        });
        return res.status(403).json({ 
          error: `Access denied. You do not have permission to ${level} proformas.` 
        });
      }

      logger.debug('Proforma permission check passed', { 
        userId, 
        requiredLevel: level,
        ip: req.ip 
      });
      
      next();
    } catch (error) {
      logger.error('Error checking proforma permissions', { 
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