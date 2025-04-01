import { Response } from 'express';
import { Logger } from './logger';

const logger = new Logger('ErrorHandler');

/**
 * Base class for API errors
 */
export class ApiError extends Error {
  statusCode: number;
  type: string;
  details?: Record<string, any>;
  
  constructor(message: string, statusCode: number = 500, type: string = 'SERVER_ERROR', details?: Record<string, any>) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.details = details;
    this.name = this.constructor.name;
    
    // Maintain proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends ApiError {
  constructor(message: string = 'Validation error', details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Error for resource not found
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

/**
 * Error for unauthorized access
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Error for forbidden access
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Error for conflict situations
 */
export class ConflictError extends ApiError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

/**
 * Error for internal server errors
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'SERVER_ERROR');
  }
}

/**
 * Error for service unavailable situations
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE_ERROR');
  }
}

/**
 * Error for database-related issues
 */
export class DatabaseError extends ApiError {
  constructor(message: string = 'Database error', details?: Record<string, any>) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

/**
 * Handle API errors and send appropriate response
 */
export function handleApiError(res: Response, error: any) {
  // If it's one of our API error types
  if (error instanceof ApiError) {
    logger.warn(`API Error: ${error.type}`, { 
      message: error.message,
      status: error.statusCode,
      details: error.details 
    });
    
    return res.status(error.statusCode).json({
      error: {
        type: error.type,
        message: error.message,
        ...(error.details && { details: error.details })
      }
    });
  }
  
  // If it's some other error, treat as internal server error
  logger.error('Unhandled error in API request', { error });
  
  return res.status(500).json({
    error: {
      type: 'SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}