/**
 * Simple logger class for consistent logging format
 */
export class Logger {
  private context: string;
  
  /**
   * Create a new logger with a specific context
   * @param context The context of the logger (usually the class or module name)
   */
  constructor(context: string) {
    this.context = context;
  }
  
  /**
   * Log a debug message
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  debug(message: string, meta?: any): void {
    this.log('DEBUG', message, meta);
  }
  
  /**
   * Log an info message
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  info(message: string, meta?: any): void {
    this.log('INFO', message, meta);
  }
  
  /**
   * Log a warning message
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  warn(message: string, meta?: any): void {
    this.log('WARN', message, meta);
  }
  
  /**
   * Log an error message
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  error(message: string, meta?: any): void {
    this.log('ERROR', message, meta);
  }
  
  /**
   * Log a message with a specific level
   * @param level The log level
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  private log(level: string, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
      timestamp,
      level,
      context: `[${this.context}]`,
      message,
      meta: meta || null
    }));
  }
}