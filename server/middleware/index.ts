/**
 * Authentication middleware functions
 */
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { Logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

const logger = new Logger('Middleware');

/**
 * Require the user to be authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    logger.warn('Unauthorized access attempt', { 
      ip: req.ip, 
      path: req.path,
      method: req.method
    });
    return res.status(401).json({
      error: {
        type: 'AUTHENTICATION_ERROR',
        message: 'Authentication required'
      }
    });
  }
  next();
}

/**
 * Require the user to be an admin
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    logger.warn('Unauthorized admin access attempt', { 
      userId: req.user?.id, 
      ip: req.ip, 
      path: req.path,
      method: req.method
    });
    return res.status(403).json({
      error: {
        type: 'AUTHORIZATION_ERROR',
        message: 'Admin access required'
      }
    });
  }
  next();
}

/**
 * Validate request body against a Zod schema
 */
export function validateRequest(schema: ZodSchema | Record<string, (value: string) => boolean>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema && typeof schema === 'object' && 'parse' in schema) {
        // If it's a Zod schema
        const validationResult = schema.safeParse(req.body);
        if (validationResult.success === false) {
          return res.status(400).json({
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: validationResult.error.format()
            }
          });
        }
        req.body = validationResult.data;
      } else {
        // If it's a standard validator object
        const errors: Record<string, string> = {};
        for (const [field, validator] of Object.entries(schema as Record<string, (value: string) => boolean>)) {
          if (field in req.body && !validator(req.body[field])) {
            errors[field] = `Invalid value for field '${field}'`;
          }
        }
        
        if (Object.keys(errors).length > 0) {
          return res.status(400).json({
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: errors
            }
          });
        }
      }
      
      next();
    } catch (error) {
      logger.error('Validation error', { error });
      return res.status(500).json({
        error: {
          type: 'SERVER_ERROR',
          message: 'An error occurred during request validation'
        }
      });
    }
  };
}

/**
 * Validate URL parameters
 */
export function validateParams(validations: Record<string, (param: string) => boolean>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check each required parameter
      const errors: Record<string, string> = {};
      
      for (const [param, validator] of Object.entries(validations)) {
        const value = req.params[param];
        
        if (!value || !validator(value)) {
          errors[param] = `Invalid ${param} parameter`;
        }
      }
      
      // If there are validation errors, return a 400 response
      if (Object.keys(errors).length > 0) {
        throw new ValidationError('Invalid parameters', errors);
      }
      
      // If all is well, proceed
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: {
            type: 'VALIDATION_ERROR',
            message: error.message,
            details: error.details
          }
        });
      }
      
      logger.error('Error validating parameters', { error });
      return res.status(500).json({
        error: {
          type: 'SERVER_ERROR',
          message: 'An error occurred during parameter validation'
        }
      });
    }
  };
}

/**
 * Log request details
 */
export function logRequest(req: Request, res: Response, next: NextFunction) {
  logger.info(`${req.method} ${req.path} - Request received`, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent'),
  });
  
  // Calculate response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
      statusCode: res.statusCode,
      duration
    });
  });
  
  next();
}