import { Pool, neonConfig, PoolClient } from '@neondatabase/serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Logger } from '../utils/logger';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

// Validate database URL
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Logger instance for database operations
const logger = new Logger('Database');

/**
 * Database connection configuration
 */
export const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000, // 15 second connection timeout
  idleTimeoutMillis: 30000,       // Close idle connections after 30 seconds
  max: 10,                        // Maximum number of clients in the pool
};

/**
 * The connection pool for database connections
 */
export const pool = new Pool(connectionConfig);

// Add comprehensive error handling for the pool
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', { error: err.message, stack: err.stack });
});

// Add connect listener for monitoring
pool.on('connect', (client) => {
  logger.info('Database connection established successfully');
});

// Add acquire listener to track connection acquisition
pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

// Add remove listener to track connection removal
pool.on('remove', (client) => {
  logger.debug('Client removed from pool');
});

/**
 * The Drizzle ORM instance
 */
export const db = drizzle({ client: pool, schema });

/**
 * Maximum number of retry attempts for database operations
 */
const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
const BASE_RETRY_DELAY = 300;

/**
 * Executes a database query with retry mechanism and proper error handling
 * @param operation - The database operation to execute
 * @param operationName - Optional name for the operation for logging purposes
 * @returns The result of the database operation
 */
export async function executeWithRetry<T>(
  operation: (client?: PoolClient) => Promise<T>,
  operationName = 'Database operation'
): Promise<T> {
  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      if (retryCount > 0) {
        // Log retry attempts
        logger.info(`Retrying ${operationName} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        // Exponential backoff
        const delayMs = BASE_RETRY_DELAY * Math.pow(2, retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // Execute the operation
      const result = await operation();
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Log the error
      logger.error(`Error in ${operationName}`, { 
        error: error.message, 
        code: error.code,
        retry: retryCount + 1 
      });

      // Check if the error is recoverable
      if (
        error.code === 'CONNECTION_ERROR' ||
        error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === '57P01' || // Termination by admin command
        error.code === '08006' || // Connection failure
        error.code === '08001' || // Unable to connect
        error.code === '08004'    // Rejected connection
      ) {
        retryCount++;
        continue;
      }
      
      // Non-recoverable error - break out of retry loop
      break;
    }
  }

  // If we got here, all retries failed
  logger.error(`All retry attempts for ${operationName} failed`, { 
    error: lastError?.message,
    maxRetries: MAX_RETRIES 
  });
  
  throw lastError || new Error(`Failed to execute ${operationName} after multiple retries`);
}

/**
 * Executes a database operation within a transaction
 * @param operations - Function containing the operations to execute within the transaction
 * @returns The result of the transaction
 */
export async function executeTransaction<T>(
  operations: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await operations(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Test the connection on startup
try {
  executeWithRetry(async () => {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      logger.info('Database connection verified successfully');
    } finally {
      client.release();
    }
  }, 'Initial connection test');
} catch (err) {
  logger.error('Failed to establish initial database connection', {
    error: err instanceof Error ? err.message : String(err)
  });
}