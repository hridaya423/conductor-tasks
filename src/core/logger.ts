import winston from 'winston';
import path from 'path';
// import fs from 'fs'; // No longer needed

const isMcpMode = process.env.MCP_MODE === 'true' || 
                  process.argv.some(arg => arg.includes('mcp')) ||
                  process.send !== undefined;

// const logDir = path.join(process.cwd(), 'logs'); // Removed
// const logFile = path.join(logDir, 'conductor.log'); // Removed

// try { // Removed
//   if (!fs.existsSync(logDir)) { // Removed
//     fs.mkdirSync(logDir); // Removed
//   } // Removed
// } catch (error) { // Removed
//   console.error('Could not create log directory:', error); // Removed
// } // Removed

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
        msg += `\\n${stack}`;
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
            msg += `\\n${stack}`;
          }
          return msg;
        })
      )
    }),
    // new winston.transports.File({ // Removed
    //   filename: logFile, // Removed
    //   level: 'debug', // Removed
    //   maxsize: 5 * 1024 * 1024, // Removed
    //   maxFiles: 3, // Removed
    //   tailable: true, // Removed
    // }) // Removed
  ],
  // exceptionHandlers: [ // Removed
  //   new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') }) // Removed
  // ], // Removed
  // rejectionHandlers: [ // Removed
  //   new winston.transports.File({ filename: path.join(logDir, 'rejections.log') }) // Removed
  // ], // Removed
  exceptionHandlers: [], // Set to empty array
  rejectionHandlers: [], // Set to empty array
  exitOnError: false
});

logger.info('Logger initialized (console only)');
// logger.debug(`Log file: ${logFile}`); // Removed

export default logger;
