import { Request, Response, NextFunction } from 'express';
import { handleApiError, UnauthorizedError } from '../utils/errors';
import { Logger } from '../utils/logger';

const logger = new Logger('Middleware');

/**
 * Middleware to ensure authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return handleApiError(res, new UnauthorizedError());
  }
  next();
}

/**
 * Middleware to catch and standardize error handling
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  handleApiError(res, err);
}

/**
 * Middleware to log incoming requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  
  // Log request start
  logger.info(`${method} ${originalUrl} - Request received`, {
    ip,
    userAgent: req.headers['user-agent'],
  });

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Determine log level based on status code
    if (statusCode >= 500) {
      logger.error(`${method} ${originalUrl} - ${statusCode} - ${duration}ms`, {
        statusCode,
        duration,
      });
    } else if (statusCode >= 400) {
      logger.warn(`${method} ${originalUrl} - ${statusCode} - ${duration}ms`, {
        statusCode,
        duration,
      });
    } else {
      logger.info(`${method} ${originalUrl} - ${statusCode} - ${duration}ms`, {
        statusCode,
        duration,
      });
    }
  });

  next();
}

/**
 * Middleware to validate request parameters
 */
export function validateParams<T>(
  schema: any,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req[source]);
      
      if (!result.success) {
        const errorMessage = 'Request validation failed';
        logger.warn(errorMessage, { errors: result.error });
        return res.status(400).json({ 
          error: {
            message: errorMessage,
            details: result.error,
          }
        });
      }
      
      // Update request with validated data
      req[source] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}