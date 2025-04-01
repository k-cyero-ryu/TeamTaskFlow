/**
 * Simple logger utility for better structured logging
 */
export class Logger {
  private source: string;
  
  constructor(source: string) {
    this.source = source;
  }
  
  /**
   * Log an informational message
   * @param message Log message
   * @param data Optional data to include
   */
  info(message: string, data?: Record<string, any>) {
    this.log('INFO', message, data);
  }
  
  /**
   * Log a warning message
   * @param message Log message
   * @param data Optional data to include
   */
  warn(message: string, data?: Record<string, any>) {
    this.log('WARN', message, data);
  }
  
  /**
   * Log an error message
   * @param message Log message
   * @param data Optional data to include
   */
  error(message: string, data?: Record<string, any>) {
    // Handle special case for error objects
    if (data && data.error instanceof Error) {
      const err = data.error;
      data = {
        ...data,
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack
        }
      };
    }
    
    this.log('ERROR', message, data);
  }
  
  /**
   * Log a debug message
   * @param message Log message
   * @param data Optional data to include
   */
  debug(message: string, data?: Record<string, any>) {
    // Only log debug messages if DEBUG environment variable is set
    if (process.env.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }
  
  /**
   * Private method to handle all logging
   */
  private log(level: string, message: string, data?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      source: this.source,
      message,
      ...data
    };
    
    // Special formatting for errors for better visibility
    if (level === 'ERROR') {
      console.error(JSON.stringify(logEntry, null, 2));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
}