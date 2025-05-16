export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["INFO"] = "INFO";
    ErrorSeverity["WARNING"] = "WARNING";
    ErrorSeverity["ERROR"] = "ERROR";
    ErrorSeverity["CRITICAL"] = "CRITICAL";
})(ErrorSeverity || (ErrorSeverity = {}));
export var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["FILESYSTEM"] = "FILESYSTEM";
    ErrorCategory["NETWORK"] = "NETWORK";
    ErrorCategory["PARSING"] = "PARSING";
    ErrorCategory["VALIDATION"] = "VALIDATION";
    ErrorCategory["CONFIGURATION"] = "CONFIGURATION";
    ErrorCategory["LLM"] = "LLM";
    ErrorCategory["UNKNOWN"] = "UNKNOWN";
})(ErrorCategory || (ErrorCategory = {}));
export class TaskError extends Error {
    constructor(message, category = ErrorCategory.UNKNOWN, severity = ErrorSeverity.ERROR, context = { operation: 'unknown' }, originalError) {
        super(message);
        this.name = 'TaskError';
        this.severity = severity;
        this.category = category;
        this.context = context;
        this.timestamp = Date.now();
        this.originalError = originalError;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TaskError);
        }
    }
    toString() {
        const timestamp = new Date(this.timestamp).toISOString();
        let errorStr = `[${timestamp}] [${this.severity}] [${this.category}] ${this.message}`;
        errorStr += `\nOperation: ${this.context.operation}`;
        if (this.context.targetFile) {
            errorStr += `\nTarget File: ${this.context.targetFile}`;
        }
        if (this.context.taskId) {
            errorStr += `\nTask ID: ${this.context.taskId}`;
        }
        if (this.context.additionalInfo) {
            errorStr += `\nAdditional Info: ${JSON.stringify(this.context.additionalInfo, null, 2)}`;
        }
        if (this.originalError) {
            errorStr += `\nOriginal Error: ${this.originalError.message}`;
            if (this.originalError.stack) {
                errorStr += `\nOriginal Stack: ${this.originalError.stack}`;
            }
        }
        if (this.stack) {
            errorStr += `\nStack Trace: ${this.stack}`;
        }
        return errorStr;
    }
}
export class ErrorHandler {
    constructor() {
        this.isMcpMode = process.env.MCP_MODE === 'true' ||
            process.argv.some(arg => arg.includes('mcp')) ||
            process.send !== undefined;
        this.isTestMode = process.env.NODE_ENV === 'test';
        this.consoleEnabled = !this.isMcpMode;
        this.fileLoggingEnabled = false;
        this.maxLogSize = parseInt(process.env.MAX_LOG_SIZE || '5242880', 10);
        this.maxLogFiles = parseInt(process.env.MAX_LOG_FILES || '5', 10);
        this.logFilePath = '';
    }
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    configure(options) {
        if (options.consoleEnabled !== undefined) {
            this.consoleEnabled = options.consoleEnabled;
        }
        if (options.maxLogSize) {
            this.maxLogSize = options.maxLogSize;
        }
        if (options.maxLogFiles) {
            this.maxLogFiles = options.maxLogFiles;
        }
    }
    handleError(error, silent = false) {
        let taskError;
        if (!(error instanceof TaskError)) {
            taskError = new TaskError(error.message, ErrorCategory.UNKNOWN, ErrorSeverity.ERROR, { operation: 'unknown' }, error);
        }
        else {
            taskError = error;
        }
        const errorString = taskError.toString();
        if (this.consoleEnabled && !silent && !this.isMcpMode) {
            if (taskError.severity === ErrorSeverity.CRITICAL) {
                console.error('\x1b[31m%s\x1b[0m', errorString);
            }
            else if (taskError.severity === ErrorSeverity.ERROR) {
                console.error(errorString);
            }
            else if (taskError.severity === ErrorSeverity.WARNING) {
                console.warn('\x1b[33m%s\x1b[0m', errorString);
            }
            else {
                console.info('\x1b[36m%s\x1b[0m', errorString);
            }
        }
        if (this.isMcpMode && process.send) {
            process.send({ type: 'error', payload: { message: errorString } });
        }
    }
    createFileSystemError(message, context, severity = ErrorSeverity.ERROR, originalError) {
        return new TaskError(message, ErrorCategory.FILESYSTEM, severity, { operation: context.operation || 'file_operation', ...context }, originalError);
    }
    createParsingError(message, context, severity = ErrorSeverity.ERROR, originalError) {
        return new TaskError(message, ErrorCategory.PARSING, severity, { operation: context.operation || 'parsing', ...context }, originalError);
    }
    createLLMError(message, context, severity = ErrorSeverity.ERROR, originalError) {
        return new TaskError(message, ErrorCategory.LLM, severity, { operation: context.operation || 'llm_operation', ...context }, originalError);
    }
    static async tryCatch(fn, errorCategory, operation, context = {}, defaultValue) {
        try {
            return await fn();
        }
        catch (error) {
            const handler = ErrorHandler.getInstance();
            const taskError = new TaskError(error instanceof Error ? error.message : String(error), errorCategory, ErrorSeverity.ERROR, { operation, ...context }, error instanceof Error ? error : undefined);
            handler.handleError(taskError);
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw taskError;
        }
    }
}
export const errorHandler = ErrorHandler.getInstance();
//# sourceMappingURL=errorHandler.js.map