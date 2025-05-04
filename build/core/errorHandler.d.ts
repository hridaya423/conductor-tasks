export declare enum ErrorSeverity {
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    CRITICAL = "CRITICAL"
}
export declare enum ErrorCategory {
    FILESYSTEM = "FILESYSTEM",
    NETWORK = "NETWORK",
    PARSING = "PARSING",
    VALIDATION = "VALIDATION",
    CONFIGURATION = "CONFIGURATION",
    LLM = "LLM",
    UNKNOWN = "UNKNOWN"
}
export interface ErrorContext {
    operation: string;
    targetFile?: string;
    taskId?: string;
    additionalInfo?: Record<string, any>;
}
export declare class TaskError extends Error {
    severity: ErrorSeverity;
    category: ErrorCategory;
    context: ErrorContext;
    timestamp: number;
    originalError?: Error;
    constructor(message: string, category?: ErrorCategory, severity?: ErrorSeverity, context?: ErrorContext, originalError?: Error);
    toString(): string;
}
export declare class ErrorHandler {
    private static instance;
    private logFilePath;
    private isMcpMode;
    private isTestMode;
    private consoleEnabled;
    private fileLoggingEnabled;
    private maxLogSize;
    private maxLogFiles;
    private constructor();
    static getInstance(): ErrorHandler;
    configure(options: {
        consoleEnabled?: boolean;
        fileLoggingEnabled?: boolean;
        logFilePath?: string;
        maxLogSize?: number;
        maxLogFiles?: number;
    }): void;
    handleError(error: TaskError | Error, silent?: boolean): void;
    createFileSystemError(message: string, context: Omit<ErrorContext, 'operation'> & {
        operation?: string;
    }, severity?: ErrorSeverity, originalError?: Error): TaskError;
    createParsingError(message: string, context: Omit<ErrorContext, 'operation'> & {
        operation?: string;
    }, severity?: ErrorSeverity, originalError?: Error): TaskError;
    createLLMError(message: string, context: Omit<ErrorContext, 'operation'> & {
        operation?: string;
    }, severity?: ErrorSeverity, originalError?: Error): TaskError;
    private logToFile;
    private rotateLogFiles;
    static tryCatch<T>(fn: () => Promise<T> | T, errorCategory: ErrorCategory, operation: string, context?: Omit<ErrorContext, 'operation'>, defaultValue?: T): Promise<T>;
}
declare const _default: ErrorHandler;
export default _default;
