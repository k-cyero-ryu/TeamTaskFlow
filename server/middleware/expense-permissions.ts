import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { Logger } from '../utils/logger';

const logger = new Logger('ExpensePermissions');

type ExpensePermissionLevel = 'view' | 'manage' | 'delete' | 'access';

export function checkExpensePermissions(level: ExpensePermissionLevel) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        logger.warn('Unauthenticated access attempt to expense resource', { 
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
        logger.debug('Admin user granted full expense access', { 
          userId, 
          requiredLevel: level,
          ip: req.ip 
        });
        return next();
      }

      // Get user's expense permissions from database
      const permissions = await storage.getUserExpensePermissions(userId);
      
      if (!permissions) {
        logger.warn('Access denied - no expense permissions found', { 
          userId, 
          requiredLevel: level,
          ip: req.ip 
        });
        return res.status(403).json({ 
          error: 'Access denied. You do not have permission to access expenses.' 
        });
      }

      // Check specific permission level
      let hasPermission = false;
      switch (level) {
        case 'view':
          hasPermission = Boolean(permissions.canViewExpenses);
          break;
        case 'manage':
          hasPermission = Boolean(permissions.canManageExpenses);
          break;
        case 'delete':
          hasPermission = Boolean(permissions.canDeleteExpenses);
          break;
        case 'access':
          hasPermission = Boolean(permissions.canManageAccess);
          break;
      }

      if (!hasPermission) {
        logger.warn('Access denied - insufficient expense permissions', { 
          userId, 
          requiredLevel: level, 
          userPermissions: permissions,
          ip: req.ip 
        });
        return res.status(403).json({ 
          error: `Access denied. You do not have permission to ${level} expenses.` 
        });
      }

      logger.debug('Expense permission check passed', { 
        userId, 
        requiredLevel: level,
        ip: req.ip 
      });
      
      next();
    } catch (error) {
      logger.error('Error checking expense permissions', { 
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