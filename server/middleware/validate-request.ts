import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { Logger } from '../utils/logger';

const logger = new Logger('RequestValidation');

/**
 * Middleware to validate request body against a Zod schema
 * @param schema The Zod schema to validate against
 * @returns Express middleware
 */
export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse the request body against the schema
      const validatedData = await schema.parseAsync(req.body);
      
      // Replace the request body with the validated data
      req.body = validatedData;
      
      // Continue to the next middleware
      next();
    } catch (error) {
      // If the error is a ZodError, return a 400 response with the validation errors
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }));
        
        logger.debug('Request validation failed', { 
          path: req.path, 
          errors: formattedErrors 
        });
        
        res.status(400).json({
          error: 'Validation failed',
          details: formattedErrors
        });
      } else {
        // For any other errors, pass to the next error handler
        logger.error('Unexpected error during request validation', {
          path: req.path,
          error
        });
        
        next(error);
      }
    }
  };
}