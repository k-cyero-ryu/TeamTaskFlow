import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { Logger } from '../utils/logger';

const logger = new Logger('Auth');

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email?: string;
      isAdmin?: boolean;
    }
  }
}

/**
 * Middleware to check if the user is authenticated
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  logger.debug('Unauthorized access attempt', { 
    path: req.originalUrl, 
    method: req.method,
    ip: req.ip
  });
  
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Middleware to check if the user is an admin
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user?.isAdmin) {
    return next();
  }
  
  logger.debug('Unauthorized admin access attempt', { 
    userId: req.user?.id, 
    path: req.originalUrl, 
    method: req.method,
    ip: req.ip
  });
  
  res.status(403).json({ error: 'Admin access required' });
}

/**
 * Middleware to check if the user has access to a specific task
 */
export async function canAccessTask(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check if user is the creator or a participant
    const participants = await storage.getTaskParticipants(taskId);
    const isParticipant = participants.some(p => p.id === req.user?.id);
    
    if (task.creatorId === req.user?.id || isParticipant || req.user?.isAdmin) {
      // Add task to request for later use
      (req as any).task = task;
      return next();
    }
    
    logger.debug('Unauthorized task access attempt', { 
      userId: req.user?.id, 
      taskId,
      path: req.originalUrl
    });
    
    res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    logger.error('Error in canAccessTask middleware', { error });
    res.status(500).json({ error: 'Server error' });
  }
}