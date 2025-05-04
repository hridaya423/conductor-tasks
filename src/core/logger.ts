import winston from 'winston';
import path from 'path';
import fs from 'fs';

const isMcpMode = process.env.MCP_MODE === 'true' || 
                  process.argv.some(arg => arg.includes('mcp')) ||
                  process.send !== undefined;

const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'conductor.log');

try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
} catch (error) {
  console.error('Could not create log directory:', error);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
      let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

      const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
      if (meta) {
        msg += ` ${meta}`;
      }
      if (stack) {

        msg += `\n${stack}`;
      }
      return msg;
    })
  ),
  transports: [

    new winston.transports.Console({
      level: isMcpMode ? 'warn' : 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (stack) {
            msg += `\n${stack}`;
          }
          return msg;
        })
      )
    }),

    new winston.transports.File({
      filename: logFile,
      level: 'debug',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    })
  ],
  exceptionHandlers: [

    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
  ],
  rejectionHandlers: [

    new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
  ],
  exitOnError: false
});

logger.info('Logger initialized');
logger.debug(`MCP Mode: ${isMcpMode}`);
logger.debug(`Log level: ${logger.level}`);
logger.debug(`Log file: ${logFile}`);

export default logger;
