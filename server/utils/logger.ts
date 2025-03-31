/**
 * A standardized logger implementation for consistent logging throughout the application
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Log debug level information
   */
  debug(message: string, meta?: Record<string, any>): void {
    this.log('DEBUG', message, meta);
  }

  /**
   * Log informational messages
   */
  info(message: string, meta?: Record<string, any>): void {
    this.log('INFO', message, meta);
  }

  /**
   * Log warning messages
   */
  warn(message: string, meta?: Record<string, any>): void {
    this.log('WARN', message, meta);
  }

  /**
   * Log error messages
   */
  error(message: string, meta?: Record<string, any>): void {
    this.log('ERROR', message, meta);
  }

  /**
   * Format and output log messages
   */
  private log(level: string, message: string, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const context = this.context ? `[${this.context}]` : '';
    
    // Format the log message
    const formattedMeta = meta ? JSON.stringify(meta, null, 2) : '';
    const logEntry = {
      timestamp,
      level,
      context,
      message,
      ...(meta && { meta }),
    };
    
    // Output to console with appropriate method
    switch (level) {
      case 'ERROR':
        console.error(JSON.stringify(logEntry));
        break;
      case 'WARN':
        console.warn(JSON.stringify(logEntry));
        break;
      case 'DEBUG':
        console.debug(JSON.stringify(logEntry));
        break;
      case 'INFO':
      default:
        console.log(JSON.stringify(logEntry));
    }
  }
}

export const appLogger = new Logger('App');