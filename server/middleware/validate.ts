import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { Logger } from '../utils/logger';

const logger = new Logger('Validation');

/**
 * Middleware factory for validating request body against a Zod schema
 * @param schema The Zod schema to validate against
 */
export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate the request body against the schema
      const validatedData = await schema.parseAsync(req.body);
      
      // Replace request body with validated data
      req.body = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Convert Zod error to a more readable format
        const validationError = fromZodError(error);
        
        logger.debug('Validation error', { 
          path: req.originalUrl, 
          error: validationError.message,
          body: req.body 
        });
        
        res.status(400).json({ 
          error: 'Validation error',
          details: validationError.message
        });
      } else {
        logger.error('Unexpected validation error', { error });
        res.status(500).json({ error: 'Internal server error during validation' });
      }
    }
  };
}

/**
 * Middleware for validating URL parameters against a simple schema
 * @param paramSchema Map of parameter names to their validators
 */
export function validateParams(paramSchema: Record<string, (value: string) => boolean>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Record<string, string> = {};
    
    // Check each parameter against its validator
    for (const [param, validator] of Object.entries(paramSchema)) {
      const value = req.params[param];
      
      if (!value || !validator(value)) {
        errors[param] = `Invalid ${param}`;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      logger.debug('Parameter validation error', { 
        path: req.originalUrl, 
        errors 
      });
      
      return res.status(400).json({ 
        error: 'Validation error',
        details: errors
      });
    }
    
    next();
  };
}