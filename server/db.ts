/**
 * Database connection and configuration
 * 
 * This file exports the database connection pool and Drizzle ORM instance
 * to be used throughout the application.
 * 
 * The actual implementation is in server/database/connection.ts
 */

import { pool, db } from './database/connection';

// Re-export the database connection and Drizzle ORM
export { pool, db };