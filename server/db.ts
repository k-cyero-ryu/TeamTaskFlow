import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure pool with retry settings and better defaults
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  maxRetries: 5,
  retryInterval: 1000, // 1 second between retries
  connectionTimeoutMillis: 10000, // 10 second connection timeout
  idleTimeoutMillis: 60000, // Close idle connections after 1 minute
  max: 20, // Maximum number of clients in the pool
});

// Add error handling for the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Add connect listener
pool.on('connect', (client) => {
  console.log('Database connection established successfully');
});

export const db = drizzle({ client: pool, schema });

// Test the connection
pool.connect()
  .then(() => {
    console.log('Database connection established successfully');
  })
  .catch(err => {
    console.error('Error connecting to the database:', err);
    // Don't exit the process, let it retry
  });