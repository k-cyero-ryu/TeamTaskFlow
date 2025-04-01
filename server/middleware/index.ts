import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to log all requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
}

/**
 * Middleware to handle errors
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({ error: message });
}

// Export all middleware from other files
export * from './auth';
export * from './validate';