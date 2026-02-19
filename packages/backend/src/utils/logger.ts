/**
 * Winston logger configuration for the Stellar DApp backend
 */

import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || 'logs/app.log';

// Ensure logs directory exists
const logDir = path.dirname(logFile);

export const createLogger = () => {
  const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'stellar-dapp-backend' },
    transports: [
      // Write all logs with importance level of `error` or less to `error.log`
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'), 
        level: 'error' 
      }),
      // Write all logs with importance level of `info` or less to combined log
      new winston.transports.File({ 
        filename: logFile 
      }),
    ],
  });

  // If we're not in production, log to the console as well
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  return logger;
};

// Export a default logger instance
export const logger = createLogger();