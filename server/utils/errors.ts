import { Response } from 'express';
import { Logger } from './logger';

const logger = new Logger('Errors');

/**
 * Custom error types for better error handling across the application
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DATABASE = 'DATABASE_ERROR',
  INTERNAL = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
}

/**
 * Base API error class with standardized structure
 */
export class ApiError extends Error {
  type: ErrorType;
  statusCode: number;
  details?: any;

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
  }

  /**
   * Convert the error to a response object
   */
  toResponse() {
    return {
      error: {
        type: this.type,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(ErrorType.VALIDATION, message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Error for resource not found
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(ErrorType.NOT_FOUND, message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Error for unauthorized access attempts
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(ErrorType.UNAUTHORIZED, message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error for forbidden actions (authorized but no permission)
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(ErrorType.FORBIDDEN, message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Error for database operations
 */
export class DatabaseError extends ApiError {
  constructor(message: string, details?: any) {
    super(ErrorType.DATABASE, message, 500, details);
    this.name = 'DatabaseError';
  }
}

/**
 * Error for general bad requests
 */
export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(ErrorType.BAD_REQUEST, message, 400);
    this.name = 'BadRequestError';
  }
}

/**
 * Error for resource conflicts
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(ErrorType.CONFLICT, message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Error for internal server errors
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(ErrorType.INTERNAL, message, 500, details);
    this.name = 'InternalServerError';
  }
}

/**
 * Standardized error handler for API responses
 * @param res - Express response object
 * @param error - Error to handle
 */
export function handleApiError(res: Response, error: unknown): void {
  // Handle API-specific errors
  if (error instanceof ApiError) {
    logger.error(`${error.name}: ${error.message}`, error.details);
    res.status(error.statusCode).json(error.toResponse());
    return;
  }

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'errors' in error) {
    const validationError = new ValidationError('Validation failed', error);
    logger.error(`${validationError.name}: ${validationError.message}`, validationError.details);
    res.status(validationError.statusCode).json(validationError.toResponse());
    return;
  }

  // Handle unexpected errors
  const message = error instanceof Error ? error.message : String(error);
  const internalError = new InternalServerError(message);
  
  logger.error(`Unhandled error: ${message}`, { 
    stack: error instanceof Error ? error.stack : undefined 
  });
  
  res.status(internalError.statusCode).json(internalError.toResponse());
}