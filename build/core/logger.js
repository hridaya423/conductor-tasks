import winston from 'winston';
import path from 'path';
import fs from 'fs';
// Determine if running in MCP mode (less verbose console output)
const isMcpMode = process.env.MCP_MODE === 'true' ||
    process.argv.some(arg => arg.includes('mcp')) ||
    process.send !== undefined;
const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'conductor.log');
// Ensure log directory exists
try {
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
}
catch (error) {
    console.error('Could not create log directory:', error);
}
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Default to 'info', can be configured via env var
    format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), // Log stack traces
    winston.format.splat(), winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
        let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        // Add metadata if any, excluding known winston props
        const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
        if (meta) {
            msg += ` ${meta}`;
        }
        if (stack) {
            // Log stack trace for errors
            msg += `\n${stack}`;
        }
        return msg;
    })),
    transports: [
        // Console transport - less verbose in MCP mode
        new winston.transports.Console({
            level: isMcpMode ? 'warn' : 'info', // Log only warnings and errors to console in MCP mode
            format: winston.format.combine(winston.format.colorize(), // Add colors
            winston.format.printf(({ timestamp, level, message, stack }) => {
                let msg = `${timestamp} [${level}]: ${message}`;
                if (stack) {
                    msg += `\n${stack}`;
                }
                return msg;
            }))
        }),
        // File transport - logs everything to a file
        new winston.transports.File({
            filename: logFile,
            level: 'debug', // Log everything from debug level up to the file
            maxsize: 5 * 1024 * 1024, // 5MB max size
            maxFiles: 3, // Keep up to 3 log files
            tailable: true,
        })
    ],
    exceptionHandlers: [
        // Log unhandled exceptions to file
        new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
    ],
    rejectionHandlers: [
        // Log unhandled promise rejections to file
        new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
    ],
    exitOnError: false // Do not exit on handled exceptions
});
// Add stream for morgan dependency if needed (e.g., for an HTTP server)
// logger.stream = {
//   write: (message: string): void => {
//     logger.info(message.substring(0, message.lastIndexOf('\n')));
//   },
// };
logger.info('Logger initialized');
logger.debug(`MCP Mode: ${isMcpMode}`);
logger.debug(`Log level: ${logger.level}`);
logger.debug(`Log file: ${logFile}`);
export default logger;
//# sourceMappingURL=logger.js.map